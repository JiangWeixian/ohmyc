import type { Transport } from '../transport'

const routes: Record<string, (args: Record<string, unknown>) => string> = {
  'timeline.heatmap': (a) => `/api/timeline/heatmap?${qs(a)}`,
  'timeline.events': (a) => `/api/timeline/events?${qs(a)}`,
  'timeline.session': (a) => `/api/timeline/sessions/${encodeURIComponent(String(a.id ?? ''))}`,
  'timeline.projects': () => '/api/timeline/projects',
  'timeline.years': () => '/api/timeline/years',
  'timeline.status': () => '/api/timeline/status',
  'agents.list': (a) => `/api/agents${a.origins ? `?${qs({ origins: a.origins })}` : ''}`,
  'agents.get': (a) => `/api/agents/${encodeURIComponent(String(a.name ?? ''))}${detailQs(a)}`,
  'skills.list': (a) => `/api/skills${a.origins ? `?${qs({ origins: a.origins })}` : ''}`,
  'skills.get': (a) => `/api/skills/${encodeURIComponent(String(a.name ?? ''))}${detailQs(a)}`,
  'commands.list': (a) => `/api/commands${a.origins ? `?${qs({ origins: a.origins })}` : ''}`,
  'commands.get': (a) => `/api/commands/${encodeURIComponent(String(a.name ?? ''))}${detailQs(a)}`,
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

export const fetchTransport: Transport = async (wire, args) => {
  const a = (args ?? {}) as Record<string, unknown>
  const url = routes[wire]
    ? routes[wire](a)
    : `/api/${wire.replace(/\./g, '/')}${Object.keys(a).length > 0 ? `?${qs(a)}` : ''}`

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw { code: res.status === 404 ? 'NotFound' : 'Internal', message: body || res.statusText }
  }
  return res.json()
}
