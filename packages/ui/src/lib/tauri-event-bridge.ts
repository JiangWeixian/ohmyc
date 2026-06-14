// Thin bridge over @tauri-apps/api/event. @ohmyc/ui has no @tauri-apps/api
// dep — the desktop package supplies it via vite alias. Statically importing
// here means this module is only resolved when something dynamic-imports it
// by literal path (see use-fs-changed.ts), which lets Vite analyze the
// chunk + apply the magic-chunk-name properly. In web/test builds this file
// is never imported, so the missing dep is harmless.

import { listen } from '@tauri-apps/api/event'

export type Unlisten = () => void

export async function subscribe<TPayload>(
  event: string,
  handler: (payload: TPayload) => void,
): Promise<Unlisten> {
  return listen<TPayload>(event, (e) => handler(e.payload))
}
