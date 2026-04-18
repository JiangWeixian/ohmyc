# Agents API Design Spec

## Overview

为 ClaudeUI 的 `packages/cli` 添加 Agents CRUD API，读取真实的 agent 文件（YAML frontmatter + Markdown），通过 HTTP API 暴露给前端。采用 TDD 方式开发，使用 vitest。

## 数据模型

### AgentFrontmatter

对应 Claude Code agent 文件的 YAML frontmatter 字段：

```typescript
const AgentFrontmatterSchema = z.object({
  name: z.string(),
  description: z.string(),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  permissionMode: z.enum(['default', 'acceptEdits', 'dontAsk', 'bypassPermissions', 'plan']).optional(),
  maxTurns: z.number().optional(),
  skills: z.array(z.string()).optional(),
  memory: z.enum(['user', 'project', 'local']).optional(),
  background: z.boolean().optional(),
  effort: z.enum(['low', 'medium', 'high', 'max']).optional(),
  isolation: z.enum(['worktree']).optional(),
  mcpServers: z.any().optional(),
  hooks: z.any().optional(),
}).passthrough()
```

### Agent

API 返回的完整 agent 对象：

```typescript
const AgentSchema = z.object({
  id: z.string(),                               // 文件名去掉 .md，如 "code-reviewer"
  frontmatter: AgentFrontmatterSchema,
  content: z.string(),                           // markdown body (system prompt)
  raw: z.string(),                               // 原始文件完整内容
  filename: z.string(),                          // 文件名，如 "code-reviewer.md"
  source: z.enum(['user', 'project', 'plugin']), // 来源类型，当前固定 "user"
})
```

Schema 定义在 `packages/shared/src/` 中，供 CLI 和 UI 共享。

## 架构

```
Route (Fastify handler) → AgentService (业务逻辑) → FileSystem (fs)
```

### AgentService

位置：`packages/cli/src/server/services/agentService.ts`

```typescript
class AgentService {
  constructor(private agentsDir: string) {}

  async list(): Promise<Agent[]>
  async get(name: string): Promise<Agent | null>
  async create(frontmatter: AgentFrontmatter, content: string): Promise<Agent>
  async update(name: string, frontmatter: Partial<AgentFrontmatter>, content?: string): Promise<Agent | null>
  async delete(name: string): Promise<boolean>
}
```

关键行为：

- **目录不存在时**：`list()` 返回 `[]`，`get()` 返回 `null`，`create()` 自动创建目录
- **frontmatter 解析**：使用 `gray-matter` 库
- **name 冲突**：`create()` 时同名文件已存在则抛错
- **source 字段**：当前固定为 `"user"`
- **可配置目录**：`agentsDir` 通过构造函数传入，默认 `~/.claude/agents`
- **列表排序**：`list()` 按文件名字母序排列
- **malformed 文件**：`list()` 跳过无法解析 frontmatter 的文件，不中断整体列表

### 文件名与 name 映射规则

- **`:name` 路由参数** = 文件名去掉 `.md` 后缀（即 `id` 字段），如 `code-reviewer`
- **`create()` 文件名生成**：直接使用 `frontmatter.name` 作为文件名 `${frontmatter.name}.md`。要求 `name` 只能包含 `[a-zA-Z0-9_-]`，不合法则返回 400
- **路径安全**：`:name` 参数必须匹配 `/^[a-zA-Z0-9_-]+$/`，否则返回 400，防止路径穿越

### API 路由

位置：`packages/cli/src/server/routes/agents.ts`

| Method | Path | 行为 |
|--------|------|------|
| GET | `/api/agents` | `service.list()` |
| GET | `/api/agents/:name` | `service.get(name)` |
| POST | `/api/agents` | `service.create(frontmatter, content)` |
| PUT | `/api/agents/:name` | `service.update(name, frontmatter, content)` |
| DELETE | `/api/agents/:name` | `service.delete(name)` |

路由创建时接收 `agentsDir` 配置，实例化 `AgentService`。路由 handler 使用 Zod schema 校验请求体，校验失败返回 400。

#### 请求/响应格式

```typescript
// POST /api/agents 请求体
{ frontmatter: AgentFrontmatter, content: string }

// PUT /api/agents/:name 请求体
{ frontmatter?: Partial<AgentFrontmatter>, content?: string }

// GET /api/agents 响应
{ agents: Agent[] }

// GET /api/agents/:name 响应
{ agent: Agent }             // 200
{ error: "Agent not found" } // 404

// POST /api/agents 响应
{ agent: Agent }                  // 201
{ error: "Agent already exists" } // 409
{ error: string }                 // 400 (校验失败 / name 不合法)

// PUT /api/agents/:name 响应
{ agent: Agent }             // 200
{ error: "Agent not found" } // 404
{ error: string }            // 400 (校验失败)

// DELETE /api/agents/:name 响应
{ success: true }            // 200
{ error: "Agent not found" } // 404
{ error: string }            // 400 (name 不合法)
```

### Update 合并语义

`update()` 采用浅合并：
- 传入的 frontmatter 字段覆盖已有字段
- 未传入的字段保持不变
- `content` 可选，不传则保持原有 body 不变

### 服务器集成

在 `packages/cli/src/server/index.ts` 中注册 `agentsRoutes`，与 `configRoutes`、`settingsRoutes` 并列。`agentsDir` 通过 `os.homedir() + '/.claude/agents'` 解析默认值，可通过 server 配置覆盖。

## 测试策略

使用 vitest，TDD 方式开发。

### vitest 配置

在 `packages/cli/` 下创建 `vitest.config.ts`，使用 Node 环境。

### 测试结构

```
packages/cli/
  src/server/services/__tests__/
    agentService.test.ts      ← 核心测试
  src/server/routes/__tests__/
    agents.test.ts            ← 路由集成测试
```

### AgentService 测试（重点）

每个测试用临时目录作为 `agentsDir`，`beforeEach` 创建，`afterEach` 清理。预先写入 `.md` 文件来准备测试数据。

覆盖场景：
- `list()`: 空目录、多个 agent、忽略非 .md 文件、跳过 malformed 文件、字母序排列
- `get()`: 存在、不存在、目录不存在
- `create()`: 正常创建、目录不存在自动创建、name 冲突 409、name 不合法 400
- `update()`: 正常更新、不存在、部分更新（只改 frontmatter / 只改 content）、浅合并验证
- `delete()`: 正常删除、不存在

### 路由测试（薄层）

使用 `fastify.inject()` 验证 HTTP 状态码和响应格式，不重复测 service 逻辑。额外覆盖：
- 请求体 Zod 校验失败返回 400
- `:name` 路径穿越返回 400

## 依赖

新增依赖：
- `vitest` — 测试框架（dev dependency，packages/cli）
- `gray-matter` — YAML frontmatter 解析（dependency，packages/cli）

### gray-matter ESM 兼容性

`gray-matter` 是 CJS 包，项目使用 ESM。需在开发早期验证 import 兼容性，必要时使用 `createRequire` 或动态 `import()`。tsup 打包时可通过 banner/shims 处理。

## 配置

`agentsDir` 默认值为 `~/.claude/agents`，通过 `os.homedir()` 解析。可通过 server 启动配置覆盖（如传入 `.agents` 等自定义目录路径）。
