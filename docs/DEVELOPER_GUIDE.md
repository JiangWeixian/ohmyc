# OhMyC 开发者指南

## 目录

- [项目概览](#项目概览)
- [Monorepo 结构说明](#monorepo-结构说明)
- [开发环境搭建](#开发环境搭建)
- [CLI 包详解](#cli-包详解packagescli)
- [UI 包详解](#ui-包详解packagesui)
- [共享包详解](#共享包详解packagesshared)
- [前后端交互](#前后端交互)
- [构建与发布](#构建与发布)
- [测试](#测试)
- [贡献指南](#贡献指南)

---

## 项目概览

### 项目定位

OhMyC 是一个 CLI 工具，带有 Web UI，用于**可视化展示和管理 Claude Code 的配置文件**。它能够浏览、编辑 `.claude`（或 `.cui`）目录下的 agents、skills、commands、plugins、settings、MCP servers、hooks、LSP servers 等配置资源，并支持 Profile（配置档案）的创建、激活与切换。

### 架构设计

项目采用**前后端分离**架构：

```
┌──────────────────┐      HTTP/REST       ┌──────────────────┐
│   React Web UI   │ ◄──────────────────► │  Fastify Server  │
│   (Vite + SPA)   │      JSON API        │  (Node.js CLI)   │
└──────────────────┘                       └──────────────────┘
         │                                         │
         │  @ohmyc/shared                       │  文件系统
         ▼                                         ▼
  类型定义 & Schema                        ~/.cui/ 或 ~/.claude/
```

- **后端**：CLI 包（`@ohmyc/cli`）作为本地 HTTP 服务器运行，通过 Fastify 提供 REST API，直接读写文件系统上的配置文件。
- **前端**：UI 包（`@ohmyc/ui`）是一个 React SPA，通过 Vite 构建，产物嵌入 CLI 的 dist 目录中。
- **共享层**：`@ohmyc/shared` 定义所有 Zod schema 和 TypeScript 类型，前后端共用。

### 技术选型理由

| 技术 | 用途 | 理由 |
|------|------|------|
| **pnpm workspace** | Monorepo 管理 | 原生 workspace 支持，依赖效率高 |
| **Fastify** | HTTP 服务器 | 高性能、插件体系、类型安全 |
| **cac** | CLI 参数解析 | 轻量、简洁，适合单一命令场景 |
| **React + React Router** | 前端框架 | 组件化 UI 开发，声明式路由 |
| **TanStack React Query** | 状态管理 | 专注服务端状态同步，缓存与重试内置 |
| **Zod** | Schema 验证 | 前后端共享类型契约，运行时验证 |
| **CodeMirror 6** | 代码编辑器 | JSON 编辑场景，轻量高性能 |
| **shadcn/ui + Tailwind CSS** | UI 组件库 | 可定制性强，无运行时依赖 |
| **tsup** | 构建 CLI & shared | 基于 esbuild，构建速度快 |
| **Vite** | 构建 UI | HMR 极快，React 生态首选 |
| **Vitest** | 测试框架 | 与 Vite 共享配置，ESM 原生支持 |

---

## Monorepo 结构说明

### 目录树

```
ohmyc/
├── package.json              # 根 workspace 配置
├── pnpm-workspace.yaml       # workspace 声明
├── tsconfig.json             # 项目引用基础配置
├── packages/
│   ├── cli/                  # @ohmyc/cli — CLI 工具 & HTTP 服务器
│   │   ├── src/
│   │   │   ├── index.ts           # CLI 入口，命令注册
│   │   │   ├── launcher.ts        # 启动逻辑（启动服务器 + 打开浏览器）
│   │   │   └── server/
│   │   │       ├── index.ts           # Fastify 服务器创建与启动
│   │   │       ├── routes/            # API 路由模块
│   │   │       └── services/          # 业务逻辑服务层
│   │   ├── tsup.config.ts         # tsup 构建配置
│   │   ├── vitest.config.ts       # 测试配置
│   │   └── scripts/
│   │       └── prepublish.mjs     # npm 发布前处理脚本
│   ├── ui/                   # @ohmyc/ui — React 前端（private）
│   │   ├── src/
│   │   │   ├── main.tsx           # React 入口
│   │   │   ├── App.tsx            # 路由配置
│   │   │   ├── Explorer.tsx       # 主浏览视图
│   │   │   ├── ProfilesView.tsx   # Profile 管理视图
│   │   │   ├── hooks/             # React Query 数据 hooks
│   │   │   ├── components/        # UI 组件
│   │   │   └── utils/             # 工具函数
│   │   ├── vite.config.ts         # Vite 开发/构建配置
│   │   └── vitest.config.ts       # 测试配置
│   └── shared/               # @ohmyc/shared — 共享类型 & Schema
│       └── src/
│           ├── index.ts           # 统一导出
│           ├── schemas.ts         # 基础 Schema（Settings, ClaudeMd）
│           ├── agentSchema.ts     # Agent 相关 Schema
│           ├── skillSchema.ts     # Skill 相关 Schema
│           ├── commandSchema.ts   # Command 相关 Schema
│           ├── settingsSchema.ts  # Settings JSON 详细 Schema
│           ├── pluginSchema.ts    # Plugin 相关 Schema
│           ├── profileSchema.ts   # Profile 相关 Schema
│           ├── storeSchema.ts     # Store 导入/来源 Schema
│           └── modelConfigSchema.ts  # Model 配置 Schema
```

### 包依赖关系

```
@ohmyc/ui ──────► @ohmyc/shared
@ohmyc/cli ─────► @ohmyc/shared
```

- CLI 和 UI 都依赖 shared 包，但彼此不直接依赖。
- UI 构建产物通过 `tsup.config.ts` 的 `onSuccess` 钩子复制到 CLI 的 `dist/ui/` 目录。

---

## 开发环境搭建

### 环境要求

| 工具 | 版本要求 |
|------|---------|
| Node.js | >= 18（推荐 20+） |
| pnpm | >= 8.0（推荐 10.x，项目锁定 `pnpm@10.15.1`） |

### 安装依赖

```bash
# 克隆仓库
git clone <repo-url> && cd ohmyc

# 安装所有 workspace 依赖
pnpm install
```

### 开发模式启动

开发模式使用 `concurrently` 并行启动 CLI 服务器和 Vite 开发服务器：

```bash
# 在项目根目录执行
pnpm dev
```

此命令会并行运行：
- **server**：`pnpm --filter @ohmyc/cli dev:server` — 以 `--api-only` 模式启动 Fastify，tsup 监听变化自动重编译并重启
- **ui**：`pnpm --filter @ohmyc/ui dev` — 启动 Vite 开发服务器（带 HMR），API 请求通过 `vite.config.ts` 中的 proxy 转发到后端

```typescript
// packages/ui/vite.config.ts
server: {
  proxy: {
    '/api': 'http://127.0.0.1:3000',  // Vite 代理 API 请求到后端
  },
}
```

### 构建流程

```bash
# 完整构建（先 UI 后 CLI）
pnpm build
```

构建顺序至关重要：
1. **`pnpm --filter @ohmyc/ui build`** — 执行 `tsc && vite build`，产物输出到 `packages/ui/dist/`
2. **`pnpm --filter @ohmyc/cli build`** — 执行 `tsup`，将 TypeScript 编译为 CJS，并通过 `onSuccess` 钩子将 UI 产物复制到 `packages/cli/dist/ui/`

---

## CLI 包详解（packages/cli）

### 入口文件和命令注册机制

**入口文件**：`packages/cli/src/index.ts`

CLI 使用 `cac` 库解析命令行参数，注册了两个命令：

```typescript
// packages/cli/src/index.ts
const cli = cac('cu');

// 显式 start 命令
cli.command('start', 'Start the OhMyC server and open the browser')
  .option('--port <port>', 'Port to listen on', { default: 3000 })
  .option('--api-only', 'Start API server only, skip static file serving')
  .action(async (options) => { ... });

// 默认命令：直接运行 `cu` 等同于 `cu start`
cli.command('[...args]', 'Start OhMyC (default)')
  .action(async (args) => { ... });
```

**使用方式**：
```bash
cu                      # 启动服务器并打开浏览器（默认端口 3000）
cu start                # 同上
cu start --port 8080    # 指定端口
cu start --api-only     # 仅启动 API，不提供静态文件服务
cu --help               # 显示帮助
cu --version            # 显示版本
```

### 启动流程

启动流程由 `packages/cli/src/launcher.ts` 中的 `launchApp()` 函数协调：

1. 调用 `startServer()` 启动 Fastify HTTP 服务器
2. 使用 `get-port` 自动选择可用端口（尝试 defaultPort, defaultPort+1, defaultPort+2, 随机端口）
3. 输出就绪状态信息
4. 如果非 `--api-only` 模式，使用 `open` 库自动打开浏览器

### HTTP 服务（Fastify）

#### 服务器创建

`packages/cli/src/server/index.ts` 中的 `createServer()` 函数创建 Fastify 实例并注册所有路由和插件：

```typescript
export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: true })

  // 健康检查端点
  fastify.get('/health', async () => ({ status: 'ok' }))

  // 静态文件服务（非 api-only 模式）
  if (!options.apiOnly) {
    const uiDistPath = resolveStaticRoot(options.staticRoot)
    if (uiDistPath) {
      fastify.register(fastifyStatic, { root: uiDistPath, prefix: '/', wildcard: false })
    }
  }

  // 注册所有 API 路由
  await fastify.register(configRoutes)
  await fastify.register(settingsRoutes)
  // ... 更多路由

  // SPA fallback：未匹配的路由返回 index.html
  fastify.setNotFoundHandler((request, reply) => {
    reply.sendFile('index.html')
  })

  return fastify
}
```

#### 静态文件服务

UI 资产查找按以下优先级顺序搜索（`resolveStaticRoot()` 函数）：

1. `dist/ui/` — CLI 打包后的内置位置（生产环境）
2. `../../ui/dist` — 从 `dist/index.js` 向上查找（monorepo 开发）
3. `../../../ui/dist` — 从 `dist/server/index.js` 向上查找
4. `../../../../ui/dist` — 从源码路径向上查找（本地开发）

#### ConfigLocator — 配置目录定位

`packages/cli/src/server/services/configLocator.ts` 是整个系统的路径基础设施：

```
写入目录（~/.cui/ 或 $CUI_HOME）：
├── agents/          → 写入用 agents 目录
├── skills/          → 写入用 skills 目录
├── commands/        → 写入用 commands 目录
├── settings.json    → 管理配置文件
├── store/           → Store 组件库
│   ├── agents/
│   ├── skills/
│   ├── commands/
│   └── model-configs/
└── profiles/        → Profile 存档
    ├── .active      → 当前激活 profile 标记
    └── <name>/
        └── profile.json

读取目录（~/.claude/ 或 $AGENT_HOME）：
└── plugins/         → 插件安装目录

项目目录（<cwd>/.claude/ 或 <cwd>/$AGENT_HOME/）：
├── agents/          → 项目级 agents
├── skills/          → 项目级 skills
├── commands/        → 项目级 commands
└── settings.json    → 项目级 settings
```

环境变量覆盖：
- `CUI_HOME` — 覆盖写入目录名称（默认 `.cui`）
- `AGENT_HOME` — 覆盖 Claude Code 配置目录名称（默认 `.claude`）

### API 端点列表

#### 配置 & 设置

| 方法 | 端点 | 功能 | 文件 |
|------|------|------|------|
| GET | `/api/config` | 配置占位端点 | `routes/config.ts` |
| POST | `/api/config` | 配置占位端点 | `routes/config.ts` |
| GET | `/api/settings` | 读取 settings.json | `routes/settings.ts` |
| POST | `/api/settings` | 写入 settings.json | `routes/settings.ts` |
| GET | `/api/settings/schema` | 返回 settings 的 JSON Schema | `routes/settings.ts` |

#### 资源浏览（Agents / Skills / Commands）

| 方法 | 端点 | 功能 | 文件 |
|------|------|------|------|
| GET | `/api/agents` | 列出所有 agents（合并全局 + 插件 + 项目） | `routes/agents.ts` |
| GET | `/api/agents/:name` | 获取单个 agent 详情 | `routes/agents.ts` |
| GET | `/api/skills` | 列出所有 skills | `routes/skills.ts` |
| GET | `/api/skills/:name` | 获取单个 skill 详情 | `routes/skills.ts` |
| GET | `/api/commands` | 列出所有 commands | `routes/commands.ts` |
| GET | `/api/commands/:name` | 获取单个 command 详情 | `routes/commands.ts` |

资源列表端点聚合三个来源的数据：
1. **全局** — `~/.cui/agents|skills|commands/` 目录
2. **插件** — 已启用的插件安装路径下的子目录
3. **项目** — `<cwd>/.claude/agents|skills|commands/` 目录（如存在）

每个返回项包含 `source`（`local` / `plugin` / `project`）、`scope`（`global` / `project`）和可选的 `pluginId` 字段。

#### 插件

| 方法 | 端点 | 功能 | 文件 |
|------|------|------|------|
| GET | `/api/plugins` | 列出所有已安装插件 | `routes/plugins.ts` |
| GET | `/api/plugins/:id` | 获取单个插件详情 | `routes/plugins.ts` |
| GET | `/api/marketplaces` | 列出已知市场 | `routes/plugins.ts` |
| GET | `/api/marketplaces/:id` | 获取单个市场详情 | `routes/plugins.ts` |

#### 合并配置（MCP / Hooks / LSP）

| 方法 | 端点 | 功能 | 文件 |
|------|------|------|------|
| GET | `/api/mcp` | 读取 .mcp.json 并合并全局+插件+项目 | `routes/configs.ts` |
| GET | `/api/hooks` | 读取 hooks 配置并合并全局+插件+项目 | `routes/configs.ts` |
| GET | `/api/lsp` | 读取 .lsp.json 并合并全局+插件+项目 | `routes/configs.ts` |

这些端点将多个来源的配置扁平化为统一的条目列表，每条标注 `source` 和 `scope`。

#### Store（组件库管理）

| 方法 | 端点 | 功能 | 文件 |
|------|------|------|------|
| GET | `/api/store/agents` | 列出 store 中的 agents | `routes/store.ts` |
| GET | `/api/store/agents/:name` | 获取单个 store agent | `routes/store.ts` |
| POST | `/api/store/agents` | 创建 store agent | `routes/store.ts` |
| PUT | `/api/store/agents/:name` | 更新 store agent | `routes/store.ts` |
| DELETE | `/api/store/agents/:name` | 删除 store agent（带引用检查） | `routes/store.ts` |
| GET/POST/PUT/DELETE | `/api/store/skills/*` | Store skills CRUD（同上结构） | `routes/store.ts` |
| GET/POST/PUT/DELETE | `/api/store/commands/*` | Store commands CRUD（同上结构） | `routes/store.ts` |
| GET/POST/PUT/DELETE | `/api/store/model-configs/*` | Store model configs CRUD | `routes/store.ts` |
| POST | `/api/store/import` | 从外部目录导入组件（支持 dryRun） | `routes/store.ts` |

**删除安全机制**：删除 store 组件前检查是否有 Profile 引用了该组件。若有引用且未传 `?force=true`，返回 `409 Conflict`。

#### Profile（配置档案管理）

| 方法 | 端点 | 功能 | 文件 |
|------|------|------|------|
| GET | `/api/profiles` | 列出所有 profiles + 当前激活 | `routes/profiles.ts` |
| GET | `/api/profiles/:name` | 获取单个 profile | `routes/profiles.ts` |
| POST | `/api/profiles` | 创建 profile | `routes/profiles.ts` |
| PUT | `/api/profiles/:name` | 更新 profile | `routes/profiles.ts` |
| DELETE | `/api/profiles/:name` | 删除 profile（禁止删除激活中的） | `routes/profiles.ts` |
| GET | `/api/profiles/:name/preflight` | 预检：检查组件是否存在、环境变量变更 | `routes/profiles.ts` |
| POST | `/api/profiles/:name/activate` | 激活 profile（事务性操作） | `routes/profiles.ts` |
| POST | `/api/profiles/:name/deactivate` | 停用当前 profile | `routes/profiles.ts` |

### 服务层详解

CLI 的路由层只负责参数解析和 HTTP 状态码映射，核心逻辑在 `packages/cli/src/server/services/` 下。

#### AgentService（`services/agentService.ts`）

管理 `.md` 格式的 agent 文件。使用 `gray-matter` 解析 YAML frontmatter + Markdown 正文：

```typescript
// Agent 文件格式（如 ~/.cui/agents/code-reviewer.md）
---
name: code-reviewer
description: Reviews code for quality and best practices
model: claude-3.5-sonnet
tools:
  - Read
  - Grep
---

你是一个代码审查专家...
```

核心方法：`list()` / `get(name)` / `create(frontmatter, content)` / `update(name, changes)` / `delete(name)`

#### SkillService（`services/skillService.ts`）

管理目录式 skill 结构，每个 skill 是一个目录，包含 `SKILL.md`：

```
skills/
└── gitlab-action/
    └── SKILL.md    # 包含 frontmatter + 内容
```

#### CommandService（`services/commandService.ts`）

与 AgentService 结构类似，管理 `.md` 格式的 command 文件。

#### PluginService（`services/pluginService.ts`）

读取 `~/.claude/plugins/installed_plugins.json` 和 `settings.json` 中的 `enabledPlugins`，汇总已安装插件列表。对每个插件扫描其目录结构，汇总组件清单（agents、skills、commands、hooks、mcp、lsp）。

#### PluginResolver（`services/pluginResolver.ts`）

轻量工具类，仅负责解析已启用插件的安装路径列表。

#### ProfileService（`services/profileService.ts`）

Profile 管理的核心服务，包含复杂的激活/停用事务逻辑：

**激活流程**（`activate()` 方法）：
1. 获取锁（`LockService`，基于 `proper-lockfile`）
2. 执行预检（检查 store 组件是否存在）
3. 备份当前 `settings.json`
4. 写入 `.active` 标记文件
5. 为 agents/skills/commands 创建**符号链接**到 profile 目录
6. 生成插件文件（`plugin.json`）
7. 写入 hooks、MCP、LSP 配置
8. 深度合并 settings 并注入 model config 环境变量
9. 更新 `enabledPlugins` 使 profile 自身作为插件生效

**失败回滚**：维护 undo 栈，任何步骤失败时按逆序执行所有 undo 操作，然后尝试恢复之前的 profile。

#### StoreService（`services/storeService.ts`）

管理 Store 组件库，提供从外部目录导入组件的功能：
- `scanImport()` — 预览导入（dry run），列出冲突
- `applyImport()` — 执行导入，支持覆盖已有文件
- 维护 provenance 索引（`.metadata/imports.json`），记录每个组件的导入来源
- `getReferencingProfiles()` — 检查哪些 Profile 引用了指定组件（删除安全检查）

#### LockService（`services/lockService.ts`）

基于 `proper-lockfile` 的文件锁，用于保证 Profile 激活操作的事务性。锁超时 10 秒，重试 3 次。

### `.claude` 配置文件的读写逻辑

所有文件读写操作集中在服务层：

| 资源 | 文件格式 | 存储位置 | 解析方式 |
|------|---------|---------|---------|
| Agent | `.md` + YAML frontmatter | `~/.cui/agents/*.md` | `gray-matter` |
| Skill | 目录 + `SKILL.md` | `~/.cui/skills/<name>/SKILL.md` | `gray-matter` |
| Command | `.md` + YAML frontmatter | `~/.cui/commands/*.md` | `gray-matter` |
| Settings | JSON | `~/.cui/settings.json` | `JSON.parse` |
| MCP Servers | JSON | `~/.cui/.mcp.json` | `JSON.parse` |
| LSP Servers | JSON | `~/.cui/.lsp.json` | `JSON.parse` |
| Hooks | JSON（嵌套在 settings 中） | `~/.cui/settings.json` | `JSON.parse` |
| Profile | JSON | `~/.cui/profiles/<name>/profile.json` | Zod `ProfileSchema.parse` |
| Model Config | JSON | `~/.cui/store/model-configs/*.json` | `JSON.parse` |
| Plugin 安装记录 | JSON | `~/.claude/plugins/installed_plugins.json` | `JSON.parse` |

### 静态文件服务（嵌入 UI 产物）

生产模式下，CLI 将前端构建产物嵌入 `dist/ui/` 目录。构建时 `tsup.config.ts` 的 `onSuccess` 钩子执行：

```typescript
// packages/cli/tsup.config.ts
onSuccess: async () => {
  const uiDist = path.resolve(__dirname, '../ui/dist')
  const cliUiDist = path.resolve(__dirname, 'dist/ui')
  if (existsSync(uiDist)) {
    cpSync(uiDist, cliUiDist, { recursive: true })
  }
}
```

运行时通过 `@fastify/static` 托管，未匹配路由返回 `index.html`（SPA fallback）。

---

## UI 包详解（packages/ui）

### 目录结构

```
packages/ui/src/
├── main.tsx                 # React 入口，挂载根组件
├── App.tsx                  # 路由配置 & 布局壳
├── Explorer.tsx             # 主浏览视图（Agents/Skills/Commands/Plugins/Configs）
├── ProfilesView.tsx         # Profile 管理视图
├── globals.css              # 全局 CSS 变量 & Tailwind 导入
├── hooks/                   # 数据层（React Query hooks）
│   ├── useAgents.ts         # Agent 查询
│   ├── useSkills.ts         # Skill 查询
│   ├── useCommands.ts       # Command 查询
│   ├── useConfigs.ts        # MCP/Hooks/LSP 查询
│   ├── usePlugins.ts        # Plugin 查询
│   ├── useProfiles.ts       # Profile CRUD + 激活/停用
│   ├── useSettings.ts       # Settings 读写
│   └── useStore.ts          # Store 组件库 CRUD + 导入
├── components/
│   ├── ui/                  # 基础 UI 组件（Toast、Skeleton、CommandPalette 等）
│   ├── profiles/            # Profile 相关组件
│   │   ├── ProfilesSidebar.tsx
│   │   ├── ProfileCard.tsx
│   │   ├── ProfileEditor.tsx
│   │   ├── ComponentPicker.tsx
│   │   ├── PluginPicker.tsx
│   │   ├── ActivateConfirmDialog.tsx
│   │   ├── ActivationBlockedDialog.tsx
│   │   └── ConfirmSwitchDialog.tsx
│   ├── store/               # Store 组件库 UI
│   │   ├── StoreComponentList.tsx
│   │   ├── StoreComponentEditor.tsx
│   │   ├── ModelConfigEditor.tsx
│   │   ├── ImportComponentsDialog.tsx
│   │   └── DeleteConfirmDialog.tsx
│   ├── settings/            # Settings 编辑 UI
│   │   ├── SettingsLayout.tsx
│   │   ├── SettingsSidebar.tsx
│   │   ├── SettingsContent.tsx
│   │   └── GeneralSettings.tsx
│   ├── EntityCard.tsx       # 资源卡片组件
│   ├── EntityDetail.tsx     # 资源详情组件（Markdown 渲染）
│   ├── Sidebar.tsx          # 主侧边栏
│   ├── ConfigSection.tsx    # 配置项展示组件
│   ├── SourceBadge.tsx      # 来源标签（local/plugin/project）
│   ├── JsonEditor.tsx       # CodeMirror JSON 编辑器
│   ├── MarkdownRenderer.tsx # Markdown 渲染器
│   ├── ViewSwitcher.tsx     # Explorer/Profiles 视图切换
│   └── cn.ts                # clsx + tailwind-merge 工具
├── utils/
│   └── maskApiKey.ts        # API Key 脱敏
└── test/
    ├── setup.ts             # Vitest 测试 setup
    └── renderWithProviders.tsx  # 测试辅助渲染函数
```

### 路由结构

路由在 `App.tsx` 中定义：

```typescript
<Routes>
  <Route path="/profiles/*" element={<ProfilesView />} />
  <Route path="/explore/:tab" element={<Explorer />} />
  <Route path="/explore" element={<Navigate to="/explore/agents" replace />} />
  <Route path="*" element={<Navigate to="/explore/agents" replace />} />
</Routes>
```

| 路径 | 组件 | 说明 |
|------|------|------|
| `/explore/agents` | `Explorer` | Agent 浏览列表 |
| `/explore/skills` | `Explorer` | Skill 浏览列表 |
| `/explore/commands` | `Explorer` | Command 浏览列表 |
| `/explore/plugins` | `Explorer` | Plugin 浏览列表 |
| `/explore/mcp` | `Explorer` | MCP Server 配置列表 |
| `/explore/hooks` | `Explorer` | Hook 配置列表 |
| `/explore/lsp` | `Explorer` | LSP Server 配置列表 |
| `/profiles` | `ProfilesView` | Profile 管理首页 |
| `/profiles/new` | `ProfilesView` | 新建 Profile |
| `/profiles/:name` | `ProfilesView` | 查看/编辑 Profile |
| `/profiles/agents` | `ProfilesView` | Store Agents 管理 |
| `/profiles/skills` | `ProfilesView` | Store Skills 管理 |
| `/profiles/commands` | `ProfilesView` | Store Commands 管理 |
| `/profiles/model-configs` | `ProfilesView` | Store Model Configs 管理 |

### 状态管理方案

项目使用 **TanStack React Query** 作为唯一的状态管理方案，不使用 Redux、Zustand 等额外状态库。

```typescript
// packages/ui/src/main.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // 禁用窗口聚焦时自动刷新
    },
  },
})
```

所有数据获取逻辑封装在 `hooks/` 目录下的自定义 hooks 中。每个 hook 遵循统一模式：

```typescript
// 列表查询
export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  })
}

// 详情查询（条件启用）
export function useAgent(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['agents', locator?.name, locator?.source, locator?.pluginId, locator?.scope],
    queryFn: () => fetchAgent(locator!),
    enabled: !!locator, // locator 为 null 时不执行查询
  })
}

// 变更操作（自动失效缓存）
export function useCreateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}
```

**Query Key 命名约定**：
- `['agents']` / `['skills']` / `['commands']` — 列表
- `['agents', name, source, pluginId, scope]` — 详情
- `['profiles']` — 列表
- `['profiles', name]` — 详情
- `['store', 'agents']` / `['store', 'skills']` / `['store', 'commands']` / `['store', 'model-configs']` — Store
- `['mcp']` / `['hooks']` / `['lsp']` — 配置
- `['plugins']` / `['marketplaces']` — 插件
- `['settings', project]` — 设置

### UI 组件库

#### 基础设施

- **`cn.ts`**：合并 `clsx` + `tailwind-merge`，用于条件性组合 Tailwind 类名
- **CSS 变量**：通过 `globals.css` 定义主题变量（`--surface-base`、`--text-primary`、`--accent-blue` 等）
- **Tailwind CSS**：使用 `tailwindcss-animate` 插件

#### UI 通用组件（`components/ui/`）

| 组件 | 用途 |
|------|------|
| `Toast.tsx` | 通知提示（替代 alert） |
| `Skeleton.tsx` | 加载骨架屏 + 动画列表容器 |
| `CommandPalette.tsx` | 命令面板（快捷键唤起） |
| `HoverCard.tsx` | 悬浮卡片 |
| `KeyboardShortcuts.tsx` | 快捷键系统 |
| `QuickActions.tsx` | 快捷操作面板 |

### 代码编辑器集成（CodeMirror）

`packages/ui/src/components/JsonEditor.tsx` 封装了 CodeMirror 6，用于 JSON 编辑场景：

```typescript
import { json } from '@codemirror/lang-json'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
```

特性：
- JSON 语法高亮
- One Dark 主题 + 自定义 CSS 变量主题适配
- 行号、折叠、默认快捷键
- 通过 `EditorView.updateListener` 监听变更回调
- 支持外部 value 同步（通过 dispatch 更新）

---

## 共享包详解（packages/shared）

### 概览

`@ohmyc/shared` 是前后端共享的类型契约层，使用 Zod 定义 schema 并同时导出类型推断。

**入口文件**：`packages/shared/src/index.ts` — 统一导出所有 schema 和类型。

### Schema 定义

#### 基础 Schema（`schemas.ts`）

```typescript
export const SettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  defaultAgent: z.string().optional(),
  mcpServers: z.record(z.object({ ... })).optional()
});
```

#### Agent Schema（`agentSchema.ts`）

定义 Agent 的 frontmatter 结构和完整类型：

```typescript
export const SAFE_NAME_PATTERN = /^[\w-]+$/

export const AgentFrontmatterSchema = z.object({
  name: z.string(),
  description: z.string(),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  permissionMode: z.enum(['default', 'acceptEdits', 'dontAsk', 'bypassPermissions', 'plan']).optional(),
  // ... 更多字段
}).passthrough()

export const AgentSchema = z.object({
  id: z.string(),
  frontmatter: AgentFrontmatterSchema,
  content: z.string(),
  raw: z.string(),
  filename: z.string(),
  source: z.enum(['local', 'profile', 'plugin', 'project']),
  scope: ScopeEnum.optional(),
  pluginId: z.string().optional(),
  provenance: StoreComponentProvenanceSchema.optional(),
})
```

同时导出 `CreateAgentBodySchema` 和 `UpdateAgentBodySchema` 用于 API 请求验证。

#### Skill Schema（`skillSchema.ts`）& Command Schema（`commandSchema.ts`）

结构类似 Agent，但 Skill 使用 `dirName` 替代 `filename`。

#### Settings JSON Schema（`settingsSchema.ts`）

定义完整的 `settings.json` 结构，包含以下子 schema：
- `GeneralSettingsSchema` — 通用设置（model、language、autoUpdates 等）
- `PermissionSettingsSchema` — 权限设置（allow/ask/deny 规则）
- `SandboxSettingsSchema` — 沙箱设置（文件系统、网络策略）
- `HookSettingsSchema` — Hook 设置
- `PluginSettingsSchema` — 插件设置
- `EnvSettingsSchema` — 环境变量
- `McpControlSettingsSchema` — MCP 控制设置
- `AttributionSettingsSchema` — 归因设置

#### Plugin Schema（`pluginSchema.ts`）

定义插件相关类型：`PluginInstall`、`PluginManifest`、`InstalledPlugin`、`Marketplace`。

#### Profile Schema（`profileSchema.ts`）

```typescript
export const RESERVED_PROFILE_NAMES = ['store', '.active', 'plugins', 'agents', 'skills', 'commands']

export const ProfileSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  agents: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  commands: z.array(z.string()).default([]),
  plugins: z.array(z.string()).default([]),
  modelConfig: z.string().optional(),
  hooks: z.any().optional(),
  mcpServers: z.any().optional(),
  lspServers: z.any().optional(),
  settings: z.record(z.any()).optional(),
})
```

#### Store Schema（`storeSchema.ts`）

定义 Store 组件库的导入/来源追踪类型：
- `StoreComponentType` — `'agents' | 'skills' | 'commands' | 'model-configs'`
- `StoreComponentProvenance` — 导入来源记录（`importPath` + `importedAt`）
- `StoreImportRequest` — 导入请求参数
- `StoreImportResult` — 导入结果
- `StoreImportConflict` — 冲突条目

#### Model Config Schema（`modelConfigSchema.ts`）

定义模型配置（API Key、Base URL、模型名称等）。

### 类型导出

每个 schema 文件都通过 `z.infer<>` 导出 TypeScript 类型：

```typescript
export type Agent = z.infer<typeof AgentSchema>
export type AgentFrontmatter = z.infer<typeof AgentFrontmatterSchema>
export type Profile = z.infer<typeof ProfileSchema>
// ...
```

### API 契约

shared 包是前后端的**唯一类型契约**。后端使用 Zod schema 验证请求体，前端使用 TypeScript 类型确保类型安全：

```typescript
// 后端验证示例（routes/profiles.ts）
// 前端类型使用（hooks/useProfiles.ts）
import type { CreateProfileBody, Profile } from '@ohmyc/shared'

const parsed = CreateProfileBodySchema.safeParse(request.body)
if (!parsed.success) {
  return reply.status(400).send({ error: parsed.error.message })
}
```

---

## 前后端交互

### API 调用流程

#### 开发模式

```
浏览器 ──► Vite Dev Server (localhost:5173)
               │
               │ proxy: { '/api': 'http://127.0.0.1:3000' }
               ▼
          Fastify Server (localhost:3000)
               │
               ▼
          文件系统 (~/.cui/, ~/.claude/)
```

Vite 的 `server.proxy` 将所有 `/api` 请求转发到 Fastify 后端。

#### 生产模式

```
浏览器 ──► Fastify Server (localhost:3000)
               │
               ├── /api/* → REST API 路由
               │               │
               │               ▼
               │          文件系统
               │
               └── 其他路径 → SPA fallback (index.html)
                                │
                                ▼
                           React 应用 (静态文件)
```

### 数据流说明

以「浏览 Agents 列表」为例的完整数据流：

```
1. 用户导航到 /explore/agents
      │
2. Explorer.tsx 调用 useAgents() hook
      │
3. React Query 执行 fetchAgents() → fetch('/api/agents')
      │
4. Vite proxy 转发到 Fastify → agentsRoutes.GET /api/agents
      │
5. AgentService.list() 读取 ~/.cui/agents/*.md
      │
6. PluginResolver 获取已启用插件路径
      │
7. 对每个插件路径创建 AgentService 读取插件 agents
      │
8. 检查项目目录 <cwd>/.claude/agents/ 读取项目 agents
      │
9. 合并、排序后返回 { agents: [...] }
      │
10. React Query 缓存结果，触发组件重渲染
      │
11. Explorer.tsx 渲染 EntityCard 列表
```

以「激活 Profile」为例的写操作数据流：

```
1. 用户点击 "Activate" 按钮
      │
2. ProfilesView 调用 activateMut.mutate(name)
      │
3. useActivateProfile() 执行 → fetch('/api/profiles/:name/activate', { method: 'POST' })
      │
4. profilesRoutes 处理请求 → ProfileService.activate(name)
      │
5. 执行事务性操作：加锁 → 预检 → 备份 → 创建符号链接 → 合并 settings → 写入
      │
6. 成功后 React Query 自动 invalidate ['profiles'] 缓存
      │
7. UI 重新获取 profiles 列表，显示最新状态
```

---

## 构建与发布

### 构建流程详解

#### 1. UI 构建

```bash
pnpm --filter @ohmyc/ui build
```

执行 `tsc && vite build`：
- `tsc` 进行类型检查
- `vite build` 将 React 应用打包为静态文件，输出到 `packages/ui/dist/`

#### 2. CLI 构建

```bash
pnpm --filter @ohmyc/cli build
```

执行 `tsup`（配置在 `packages/cli/tsup.config.ts`）：
- **入口**：`src/index.ts`
- **输出格式**：仅 CJS（`dist/index.cjs`）
- **关键配置**：
  - `noExternal`：所有运行时依赖打包进 bundle，不保留 `require()` 引用
  - `import.meta.url` shim：通过 banner 注入 `_importMetaUrl` 变量
  - `onSuccess` 钩子：将 `packages/ui/dist/` 复制到 `packages/cli/dist/ui/`

#### 3. 完整构建

```bash
pnpm build   # 等价于 pnpm --filter @ohmyc/ui build && pnpm --filter @ohmyc/cli build
```

### npm 发布流程

CLI 包配置了 `prepublishOnly` 脚本：

```json
"prepublishOnly": "pnpm build:full && node scripts/prepublish.mjs"
```

`scripts/prepublish.mjs` 在发布前：
1. 检查 `dist/index.cjs` 和 `dist/ui/index.html` 是否存在
2. 临时修改 `package.json`：
   - `name` 从 `@ohmyc/cli` 改为 `@aiou/cu`
   - `dependencies` 清空为 `{}`（所有依赖已打包进 bundle）
3. npm 读取修改后的 `package.json` 进行发布
4. 发布完成后自动恢复原始 `package.json`

### CLI 打包和 bin 配置

```json
{
  "bin": {
    "cu": "dist/index.cjs",
    "ohmyc": "dist/index.cjs"
  },
  "files": ["dist", "README.md"]
}
```

用户安装后可以通过 `cu` 或 `ohmyc` 命令启动。

---

## 测试

### 测试框架和配置

项目使用 **Vitest** 作为测试框架，三个包各有配置：

| 包 | 配置文件 | 测试环境 |
|------|---------|---------|
| CLI | `packages/cli/vitest.config.ts` | `node` |
| UI | `packages/ui/vitest.config.ts` | `jsdom` |

UI 的测试配置：
```typescript
// packages/ui/vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
```

### 如何运行测试

```bash
# 运行所有包的测试
pnpm test

# 运行特定包的测试
pnpm --filter @ohmyc/cli test
pnpm --filter @ohmyc/ui test

# 监听模式
pnpm --filter @ohmyc/cli test:watch
```

### 现有测试覆盖

#### CLI 测试

| 文件 | 测试内容 |
|------|---------|
| `src/__tests__/launcherCli.test.ts` | 启动流程：状态消息、浏览器打开、端口回退、错误处理 |
| `src/__tests__/package.test.ts` | 包配置：bin 入口、files 白名单、tsup bundle 完整性 |
| `src/server/__tests__/launcherServer.test.ts` | 服务器创建与启动 |
| `src/server/routes/__tests__/agents.test.ts` | Agent 路由 |
| `src/server/routes/__tests__/skills.test.ts` | Skill 路由 |
| `src/server/routes/__tests__/commands.test.ts` | Command 路由 |
| `src/server/routes/__tests__/plugins.test.ts` | Plugin 路由 |
| `src/server/routes/__tests__/configs.test.ts` | 配置路由（MCP/Hooks/LSP） |
| `src/server/routes/__tests__/profiles.test.ts` | Profile 路由 |
| `src/server/routes/__tests__/store.test.ts` | Store 路由 |

#### UI 测试

| 目录 | 测试内容 |
|------|---------|
| `src/hooks/__tests__/` | React Query hooks |
| `src/components/__tests__/` | 组件渲染测试 |
| `src/components/profiles/__tests__/` | Profile 组件 |
| `src/components/store/__tests__/` | Store 组件 |
| `src/utils/__tests__/` | 工具函数 |
| `src/test/renderWithProviders.smoke.test.tsx` | 测试基础设施冒烟测试 |

### 如何编写新测试

#### CLI 测试示例

```typescript
// packages/cli/src/server/routes/__tests__/myFeature.test.ts
import Fastify from 'fastify'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { myFeatureRoutes } from '../myFeature'

describe('My Feature Routes', () => {
  let app: Fastify.FastifyInstance

  beforeEach(async () => {
    app = Fastify()
    await app.register(myFeatureRoutes, { /* options */ })
  })

  it('GET /api/my-feature returns data', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/my-feature' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toBeDefined()
  })
})
```

#### UI 测试示例

```typescript
// packages/ui/src/components/__tests__/MyComponent.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

#### Mock 策略

- CLI 测试使用 `vi.mock()` mock 外部依赖（如 `open`、`../server/index`）
- UI 测试通过 `renderWithProviders` 自动包裹 `QueryClientProvider`、`BrowserRouter` 等上下文

---

## 贡献指南

### 代码风格

- **TypeScript 严格模式**：所有包启用 `strict: true`
- **ESM 源码**：源文件使用 ESM（`import/export`），CLI 构建产物为 CJS
- **命名约定**：
  - 文件名：camelCase（`agentService.ts`、`useAgents.ts`）
  - React 组件：PascalCase（`EntityCard.tsx`）
  - Schema/类型：PascalCase + `Schema`/`Body` 后缀（`AgentSchema`、`CreateAgentBody`）
  - CSS 变量：kebab-case（`--surface-base`、`--accent-blue`）
- **CSS**：使用 Tailwind CSS + CSS 变量，不使用内联样式或独立 CSS 文件
- **注释**：关键逻辑需有英文注释说明意图，但避免过度注释

### PR 流程

1. Fork 仓库并创建特性分支
2. 确保所有测试通过：`pnpm test`
3. 如涉及 API 变更，先更新 `packages/shared` 中的 Zod schema
4. 如涉及新路由，添加对应测试
5. 提交 PR，描述变更内容和动机

### 常见开发任务

#### 添加新的 API 端点

1. 在 `packages/shared/src/` 中定义 Zod schema 和类型
2. 在 `packages/cli/src/server/services/` 中创建服务类
3. 在 `packages/cli/src/server/routes/` 中创建路由文件
4. 在 `packages/cli/src/server/index.ts` 中注册路由
5. 在 `packages/ui/src/hooks/` 中创建 React Query hook
6. 在 `packages/ui/src/components/` 中创建 UI 组件

#### 添加新的浏览 Tab

1. 在 `Explorer.tsx` 的 `SECTIONS` 数组中添加条目
2. 在 `renderEntityList()` 或新建渲染函数中处理新 Tab
3. 创建对应的组件和 hook

#### 添加新的 Profile 配置项

1. 更新 `packages/shared/src/profileSchema.ts` 中的 `ProfileSchema`
2. 更新 `packages/cli/src/server/services/profileService.ts` 中的激活逻辑
3. 更新 `packages/ui/src/components/profiles/ProfileEditor.tsx` 中的表单

#### 添加新的 Store 组件类型

1. 在 `packages/shared/src/storeSchema.ts` 中更新 `StoreComponentTypeSchema`
2. 创建对应的 Service 类（参考 `AgentService`）
3. 在 `packages/cli/src/server/routes/store.ts` 中添加 CRUD 路由
4. 在 `packages/ui/src/hooks/useStore.ts` 中添加 hooks
5. 在 `packages/ui/src/components/store/` 中添加 UI 组件
