/// <reference types="vite/client" />

declare module '*.glb' {
  const src: string
  export default src
}

// @fontsource packages ship CSS only (no TypeScript types). Imported for
// their stylesheet side effects (self-hosted fonts for offline Tauri support).
declare module '@fontsource/*'
