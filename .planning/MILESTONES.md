# Milestones

## v1.4 Project-Aware Loading + .cu Rebrand (Shipped: 2026-04-19)

**Phases completed:** 3 phases, 5 plans

**Key accomplishments:**

- ConfigLocator 集中路径解析 — 所有 `.claude`/`.cui` 路径通过单一服务，零散落字面量
- Project-local 双源加载 — API 返回 global + project 合并结果，project 优先，source 标签区分来源
- SourceBadge project variant — 绿色视觉标识 project-scoped 组件
- 写入路径重品牌为 ~/.cui/ — 管理数据写 `~/.cui/`，插件读 `~/.claude/`，`CUI_HOME` 可独立覆盖写入路径
- UAT 发现并修复 CUI_HOME/AGENT_HOME 独立性问题

**Archive:** [v1.4-ROADMAP.md](./milestones/v1.4-ROADMAP.md) | [v1.4-REQUIREMENTS.md](./milestones/v1.4-REQUIREMENTS.md)

---

## v1.3 CLI MVP (Shipped: 2026-04-16)

**Phases completed:** 2 phases, 5 plans, 9 tasks

**Key accomplishments:**

- Fastify server resolves packaged UI assets from dist/ui/ at runtime, serves SPA with fallback routing, and auto-selects open ports when the requested one is occupied
- One `cu` command starts the packaged server, prints startup phases, opens the browser to the actual running URL, and exits non-zero with an actionable error on failure
- CLI package configured as zero-dependency @aiou/cu with all 9 runtime deps bundled into single dist/index.js, prepublish name rewrite, and scoped npm registry routing
- 9-test suite verifying bin config, files allowlist, prepublishOnly, publishConfig, noExternal coverage, and self-contained bundle with no external npm imports
- CJS bundle format with esbuild import.meta.url shim, prepublishOnly build step, and runtime smoke test -- fixes dynamic require crash and adds 2 new verification tests

---

## v1.2 Model Config (Shipped: 2026-04-13)

**Phases completed:** 3 phases, 6 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---

## v1.1 Bugfixes (Shipped: 2026-04-08)

**Phases completed:** 1 phases, 2 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---

## v1.0 ClaudeUI MVP (Shipped: 2026-04-07)

**Phases completed:** 3 phases, 9 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---
