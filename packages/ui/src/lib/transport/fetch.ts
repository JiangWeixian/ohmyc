import type { Transport } from '../transport'

const routes: Record<string, (args: Record<string, unknown>) => string> = {
  'timeline.heatmap': (a) => `/api/timeline/heatmap?${qs(a)}`,
  'timeline.events': (a) => `/api/timeline/events?${qs(a)}`,
  'timeline.session': (a) => `/api/timeline/sessions/${encodeURIComponent(String(a.id ?? ''))}`,
  'timeline.projects': () => '/api/timeline/projects',
  'timeline.years': () => '/api/timeline/years',
  'timeline.status': () => '/api/timeline/status',
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
