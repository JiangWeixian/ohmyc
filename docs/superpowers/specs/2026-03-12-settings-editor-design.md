# Design Spec: Settings.json Editor

## Overview

Settings.json 编辑器是 .claude Explorer 的核心功能，用于可视化查看和编辑 Claude Code 的配置文件。采用 Linear 的完整设计风格，支持深色/浅色主题。

编辑器处理项目级 `.claude/settings.json`，不处理全局设置 (`~/.claude/settings.json`) 和 managed settings。

### 与现有 UI 的集成
Settings Editor 作为 ClaudeExplorer 侧边栏 "settings.json" 条目的内容视图。点击 "settings.json" 后，右侧内容区替换为设置编辑器（含独立的分类子导航）。

**路由架构**: Phase 1 需要引入 `react-router-dom` 的 `<BrowserRouter>`，包裹整个应用：
- `main.tsx` 添加 `<BrowserRouter>` wrapper
- `App.tsx` 作为顶层路由组件，渲染 ClaudeExplorer shell
- 现有 Explorer 侧边栏各条目映射为路由：`/settings/*`, `/claude-md`, `/hooks`, `/mcp`, ...
- Settings 子路由：`/settings/general`, `/settings/permissions`, `/settings/hooks` 等
- 现有 ClaudeExplorer 侧边栏条目（如 Hooks, MCP Servers）显示运行时状态/浏览；Settings 中的同名分类编辑配置。两者互补，不重复。

### Schema 策略
所有 TypeScript 接口将以 Zod schema 实现在 `packages/shared/src/settingsSchema.ts` 中。现有 `schemas.ts` 中的 `SettingsSchema`（含 `theme`, `defaultAgent`, `mcpServers`）保留不动，新文件独立导出。待功能稳定后再统一迁移。

Zod schema 使用 `.passthrough()` 允许未知字段通过（因为 Claude Code 可能随时新增设置项）。

schema 用于：
- 后端 `POST /api/settings` 请求验证（passthrough 模式，不丢弃未知字段）
- 前端表单验证（字段级校验）
- `GET /api/settings/schema` 端点（通过 `zod-to-json-schema` 生成 JSON Schema）

### 项目根目录确定
CLI 启动时通过以下优先级确定项目根目录：
1. CLI 参数 `--project <path>`（如提供）
2. 向上查找 `.git` 目录（git 项目根）
3. 回退到 `process.cwd()`

---

## 1. Layout Structure

### 1.1 整体布局
- **左侧导航栏**：240px 固定宽度，显示设置分类
- **右侧内容区**：最大宽度 800px，居中显示，垂直滚动
- **底部状态栏**：高度 32px，显示保存状态

### 1.2 分类导航 (Sidebar)
```
├── General          # 模型、语言、更新等基础配置
├── Permissions      # 工具权限规则 (allow/ask/deny)
├── Sandbox          # 沙盒隔离配置
├── Hooks            # 事件钩子配置
├── Attribution      # Git 署名设置
├── MCP              # MCP 服务器控制
├── Plugins          # 插件启用/禁用
└── Environment      # 环境变量
```

### 1.3 内容区域
- 分类标题 + 描述
- 设置项列表（表单或 JSON 编辑器）
- 底部状态栏（保存按钮 + 状态指示）

---

## 2. Visual Style (Linear 完整复刻)

注: 现有 ClaudeExplorer 使用 Tailwind zinc 色系（如 `bg-[#09090b]`）。设置编辑器的 Linear 色彩方案将应用于整个应用（Phase 1 时统一），通过 CSS 变量 (`--color-bg`, `--color-surface` 等) 实现主题切换，从 Phase 1 开始预留。

### 2.1 Color Palette

**深色模式**
- Background (主背景): `#1C1C1F`
- Surface (卡片/输入框): `#2C2C30`
- Border (分隔线): `#3A3A3F`
- Text Primary: `#EDEDEF`
- Text Secondary: `#8A8A8F`
- Accent: `#5E6AD2` (Linear 紫色)

**浅色模式**
- Background: `#FFFFFF`
- Surface: `#F5F5F7`
- Border: `#E5E5E5`
- Text Primary: `#1A1A1A`
- Text Secondary: `#6B6B6B`
- Accent: `#5E6AD2`

### 2.2 Typography
- **Primary Font**: Inter
- **Monospace**: JetBrains Mono / Fira Code
- **Sizes**:
  - H1: 20px, font-weight: 600
  - H2: 14px, font-weight: 600, uppercase, letter-spacing: 0.5px
  - Body: 13px, font-weight: 400
  - Code: 12px, monospace

### 2.3 Components

**Input (表单输入)**
- Background: `#2C2C30` (深色) / `#F5F5F7` (浅色)
- Border: none
- Border-radius: 6px
- Padding: 8px 12px
- Font-size: 13px

