import type { Transport } from '../transport'

type Handler = (args: unknown) => Promise<unknown>

const handlers = new Map<string, Handler>()

export function setMockHandler(wire: string, handler: Handler): void {
  handlers.set(wire, handler)
}

export function resetMock(): void {
  handlers.clear()
}

export const mockTransport: Transport = async (wire, args) => {
  const handler = handlers.get(wire)
  if (!handler) {
    throw { code: 'Internal', message: `no mock handler registered for '${wire}'` }
  }
  try {
    return await handler(args)
  }
  catch (err) {
    if (err && typeof err === 'object' && 'code' in err) {
      const e = err as { code: string, message?: string, detail?: unknown }
      throw { code: e.code, message: e.message ?? '', detail: e.detail }
    }
    throw { code: 'Internal', message: err instanceof Error ? err.message : String(err) }
  }
}
