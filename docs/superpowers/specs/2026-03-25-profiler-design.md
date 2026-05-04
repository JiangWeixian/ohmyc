# Profiler Manager Design Spec

## Overview

将 OhMyC 从配置浏览器转变为 profiler 管理工具。Profile 是 agents/skills/commands/plugins/hooks/mcp/lsp/settings 的预设组合，以 Claude Code plugin 格式存储，可快速切换激活。

**平台限制**：仅支持 macOS/Linux（软链依赖）。

## 核心概念

### Store

独立的存储区域，存放所有用户管理的组件实际内容。

```
<AGENT_HOME>/store/
  agents/<name>.md
  skills/<name>/SKILL.md
  commands/<name>.md
```

- 保持和 AGENT_HOME 一致的目录结构
- CRUD 只操作 store，不直接修改 AGENT_HOME
- 支持从指定目录导入组件到 store
- 现有 AgentService/SkillService/CommandService 复用，指向 store 目录

### Profile

每个 profile 是一个 Claude Code plugin 目录结构，存放在 `<AGENT_HOME>/profiles/<name>/`。

Profile name 校验：必须匹配 `SAFE_NAME_PATTERN`（`[a-zA-Z0-9_-]`），且不能为 `store`、`.active` 等保留名。

**profile.json**（profile 定义文件）：

```json
{
  "name": "frontend-dev",
  "description": "Frontend development profile",
  "agents": ["code-reviewer", "debugger"],
  "skills": ["deploy-skill"],
  "commands": ["commit-push"],
  "plugins": ["gitlab@tmates-plugins", "superpowers@superpowers-dev"],
  "hooks": {
    "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "echo hi" }] }]
  },
  "mcpServers": {
    "db": { "command": "node", "args": ["server.js"] }
  },
  "lspServers": {},
  "settings": {
    "model": "opus"
  }
}
```

**Zod schema**（定义在 `packages/shared/src/profileSchema.ts`）：

```typescript
export const ProfileSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  agents: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  commands: z.array(z.string()).default([]),
  plugins: z.array(z.string()).default([]),
  hooks: z.any().optional(),
  mcpServers: z.any().optional(),
  lspServers: z.any().optional(),
  settings: z.record(z.any()).optional(),
})
```

- `agents`/`skills`/`commands`：引用 store 中组件的 name
- `plugins`：引用已安装插件的 id（`name@marketplace`）
- `hooks`/`mcpServers`/`lspServers`：profile 自有配置，直接存值
- `settings`：settings.json overlay，激活时 deep merge 进 settings.json

### 激活后的 Profile 目录（plugin 格式）

```
<AGENT_HOME>/profiles/frontend-dev/
  profile.json                        ← profile 定义（始终存在）
  .claude-plugin/plugin.json          ← 生成的 plugin manifest
  agents/
    code-reviewer.md → ../../store/agents/code-reviewer.md   ← 软链
    debugger.md → ../../store/agents/debugger.md
  skills/
    deploy-skill/ → ../../store/skills/deploy-skill/         ← 软链
  commands/
    commit-push.md → ../../store/commands/commit-push.md     ← 软链
  hooks/hooks.json                    ← 从 profile.json 生成
  .mcp.json                           ← 从 profile.json 生成
  .lsp.json                           ← 从 profile.json 生成
```

**生成的 plugin.json 内容**：

```json
{
  "name": "profile-frontend-dev",
  "version": "1.0.0",
  "description": "OhMyC profile: Frontend development profile"
}
```

## Profile 生命周期

### 创建

1. UI 上新建 profile，输入 name/description
2. 从 store 中勾选 agents/skills/commands
3. 从已安装插件中勾选 plugins
4. 配置 hooks/mcpServers/lspServers（可选）
5. 配置 settings overlay（可选）
6. 保存 `<AGENT_HOME>/profiles/<name>/profile.json`

### 激活

