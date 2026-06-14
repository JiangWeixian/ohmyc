import { mockTransport } from './transport/mock'

export type Transport = (wire: string, args?: unknown) => Promise<unknown>

export interface ApiError {
  code: string
  message: string
  detail?: unknown
}

type TransportName = 'tauri' | 'mock'

function pickFromEnv(): TransportName {
  // VITE_TRANSPORT is set to 'tauri' by packages/desktop/vite.config.ts and
  // to 'mock' by vitest setup. Any other value falls back to 'tauri' — the
  // desktop binary is the only production target.
  const raw = (import.meta.env?.VITE_TRANSPORT ?? 'tauri') as string
  return raw === 'mock' ? 'mock' : 'tauri'
}

let active: TransportName = pickFromEnv()

// `@tauri-apps/api` is not a dep of @ohmyc/ui (only @ohmyc/desktop pulls it in).
// Dynamic import keeps it out of the vitest bundle unless the active transport
// asks for it.
async function resolve(name: TransportName): Promise<Transport> {
  switch (name) {
    case 'tauri': {
      const { tauriTransport } = await import('./transport/tauri')
      return tauriTransport
    }
    case 'mock': return mockTransport
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
