import { fetchTransport } from './transport/fetch'
import { mockTransport } from './transport/mock'

export type Transport = (wire: string, args?: unknown) => Promise<unknown>

export interface ApiError {
  code: string
  message: string
  detail?: unknown
}

type TransportName = 'tauri' | 'fetch' | 'mock'

function pickFromEnv(): TransportName {
  const raw = (import.meta.env?.VITE_TRANSPORT ?? 'fetch') as string
  if (raw === 'tauri' || raw === 'mock') {
    return raw
  }
  return 'fetch'
}

let active: TransportName = pickFromEnv()

// `@tauri-apps/api` is not a dep of @ohmyc/ui (only @ohmyc/desktop pulls it in),
// so a static import would break `pnpm dev` here. The dynamic import keeps the
// tauri module out of the web/test bundles unless the active transport asks for it.
async function resolve(name: TransportName): Promise<Transport> {
  switch (name) {
    case 'tauri': {
      const { tauriTransport } = await import('./transport/tauri')
      return tauriTransport
    }
    case 'mock': return mockTransport
    case 'fetch': return fetchTransport
  }
}

export async function request<T>(wire: string, args?: unknown): Promise<T> {
  const transport = await resolve(active)
  return transport(wire, args) as Promise<T>
}

export function __setTransportForTests(name: TransportName): void {
  active = name
}

export function resetTransportForTests(): void {
  active = pickFromEnv()
}