```
1. 如果已有激活的 profile → 先停用
2. 备份 settings.json → settings.backup.json（写入后 rename 保证原子性）
3. 在 profile 目录下建立 agents/skills/commands 到 store 的软链
   - 如果引用的 store 组件不存在，跳过该组件并记录警告
4. 生成 plugin 文件：
   - .claude-plugin/plugin.json（见上方 plugin.json 内容）
   - hooks/hooks.json（如果 profile.hooks 非空）
   - .mcp.json（如果 profile.mcpServers 非空）
   - .lsp.json（如果 profile.lspServers 非空）
5. Deep merge settings overlay + enabledPlugins 到 settings.json
   - enabledPlugins 格式为 Record<string, boolean>（顶层字段）
   - 包括 profile 引用的 plugins（设为 true）+ profile 自身路径
   - Deep merge 规则：对象递归合并，数组和基本类型直接替换
6. 记录激活状态 → <AGENT_HOME>/profiles/.active 文件内容为 profile 目录绝对路径
```

**激活失败回滚**：如果中途出错，尝试恢复 settings.json（从 backup）并删除已创建的软链和生成文件。最终 .active 文件只在全部成功后写入。

### 停用

```
1. 从 settings.backup.json 恢复 settings.json
2. 删除 .active 文件
```

软链和生成的 plugin 文件保留在 profile 目录中（休眠状态），不会被 Claude Code 加载（因为已从 enabledPlugins 移除）。重新激活同一个 profile 时只需检查是否需要更新，无需从头重建。

注意：用户在 profile 激活期间手动改 settings.json 的内容会在停用时被 backup 覆盖。此风险可接受。

### 切换

停用当前 → 激活新的。

### 编辑

修改 profile.json。如果当前已激活，重新执行激活流程（刷新软链和配置）。

## Store 管理

### 导入

