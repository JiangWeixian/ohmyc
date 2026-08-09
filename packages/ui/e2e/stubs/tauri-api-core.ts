// E2E stub for @tauri-apps/api/core. Records all invoke() calls so tests
// can assert that buttons like "Open OhMyC" triggered native commands.

interface InvokeCall { cmd: string; args: Record<string, unknown> }

const w = globalThis as unknown as {
  __e2eInvokeCalls?: InvokeCall[]
  __e2eGetInvokeCalls?: (cmd: string) => InvokeCall[]
  __e2eClearInvokeCalls?: () => void
}

w.__e2eInvokeCalls = w.__e2eInvokeCalls ?? []
w.__e2eGetInvokeCalls = (cmd: string) => w.__e2eInvokeCalls!.filter(c => c.cmd === cmd)
w.__e2eClearInvokeCalls = () => {
  w.__e2eInvokeCalls = []
}

export const invoke = async (
  cmd: string,
  args?: Record<string, unknown>,
): Promise<unknown> => {
  w.__e2eInvokeCalls!.push({ cmd, args: args ?? {} })
  return undefined
}
