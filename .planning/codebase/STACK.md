# Technology Stack

**Analysis Date:** 2026-04-13

## Languages

**Primary:**
- TypeScript (ESNext) - `packages/cli/src/**/*.ts`, `packages/ui/src/**/*.ts`, `packages/shared/src/**/*.ts`

**Secondary:**
- TSX - React UI in `packages/ui/src/**/*.tsx`
- JSON - Config/data files in `.claude` and `.planning` (paths managed in server code)
- CSS - Tailwind styles in `packages/ui/src/globals.css`

## Runtime

**Environment:**
- Node.js (ESM) - CLI/server runtime in `packages/cli/src/index.ts`

**Package Manager:**
- pnpm ^8.0.0 (root `package.json`)
- Lockfile: `pnpm-lock.yaml` present

## Frameworks

**Core (Backend):**
- Fastify ^4.26.2 - HTTP server in `packages/cli/src/server/index.ts`

**Core (Frontend):**
- React ^18.2.0 - UI in `packages/ui/src/**/*`
- React Router ^6.22.3 - routing in `packages/ui/src/App.tsx`
- Vite ^5.2.2 - build/dev in `packages/ui/vite.config.ts`

**Testing:**
- Vitest ^2.1.9 - configs in `packages/ui/vitest.config.ts`, `packages/cli/vitest.config.ts`
- Testing Library - setup in `packages/ui/src/test/setup.ts`

**Build/Dev:**
- tsup ^8.0.2 - CLI/shared builds in `packages/cli/tsup.config.ts`, `packages/shared/package.json`
- Tailwind CSS ^3.4.1 - config in `packages/ui/tailwind.config.js`

## Key Dependencies

**Critical:**
- Zod ^3.23.x - schema validation in `packages/shared/src/*.ts`
- @tanstack/react-query ^5.28.4 - data fetching in `packages/ui/src/hooks/*.ts`
- gray-matter ^4.0.3 - frontmatter parsing in `packages/cli/src/server/services/*.ts`

**Infrastructure:**
- @fastify/static ^7.0.3 - serving UI assets in `packages/cli/src/server/index.ts`
- cac ^6.7.14 - CLI in `packages/cli/src/index.ts`
- get-port ^7.1.0 - port selection in `packages/cli/src/server/index.ts`
- untildify ^6.0.0 - path normalization in `packages/cli/src/server/services/storeService.ts`

## Configuration

**Environment:**
- CLI server uses `AGENT_HOME` to locate `.claude` data in `packages/cli/src/server/index.ts`
- Default API port 3000 (CLI `packages/cli/src/index.ts`, server `packages/cli/src/server/index.ts`)

**Build:**
- Root TS config: `tsconfig.json`
- Shared TS config: `packages/shared/tsconfig.json`
- Vite config: `packages/ui/vite.config.ts`
- PostCSS/Tailwind: `packages/ui/postcss.config.js`, `packages/ui/tailwind.config.js`

## Platform Requirements

**Development:**
- Node.js (ESM support)
- pnpm

**Production:**
- Node.js runtime
- Local filesystem access to `~/.claude` (managed by `packages/cli/src/server/index.ts`)

---

*Stack analysis: 2026-04-13*
