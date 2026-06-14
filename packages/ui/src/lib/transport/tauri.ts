import { invoke } from '@tauri-apps/api/core'

import type { Transport } from '../transport'

export const tauriTransport: Transport = async (wire, args) => {
  const cmd = wire.replace(/\./g, '_')
  try {
    return await invoke(cmd, (args ?? {}) as Record<string, unknown>)
  }
  catch (raw) {
    if (raw && typeof raw === 'object' && 'code' in raw) {
      const e = raw as { code: string, message?: string, detail?: unknown }
      throw { code: e.code, message: e.message ?? '', detail: e.detail }
    }
    throw { code: 'Internal', message: typeof raw === 'string' ? raw : JSON.stringify(raw) }
  }
}
