// E2E stub for @tauri-apps/api/webviewWindow.
export function getCurrentWebviewWindow(): { label: string } {
  const label = (globalThis as unknown as { __E2E_WINDOW_LABEL?: string }).__E2E_WINDOW_LABEL ?? 'main'
  return { label }
}