从指定目录扫描 agents/*.md、skills/*/SKILL.md、commands/*.md，复制到 store 对应位置。

**冲突处理**：默认跳过已存在的同名组件。API 返回导入摘要（imported/skipped/errors 计数 + 详情列表）。

### CRUD

复用现有 AgentService/SkillService/CommandService，指向 `<AGENT_HOME>/store/` 目录。

- Create：在 store 中创建文件
- Read：读取 store 文件
- Update：编辑 store 文件（如果被激活 profile 引用，软链自动生效）
- Delete：如果被某个 profile 引用，API 返回 409 + 引用该组件的 profile 列表。前端展示确认对话框，用户确认后可强制删除（传 `?force=true`）

**不支持重命名**：如需改名，在 store 中删除旧的、创建新的，手动更新引用的 profiles。

### 和 AGENT_HOME 的关系

AGENT_HOME 下原有的 agents/skills/commands（非软链）仍然可浏览（只读），CRUD 只操作 store。激活 profile 后 AGENT_HOME 目录中会出现软链文件，与用户手动创建的文件共存，互不影响。

## AGENT_HOME 来源标注

AGENT_HOME 只读视图中，每个组件标注来源：
- `local`：非软链的普通文件（用户手动创建）
- `profile`：软链文件，指向 store（通过 `lstat` 检测）
- `plugin`：来自启用的插件

现有 services 的 `source: 'user'` 需改为：在 AGENT_HOME 视图中用 `lstat` 检测文件是否为软链，软链标记为 `profile`，普通文件标记为 `local`。

## UI 结构

### 视图切换

顶部两个视图：`[Profiles]` 和 `[AGENT_HOME]`。

### Profiles 视图

侧边栏分两部分：

```
┌ My Profiles ─────────┐
│ frontend-dev ★        │    ★ = 当前激活
│ backend-dev           │
│ + New Profile         │
├ Store ───────────────┤
│ Agents               │
│ Skills               │
│ Commands             │
└──────────────────────┘
```

- 选中 profile：主区域显示 profile 配置（引用组件、plugins、hooks、mcp、settings overlay），可编辑，可激活/停用
- 选中 store tab：主区域显示组件列表，可 CRUD，标注每个组件被哪些 profiles 引用

### AGENT_HOME 视图（只读）

和现有 UI 基本一致，侧边栏 tabs：

```
Agents | Skills | Commands | Hooks | MCP | LSP | Plugins | Settings
```

显示 AGENT_HOME 下实际生效的内容（文件 + 插件聚合），标注来源（local/profile/plugin）。

## API 设计

### Store API（CRUD，操作 store 目录）

```
GET             /api/store/agents              → { agents: Agent[] }
POST            /api/store/agents              → { agent: Agent }  (201)
GET             /api/store/agents/:name        → { agent: Agent }
PUT             /api/store/agents/:name        → { agent: Agent }
DELETE          /api/store/agents/:name        → { success: true } | 409 { error, referencedBy: string[] }

GET             /api/store/skills              → { skills: Skill[] }
POST            /api/store/skills              → { skill: Skill }  (201)
GET             /api/store/skills/:name        → { skill: Skill }
PUT             /api/store/skills/:name        → { skill: Skill }
DELETE          /api/store/skills/:name        → { success: true } | 409

GET             /api/store/commands            → { commands: Command[] }
POST            /api/store/commands            → { command: Command }  (201)
GET             /api/store/commands/:name      → { command: Command }
PUT             /api/store/commands/:name      → { command: Command }
DELETE          /api/store/commands/:name      → { success: true } | 409

POST            /api/store/import              → { imported: number, skipped: number, errors: string[] }
  body: { sourceDir: string }
```

### Profile API（新增）

```
GET             /api/profiles                  → { profiles: Profile[], active: string | null }
POST            /api/profiles                  → { profile: Profile }  (201)
GET             /api/profiles/:name            → { profile: Profile }
PUT             /api/profiles/:name            → { profile: Profile }
DELETE          /api/profiles/:name            → { success: true }
POST            /api/profiles/:name/activate   → { success: true, warnings?: string[] }
POST            /api/profiles/:name/deactivate → { success: true }
```

注意：不再有 `GET /api/profiles/active` 端点，active 状态通过 `GET /api/profiles` 的 `active` 字段返回，避免和 `/:name` 路由冲突。

### AGENT_HOME API（只读，移除现有写操作）

现有路由的 POST/PUT/DELETE 端点将被移除，只保留 GET：

```
GET  /api/agents              ← 只读，AGENT_HOME + 插件聚合，标注 source (local/profile/plugin)
GET  /api/agents/:name
GET  /api/skills
GET  /api/skills/:name
GET  /api/commands
GET  /api/commands/:name
GET  /api/plugins
GET  /api/marketplaces
GET  /api/mcp
GET  /api/hooks
GET  /api/lsp
GET  /api/settings
```

**迁移**：现有 `/api/agents` 等路由的 POST/PUT/DELETE 将被移除。写操作迁移到 `/api/store/*`。

## 测试策略

### ProfileService 测试

- 创建/读取/更新/删除 profile（profile.json 的 CRUD）
- 激活：
  - 验证软链创建（agents/skills/commands）
  - 验证 plugin 文件生成（.claude-plugin/plugin.json, hooks.json, .mcp.json, .lsp.json）
  - 验证 settings.json deep merge（enabledPlugins + settings overlay）
  - 验证 settings.backup.json 创建
  - 验证 .active 文件写入
  - 引用不存在的 store 组件时跳过并返回 warnings
- 停用：
  - 验证 settings.json 从 backup 恢复
  - 验证软链删除、生成文件删除
  - 验证 .active 删除
- 切换：验证旧 profile 停用 + 新 profile 激活
- 激活失败回滚：中途出错时恢复到之前的状态
- Profile name 保留名校验

### Store 导入测试

- 从目录导入 agents/skills/commands
- 跳过已存在的同名组件
- 空目录处理
- 返回 imported/skipped/errors 摘要

### Store 删除引用检查测试

- 删除未被引用的组件：成功
- 删除被引用的组件：返回 409 + 引用列表
- force=true 时强制删除

### AGENT_HOME 来源标注测试

- 普通文件标记为 local
- 软链文件标记为 profile
- 插件聚合的标记为 plugin

### 路由测试

- Store API 完整 CRUD
- Profile API 完整 CRUD + activate/deactivate
- AGENT_HOME API 只读（现有 GET 测试保留，POST/PUT/DELETE 测试移除）