**分类标题**
- 14px, font-weight: 600
- uppercase, letter-spacing: 0.5px
- 颜色: Text Secondary
- 底部 1px 边框

**Toggle (开关)**
- 宽度: 32px, 高度: 18px
- 背景: `#3A3A3F` (关) / `#5E6AD2` (开)
- 圆角: 9px (完全圆角)

**保存按钮**
- 背景: `#5E6AD2`
- 文字: 白色, 13px, font-weight: 500
- Border-radius: 6px
- Padding: 6px 16px

---

## 3. Data Model

### 3.1 完整 Settings Schema

基于 Claude Code 官方文档的完整配置结构：

**General**
```typescript
interface GeneralSettings {
  model?: string;
  availableModels?: string[];
  modelOverrides?: Record<string, string>;
  language?: string;
  autoUpdatesChannel?: 'stable' | 'beta';
  alwaysThinkingEnabled?: boolean;
  fastModePerSessionOptIn?: boolean;
  showTurnDuration?: boolean;
  prefersReducedMotion?: boolean;
  plansDirectory?: string;
  outputStyle?: string;
  cleanupPeriodDays?: number;
  respectGitignore?: boolean;
  includeGitInstructions?: boolean;
  includeCoAuthoredBy?: boolean;
  terminalProgressBarEnabled?: boolean;
  spinnerTipsEnabled?: boolean;
  spinnerTipsOverride?: {
    excludeDefault?: boolean;
    tips?: string[];
  };
  spinnerVerbs?: {
    mode?: 'append' | 'replace';
    verbs?: string[];
  };
  statusLine?: {
    type: 'command';
    command: string;
  };
  fileSuggestion?: {
    type: 'command';
    command: string;
  };
  apiKeyHelper?: string;
  forceLoginMethod?: 'claudeai' | 'console';
}
```

**Permissions**
```typescript
interface PermissionSettings {
  allow?: string[];   // e.g. ["Bash(npm run *)", "Read", "Edit(/docs/**)"]
  ask?: string[];     // e.g. ["Bash(git push *)"]
  deny?: string[];    // e.g. ["Bash(curl *)", "Read(./.env)"]
  defaultMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions';
  additionalDirectories?: string[];
  disableBypassPermissionsMode?: 'disable';
}
```

权限规则语法：
- `Tool` — 匹配所有该工具的调用
- `Tool(pattern)` — 带 glob 模式匹配
- `Bash(npm run *)` — Bash 命令模式
- `Read(/src/**/*.ts)` — 项目根目录相对路径
- `Read(~/.zshrc)` — Home 目录路径
- `Read(//abs/path)` — 文件系统绝对路径
- `WebFetch(domain:github.com)` — 域名限制
- `mcp__server__tool` — MCP 工具
- `Agent(Explore)` — 子代理控制

评估顺序: deny -> ask -> allow，第一个匹配生效。

**Sandbox**
```typescript
interface SandboxSettings {
  enabled?: boolean;
  autoAllowBashIfSandboxed?: boolean;
  excludedCommands?: string[];
  allowUnsandboxedCommands?: boolean;
  filesystem?: {
    allowWrite?: string[];   // 路径前缀: // ~ / ./
    denyWrite?: string[];
    denyRead?: string[];
  };
  network?: {
    allowUnixSockets?: string[];
    allowAllUnixSockets?: boolean;
    allowLocalBinding?: boolean;
    allowedDomains?: string[];   // 支持通配符 e.g. "*.npmjs.org"
    allowManagedDomainsOnly?: boolean;
    httpProxyPort?: number;
    socksProxyPort?: number;
  };
  enableWeakerNestedSandbox?: boolean;
  enableWeakerNetworkIsolation?: boolean;
}
```

**Hooks**
```typescript
type HookEvent =
  | 'SessionStart' | 'SessionEnd'
  | 'InstructionsLoaded'
  | 'UserPromptSubmit'
  | 'PreToolUse' | 'PostToolUse' | 'PostToolUseFailure'
  | 'PermissionRequest'
  | 'Notification'
  | 'SubagentStart' | 'SubagentStop'
  | 'Stop'
  | 'PreCompact'
  | 'ConfigChange'
  | 'WorktreeCreate' | 'WorktreeRemove'
  | 'TaskCompleted'
  | 'TeammateIdle';

interface HookMatcher {
  tool?: string;      // e.g. "Bash", "Read", "mcp__server__tool"
  args?: string;      // glob pattern e.g. "npm run *"
  domain?: string;    // for WebFetch
  event?: string;     // for event-specific matching
}

interface CommandHook {
  type: 'command';
  command: string;
  matchers?: HookMatcher[];
  async?: boolean;
}

interface HttpHook {
  type: 'http';
  url: string;
  method?: string;
  matchers?: HookMatcher[];
  allowedEnvVars?: string[];
}

interface PromptHook {
  type: 'prompt';
  prompt: string;
  matchers?: HookMatcher[];
}

interface AgentHook {
  type: 'agent';
  agentPath: string;
  matchers?: HookMatcher[];
}

type HookHandler = CommandHook | HttpHook | PromptHook | AgentHook;

type HookSettings = Partial<Record<HookEvent, HookHandler | HookHandler[]>>;

// 顶层 hook 相关设置
interface HookGlobalSettings {
  hooks?: HookSettings;
  disableAllHooks?: boolean;
  allowManagedHooksOnly?: boolean;
  allowedHttpHookUrls?: string[];
  httpHookAllowedEnvVars?: string[];
}
```

