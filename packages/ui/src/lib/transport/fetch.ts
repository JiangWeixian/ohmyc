import type { Transport } from '../transport'

export const fetchTransport: Transport = async (wire, args) => {
  const path = `/api/${wire.replace(/\./g, '/')}`
  const url = args && Object.keys(args as object).length > 0
    ? `${path}?${new URLSearchParams(args as Record<string, string>).toString()}`
    : path
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw { code: res.status === 404 ? 'NotFound' : 'Internal', message: body || res.statusText }
  }
  return res.json()
}
