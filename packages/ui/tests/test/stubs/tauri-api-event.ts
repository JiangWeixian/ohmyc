// Vitest stub for @tauri-apps/api/event. The real module is supplied by
// @ohmyc/desktop's vite config via alias to node_modules; @ohmyc/ui itself
// has no @tauri-apps/api dep, so tests must stub.
//
// The stub records listeners so tests can drive quota:changed-style events
// through hooks with __emitForTests.

type Listener<TPayload = unknown> = (event: { payload: TPayload }) => void

const listeners = new Map<string, Set<Listener>>()

export const listen = async <TPayload>(event: string, handler: Listener<TPayload>): Promise<() => void> => {
  let set = listeners.get(event)
  if (!set) {
    set = new Set()
    listeners.set(event, set)
  }
  const entry = handler as Listener
  set.add(entry)
  return () => set.delete(entry)
}

export function __emitForTests(event: string, payload: unknown): void {
  const set = listeners.get(event)
  if (!set) {
    return
  }
  for (const handler of set) {
    handler({ payload })
  }
}

export function __resetListenersForTests(): void {
  listeners.clear()
}