**Attribution**
```typescript
interface AttributionSettings {
  commit?: string;   // commit message 后缀模板
  pr?: string;       // PR body 后缀模板
}
```
注: `includeCoAuthoredBy`（在 General 中）控制是否自动添加 Co-Authored-By 行。`attribution.commit` 用于自定义额外的 commit 署名格式。两者独立。

**MCP (服务器控制)**
```typescript
interface McpServerRule {
  serverName?: string;
  serverCommand?: string[];
  serverUrl?: string;
}

interface McpControlSettings {
  enableAllProjectMcpServers?: boolean;
  enabledMcpjsonServers?: string[];
  disabledMcpjsonServers?: string[];
  allowedMcpServers?: McpServerRule[];
  deniedMcpServers?: McpServerRule[];
  allowManagedMcpServersOnly?: boolean;
}
```
注: MCP 服务器的实际定义在 `.mcp.json` 中，settings.json 仅控制启用/禁用和访问规则。

**Plugins**
```typescript
interface PluginSettings {
  enabledPlugins?: Record<string, boolean>;  // 表单：toggle 列表
  pluginTrustMessage?: string;               // 表单：text input
  // 以下字段结构复杂且不常编辑，使用 raw JSON 编辑器
  extraKnownMarketplaces?: Record<string, unknown>;
  strictKnownMarketplaces?: unknown[];
  blockedMarketplaces?: unknown[];
}
```

**Environment**
```typescript
// JSON 路径: settings.json 顶层 "env" 字段
// e.g. { "env": { "CLAUDE_CODE_ENABLE_TELEMETRY": "1" } }
interface EnvSettings {
  [key: string]: string;   // 所有值为字符串类型
}
```

---

## 4. Interaction

### 4.1 导航
- 左侧分类点击：右侧内容渐变过渡 (200ms)
- 分类导航支持 URL 路由：`/settings/general`, `/settings/permissions` 等（使用 react-router-dom）
- 支持浏览器前进/后退

### 4.2 编辑
- **简单类型** (string, number, boolean): 直接表单输入
- **枚举类型** (defaultMode, autoUpdatesChannel 等): 下拉选择
- **数组类型** (permissions allow/deny/ask): 可添加/删除的列表 UI，每行一个规则
- **复杂对象** (hooks, sandbox): 结构化表单 + JSON 编辑器切换
- **键值对** (env, modelOverrides): 双列输入 (key + value)，可添加/删除行

**JSON 编辑器**: 使用 CodeMirror 6（`@codemirror/lang-json`），不使用 Monaco（体积过大）。用于：
- 表单/JSON 模式切换
- Plugins 中不常编辑的复杂字段
- 语法高亮 + 错误提示

**Hooks 编辑 UI 交互流程**:
1. 左侧列出已配置的事件（如 PreToolUse、Stop），每个事件显示 handler 数量
2. 点击事件展开 handler 列表，每个 handler 显示类型标签（command/http/prompt/agent）
3. 点击 handler 弹出编辑面板：选择 type → 填写对应字段 → 配置 matchers
4. "Add Hook" 按钮：先选事件 → 再选 handler 类型 → 填写配置
5. 每个 handler 卡片右上角有删除按钮

### 4.3 状态管理

**数据获取**: 使用 React Query (`@tanstack/react-query`)
- Query key: `['settings']`
- 初始加载时发起 `GET /api/settings`
- 保存成功后 invalidate query 刷新数据

**表单状态**: 单一 state 对象管理整个 settings
- 使用 `useState` 存储编辑中的 settings 副本
- 初始值来自 React Query 缓存
- dirty 检测：深比较 editState vs serverState（使用 `fast-deep-equal`）
- 切换分类时保留未保存的修改（不重置状态）
- 禁用 `refetchOnWindowFocus`，避免覆盖用户未保存的编辑

