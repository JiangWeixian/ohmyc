// Vitest stub for @tauri-apps/api/event. The real module is supplied by
// @ohmyc/desktop's vite config via alias to node_modules; @ohmyc/ui itself
// has no @tauri-apps/api dep, so tests must stub.

const noopUnlisten = () => {}

export const listen = async () => noopUnlisten
