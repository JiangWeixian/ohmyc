import type { Transport } from '../transport'

interface RequestSpec {
  url: string
  method?: string
  body?: unknown
}

type RouteBuilder = (args: Record<string, unknown>) => string | RequestSpec

const routes: Record<string, RouteBuilder> = {
  'timeline.heatmap': a => `/api/timeline/heatmap?${qs(a)}`,
  'timeline.events': a => `/api/timeline/events?${qs(a)}`,
  'timeline.session': a => `/api/timeline/sessions/${encodeURIComponent(String(a.id ?? ''))}`,
  'timeline.projects': () => '/api/timeline/projects',
  'timeline.years': () => '/api/timeline/years',
  'timeline.status': () => '/api/timeline/status',
  'agents.list': a => `/api/agents${a.origins ? `?${qs({ origins: a.origins })}` : ''}`,
  'agents.get': a => `/api/agents/${encodeURIComponent(String(a.name ?? ''))}${detailQs(a)}`,
  'skills.list': a => `/api/skills${a.origins ? `?${qs({ origins: a.origins })}` : ''}`,
  'skills.get': a => `/api/skills/${encodeURIComponent(String(a.name ?? ''))}${detailQs(a)}`,
  'commands.list': a => `/api/commands${a.origins ? `?${qs({ origins: a.origins })}` : ''}`,
  'commands.get': a => `/api/commands/${encodeURIComponent(String(a.name ?? ''))}${detailQs(a)}`,
  'settings.get': (a) => {
    const project = a.project as string | undefined
    return project ? `/api/settings?${qs({ project })}` : '/api/settings'
  },
  'settings.set': (a) => {
    const project = a.project as string | undefined
    return {
      url: project ? `/api/settings?${qs({ project })}` : '/api/settings',
      method: 'POST',
      body: { content: a.content },
    }
  },
  'configs.mcp': () => '/api/mcp',
  'configs.hooks': () => '/api/hooks',
  'configs.lsp': () => '/api/lsp',

  'store.agents.list': () => '/api/store/agents',
  'store.agents.get': a => `/api/store/agents/${encodeURIComponent(String(a.name ?? ''))}`,
  'store.agents.create': a => ({ url: '/api/store/agents', method: 'POST', body: a.body }),
  'store.agents.update': a => ({
    url: `/api/store/agents/${encodeURIComponent(String(a.name ?? ''))}`,
    method: 'PUT',
    body: a.body,
  }),
  'store.agents.delete': a => ({
    url: `/api/store/agents/${encodeURIComponent(String(a.name ?? ''))}${a.force ? '?force=true' : ''}`,
    method: 'DELETE',
  }),
  'store.skills.list': () => '/api/store/skills',
  'store.skills.get': a => `/api/store/skills/${encodeURIComponent(String(a.name ?? ''))}`,
  'store.skills.create': a => ({ url: '/api/store/skills', method: 'POST', body: a.body }),
  'store.skills.update': a => ({
    url: `/api/store/skills/${encodeURIComponent(String(a.name ?? ''))}`,
    method: 'PUT',
    body: a.body,
  }),
  'store.skills.delete': a => ({
    url: `/api/store/skills/${encodeURIComponent(String(a.name ?? ''))}${a.force ? '?force=true' : ''}`,
    method: 'DELETE',
  }),
  'store.commands.list': () => '/api/store/commands',
  'store.commands.get': a => `/api/store/commands/${encodeURIComponent(String(a.name ?? ''))}`,
  'store.commands.create': a => ({ url: '/api/store/commands', method: 'POST', body: a.body }),
  'store.commands.update': a => ({
    url: `/api/store/commands/${encodeURIComponent(String(a.name ?? ''))}`,
    method: 'PUT',
    body: a.body,
  }),
  'store.commands.delete': a => ({
    url: `/api/store/commands/${encodeURIComponent(String(a.name ?? ''))}${a.force ? '?force=true' : ''}`,
    method: 'DELETE',
  }),
  'store.model_configs.list': () => '/api/store/model-configs',
  'store.model_configs.get': a => `/api/store/model-configs/${encodeURIComponent(String(a.name ?? ''))}`,
  'store.model_configs.create': a => ({ url: '/api/store/model-configs', method: 'POST', body: a.body }),
  'store.model_configs.update': a => ({
    url: `/api/store/model-configs/${encodeURIComponent(String(a.name ?? ''))}`,
    method: 'PUT',
    body: a.body,
  }),
  'store.model_configs.delete': a => ({
    url: `/api/store/model-configs/${encodeURIComponent(String(a.name ?? ''))}${a.force ? '?force=true' : ''}`,
    method: 'DELETE',
  }),
}

function qs(args: Record<string, unknown>): string {
  const out = new URLSearchParams()
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || v === null) {
      continue
    }
    out.set(k, String(v))
  }
  return out.toString()
}

function detailQs(args: Record<string, unknown>): string {
  const subset: Record<string, unknown> = {}
  for (const k of ['source', 'pluginId', 'scope']) {
    if (args[k] !== undefined && args[k] !== null) {
      subset[k] = args[k]
    }
  }
  const out = qs(subset)
  return out ? `?${out}` : ''
}

function buildInit(spec: RequestSpec): { url: string, init: RequestInit } {
  const headers: Record<string, string> = {}
  let body: BodyInit | undefined
  if (spec.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(spec.body)
  }
  return {
    url: spec.url,
    init: { method: spec.method ?? 'GET', headers, body },
  }
}

export const fetchTransport: Transport = async (wire, args) => {
  const a = (args ?? {}) as Record<string, unknown>
  const built = routes[wire]
    ? routes[wire](a)
    : `/api/${wire.replace(/\./g, '/')}${Object.keys(a).length > 0 ? `?${qs(a)}` : ''}`

  let url: string
  let init: RequestInit | undefined
  if (typeof built === 'string') {
    url = built
  }
  else {
    const prepared = buildInit(built)
    url = prepared.url
    init = prepared.init
  }

  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw { code: res.status === 404 ? 'NotFound' : 'Internal', message: body || res.statusText }
  }
  const text = await res.text()
  if (!text) {
    return undefined
  }
  return JSON.parse(text)
}