**Loading/Error 状态 UI**:
- **加载中**: 内容区显示骨架屏（skeleton），侧边栏可见但不可点击
- **加载失败**: 内容区显示错误信息 + 重试按钮
- **文件不存在** (`exists: false`): 显示空状态引导卡片，含 "Create settings.json" 按钮，点击后以 `{}` 初始化文件

**并发冲突**: 本期不处理。后续可加 file watcher 或 etag 校验。

### 4.4 保存
- **快捷键**: Cmd+S / Ctrl+S
- **按钮**: 底部右侧 "Save" 按钮
- **状态**:
  - 无改动: 按钮 disabled, 显示 "Saved"
  - 有改动: 按钮 enabled, 显示 "Unsaved changes"
  - 保存中: 按钮 loading, 显示 "Saving..."
  - 保存成功: 显示 "Saved" (2s 后消失)
  - 保存失败: 显示错误信息

### 4.5 验证
- JSON 格式验证
- 枚举字段值域检查
- 权限规则语法验证 (Tool(pattern) 格式)
- 路径前缀验证 (sandbox 的 //, ~/, /, ./ 前缀)
- 保存前检查语法错误

---

## 5. File Structure

```
packages/
├── shared/
│   └── src/
│       ├── settingsSchema.ts       # Zod schemas (替换现有 schemas.ts 中的 SettingsSchema)
│       └── index.ts                # 导出
├── cli/
│   └── src/
│       ├── server/
│       │   ├── routes/
│       │   │   ├── config.ts       # 现有 config 路由（保留）
│       │   │   └── settings.ts     # 新增: 读取/写入 settings.json
│       │   └── index.ts            # Fastify 服务器
│       └── index.ts                # CLI 入口
└── ui/
    └── src/
        ├── components/
        │   ├── settings/
        │   │   ├── SettingsLayout.tsx
        │   │   ├── SettingsSidebar.tsx
        │   │   ├── SettingsContent.tsx
        │   │   ├── GeneralSettings.tsx
        │   │   ├── PermissionsSettings.tsx
        │   │   ├── SandboxSettings.tsx
        │   │   ├── HooksSettings.tsx
        │   │   ├── AttributionSettings.tsx
        │   │   ├── McpSettings.tsx
        │   │   ├── PluginSettings.tsx
        │   │   └── EnvironmentSettings.tsx
        │   └── ui/                  # shadcn/ui 组件
        ├── hooks/
        │   └── useSettings.ts      # React Query: fetch/save settings
        └── App.tsx
```

---

## 6. API Endpoints

使用 Fastify 框架（现有项目使用）。

### GET /api/settings
读取当前项目的 settings.json

**Response**
```json
{
  "path": "/Users/xxx/project/.claude/settings.json",
  "content": { ... },
  "exists": true
}
```

### POST /api/settings
保存 settings.json

**Request**
```json
{
  "content": { ... }
}
```

**Response**
```json
{
  "success": true,
  "path": "/Users/xxx/project/.claude/settings.json"
}
```

### GET /api/settings/schema
获取 settings 的 JSON Schema（用于表单验证和字段元数据）

### Error Handling
- **文件不存在**: 返回 `exists: false`，UI 显示创建新配置的引导
- **读取失败**: 返回 error message，UI 显示错误提示
- **写入失败**: 返回 error message，UI 显示保存失败提示并保留内容
- **JSON 解析失败**: 显示语法错误，阻止保存

### Settings Location
- 仅处理项目级 `.claude/settings.json`（当前工作目录）
- 不处理全局设置 (`~/.claude/settings.json`) 和 managed settings

---

## 7. Implementation Priority

1. **Phase 1**: 基础布局 + General 设置 + API 读写
2. **Phase 2**: Permissions 表单（规则列表 UI）
3. **Phase 3**: Sandbox、Hooks 表单（结构化编辑）
4. **Phase 4**: MCP、Plugins、Attribution、Environment 表单
5. **Phase 5**: JSON 编辑器模式切换（表单 <-> raw JSON）
6. **Phase 6**: 保存快捷键 + 浅色模式

---

## 8. Acceptance Criteria

- [ ] 左侧分类导航 (8 类) 可点击切换右侧内容
- [ ] General 分类显示所有通用设置字段，枚举字段用下拉选择
- [ ] Permissions 分类显示 allow/ask/deny 三个规则列表，可添加/删除规则
- [ ] Hooks 分类显示事件列表，可添加/编辑 hook handler（支持 command/http/prompt/agent 四种类型）
- [ ] 输入框采用 Linear 风格 (深灰背景, 无边框)
- [ ] 有改动时底部显示 "Unsaved changes"
- [ ] Cmd+S 保存成功
- [ ] 深色/浅色主题可切换
- [ ] 文件不存在时显示创建引导
- [ ] 保存前验证权限规则语法和枚举值域
