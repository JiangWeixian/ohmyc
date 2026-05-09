# OhMyC 用户指南

## 目录

- [项目简介](#项目简介)
- [安装方式](#安装方式)
- [快速开始](#快速开始)
- [CLI 命令参考](#cli-命令参考)
- [WebUI 功能介绍](#webui-功能介绍)
  - [Agent Home（代理主页）](#agent-home代理主页)
  - [Profiles（配置文件管理）](#profiles配置文件管理)
  - [Store（组件仓库）](#store组件仓库)
  - [Settings（设置编辑器）](#settings设置编辑器)
- [配置说明](#配置说明)
  - [目录结构](#目录结构)
  - [各配置文件的作用](#各配置文件的作用)
- [环境变量](#环境变量)
- [常见问题（FAQ）](#常见问题faq)
- [故障排除](#故障排除)

---

## 项目简介

OhMyC 是一个带有 Web 界面的 CLI 工具，用于**可视化展示和管理 Claude Code 的配置文件**。

Claude Code 的配置分布在 `~/.claude/`（或项目级 `.claude/`）目录下，涉及 `settings.json`、agents、skills、commands、hooks、MCP servers、plugins 等多种文件和目录。手动管理这些配置既繁琐又容易出错。

OhMyC 解决了以下问题：

- **统一可视化管理**：在浏览器中查看和编辑所有 `.claude` 配置
- **多来源聚合**：自动合并全局（`~/.config/ohmyc/`）、项目级（`./.claude/`）和插件提供的配置项
- **Profile 切换**：通过 Profile 机制在不同工作环境之间快速切换 agents、skills、commands 等组件组合
- **Store 组件库**：集中管理可复用的 agents、skills、commands 和 model configs

---

## 安装方式

### 通过 npm 全局安装

```bash
npm install -g ohmyc
```

安装后会注册两个命令：`cu` 和 `ohmyc`，两者功能完全一致。

### 从源码安装

```bash
# 克隆仓库
git clone <repo-url> ohmyc
cd ohmyc

# 安装依赖（需要 pnpm）
pnpm install

# 构建（包括 UI 和 CLI）
pnpm build

# 使用
node packages/cli/dist/index.cjs
```

### 开发模式运行

```bash
# 同时启动 API 服务和 UI 开发服务器（热更新）
pnpm dev
```

---

## 快速开始

1. **启动服务**：

   ```bash
   cu
   ```

   这会在本地启动 HTTP 服务（默认端口 3000），并自动打开浏览器。

2. **浏览配置**：在浏览器中查看 Agent Home 页面，左侧边栏列出所有可浏览的分区。

3. **切换到 Profiles**：点击顶部的 **Profiles** 标签，进入配置文件管理页面。

4. **创建 Store 组件**：在 Profiles 页面侧边栏选择 Components → Agents / Skills / Commands，点击 **New** 按钮创建新组件。

5. **创建并激活 Profile**：点击 **New Profile**，选择要包含的 agents、skills、commands 等组件，保存后点击 **Activate** 激活。

---

## CLI 命令参考

OhMyC 的 CLI 入口命令为 `cu`（或 `ohmyc`），基于 [cac](https://github.com/cacjs/cac) 解析命令行参数。

### `cu`（默认命令）

直接运行 `cu` 即可启动应用，等效于 `cu start`。

```bash
cu
```

### `cu start`

启动 OhMyC 服务器并打开浏览器。

```bash
cu start [选项]
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--port <port>` | `3000` | 指定监听端口，必须在 0-65535 之间 |
| `--api-only` | `false` | 仅启动 API 服务，不提供静态文件服务，也不自动打开浏览器 |

**示例**：

```bash
# 使用默认端口 3000 启动
cu start

# 指定端口
cu start --port 8080

# 仅启动 API（适合前端开发联调）
cu start --api-only
```

> 如果指定端口被占用，服务会自动尝试 `port`、`port+1`、`port+2`、随机端口。

### 其他

```bash
cu --help       # 显示帮助信息
cu --version    # 显示版本号（当前为 0.1.0）
```

---

## WebUI 功能介绍

OhMyC 的 Web 界面包含两个主视图，通过顶部的 **Agent Home** / **Profiles** 切换器进行切换。

### Agent Home（代理主页）

路径：`/explore`（默认跳转到 `/explore/agents`）

Agent Home 是配置浏览视图，左侧边栏包含以下分区：

#### Agents

查看所有可用的 agent 定义。每个 agent 以卡片形式展示，显示名称、描述和来源标记。

- **来源类型**：`local`（全局 `~/.config/ohmyc/agents/`）、`plugin`（插件提供）、`project`（项目级 `./.claude/agents/`）
- 点击卡片可查看 agent 的完整内容（Markdown 格式的 frontmatter + 正文）
- Agent 的 frontmatter 支持的字段包括：`name`、`description`、`model`、`tools`、`disallowedTools`、`permissionMode`、`maxTurns`、`skills`、`memory`、`background`、`effort`、`isolation`、`mcpServers`、`hooks`

#### Skills

查看所有可用的 skill 定义。Skill 是 Claude 能力的扩展，每个 skill 提供特定任务的专用指令。

- 展示字段包括：名称、描述、是否为 fork 模式（`context: fork`）、是否禁用模型调用（`disable-model-invocation`）
- Skill frontmatter 还支持：`argument-hint`、`user-invocable`、`allowed-tools`、`model`、`effort`、`agent`、`hooks`

#### Commands

查看所有自定义斜杠命令（slash commands）。命令以 `/command-name` 形式展示。

- 显示命令名称、描述、参数提示（`argument-hint`）
- 命令可以在 Claude Code 中通过 `/command-name` 调用

#### Plugins

查看已安装的插件列表，展示每个插件的：

- 名称和 ID
- 启用/禁用状态
- 捆绑的组件数量（agents、skills、commands）
- 安装次数
- 所属 Marketplace
- 引用该插件的 Profile 列表

页面顶部还展示当前环境的摘要信息（Hooks、MCP Servers、LSP Servers 的数量）。

#### Hooks

查看配置中的所有 hooks（事件钩子）。Hooks 来自三个来源：

- `local`：来自 `~/.config/ohmyc/settings.json` 中的 `hooks` 字段
- `plugin`：来自插件的 `hooks/hooks.json`
- `project`：来自项目的 `settings.json`

每个 hook 显示：事件名称、matcher（匹配器）、type、command，以及来源标记。

#### MCP Servers

查看所有 Model Context Protocol 服务器配置。来源包括：

- `local`：来自 `~/.config/ohmyc/.mcp.json`
- `plugin`：来自插件的 `.mcp.json`
- `project`：来自项目的 `.mcp.json`

每个 MCP Server 以卡片形式展示其 JSON 配置。

#### LSP Servers

查看所有 Language Server Protocol 服务器配置。来源包括：

- `local`：来自 `~/.config/ohmyc/.lsp.json`
- `plugin`：来自插件的 `.lsp.json`
- `project`：来自项目的 `.lsp.json`

### Profiles（配置文件管理）

路径：`/profiles`

Profiles 是 OhMyC 的核心功能，允许你创建可复用的配置组合，并在不同工作环境之间快速切换。

#### 侧边栏结构

- **My Profiles**：已创建的 Profile 列表，当前激活的 Profile 会显示 "Active" 标记
- **New Profile**：创建新的 Profile
- **Components**：
  - **Agents**：管理 Store 中的 agent 组件
  - **Skills**：管理 Store 中的 skill 组件
  - **Commands**：管理 Store 中的 command 组件
  - **Model Configs**：管理 Store 中的模型配置

#### Profile 详情页

选中一个 Profile 后，显示其详细信息：

**基本信息**：
- 名称、描述
- 当前是否激活
- 操作按钮：Edit、Activate/Deactivate、Delete

**Components（组件）**：
- Agents：Profile 包含的 agent 列表
- Skills：Profile 包含的 skill 列表
- Commands：Profile 包含的 command 列表
- Plugins：Profile 包含的 plugin 列表
- Model Config：Profile 关联的模型配置（显示 provider、API key 脱敏值、base URL）

**Runtime config（运行时配置）**：
- Hooks：Profile 定义的 hooks 配置键
- MCP：Profile 定义的 MCP servers 配置键
- LSP：Profile 定义的 LSP servers 配置键
- Settings：Profile 定义的 settings 覆盖键

#### Profile 编辑器

创建或编辑 Profile 时提供以下配置区域：

1. **Basics**：名称（创建后不可修改）、描述
2. **Selections**：选择要包含的组件
   - Agents：从 Store 中勾选
   - Skills：从 Store 中勾选
   - Commands：从 Store 中勾选
   - Plugins：从已安装插件中勾选
   - Model Config：从 Store 中的模型配置选择一个
3. **Runtime config**：以 JSON 编辑器配置运行时覆盖
   - Hooks：定义事件钩子（如 `preToolUse`、`postToolUse`）
   - MCP Servers：定义 MCP 服务器
   - LSP Servers：定义 LSP 服务器
   - Settings Overlay：定义设置覆盖（如 model、effort）

#### Profile 激活流程

激活 Profile 时会进行 **预检（Preflight）**：

1. 检查 Profile 引用的所有 Store 组件是否存在
2. 检查是否已有其他 Profile 处于激活状态
3. 检查 Settings 是否有冲突
4. 检查 Model Config 的环境变量变更

根据预检结果，可能显示以下对话框：

- **ConfirmSwitchDialog**：当前已有活跃 Profile，确认切换
- **ActivateConfirmDialog**：存在 Settings 覆盖警告，确认继续
- **ActivationBlockedDialog**：缺少必要的 Store 组件，阻止激活

激活操作会：
1. 获取操作锁（防止并发激活）
2. 自动停用当前活跃 Profile（如果存在）
3. 备份当前 `settings.json`
4. 创建 agents/skills/commands 的符号链接到 Profile 目录
5. 生成插件文件和 hooks/MCP/LSP 配置
6. 合并 settings 和 Model Config 环境变量
7. 写入 `.active` 标记文件

如果激活过程中出错，会自动回滚所有操作。

### Store（组件仓库）

Store 是 OhMyC 管理可复用组件的集中仓库，位于 `~/.config/ohmyc/store/`。

#### 组件列表页

在 Profiles 侧边栏的 Components 区域选择任一类型，进入组件列表页：

- **搜索**：按名称搜索组件
- **类型筛选**：下拉菜单过滤 agents/skills/commands/model-configs
- **创建**：点击 **New** 按钮创建新组件
- **导入**：点击 **Import Components** 从外部目录批量导入

每个组件显示：
- 类型、名称、描述
- 被哪些 Profile 引用
- 来源信息（如果是从外部导入的，显示导入路径和导入时间）
- 编辑和删除操作

#### 组件编辑器

创建或编辑 Store 组件：

- **Name**：组件名称（仅创建时可编辑，需匹配 `[a-zA-Z0-9_-]`）
- **Description**：组件描述（agents 必填）
- **Content (Markdown)**：组件正文内容（系统提示或技能内容）

#### Model Config 编辑器

Model Config 是特殊的 Store 组件，用于定义 API 连接预设：

- **Name**：配置名称
- **API Key**：API 密钥（编辑时显示脱敏值）
- **Base URL**：API 基础 URL
- **Model Name**（可选）：模型名称
- **Provider**（可选）：提供商名称

激活 Profile 时，Model Config 会注入以下环境变量到 `settings.json`：
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_BASE_URL`
- `API_TIMEOUT_MS`（固定 3000000）
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`（固定 1）
- `ANTHROPIC_MODEL`（如果指定了 modelName）

#### 导入功能

从外部 Claude 兼容目录导入组件到 Store：

1. 输入源目录路径（如 `/path/to/.claude`）
2. 系统会扫描该目录下的 `agents/`、`skills/`、`commands/` 子目录
3. 预览扫描结果，显示冲突项
4. 无冲突时自动导入；有冲突时可选择 **Overwrite All** 覆盖

导入支持 **预演模式（dry run）**，仅预览不实际写入。

删除组件时，如果该组件被某个 Profile 引用，会弹出确认对话框提示。

### Settings（设置编辑器）

> 注意：Settings 编辑器目前在 Agent Home 视图中作为 Settings 分区可访问（`activeSection === 'settings'`），但当前版本仅实现了 **General** 分类。

#### 侧边栏分类

| 分类 | 说明 |
|------|------|
| General | 通用设置（已实现） |
| Permissions | 权限设置（开发中） |
| Sandbox | 沙箱设置（开发中） |
| Hooks | 钩子设置（开发中） |
| Attribution | 归属设置（开发中） |
| MCP | MCP 控制设置（开发中） |
| Plugins | 插件设置（开发中） |
| Environment | 环境变量设置（开发中） |

#### General 设置

如果 `settings.json` 不存在，页面会显示 **Create settings.json** 按钮。

已实现的 General 设置项：

**Model 区域**：
- **Model**：默认使用的模型（如 `claude-opus-4-5-20250514`）
- **Available Models**：可用模型列表（逗号分隔）

**UI 区域**：
- **Auto Updates Channel**：自动更新通道（`stable` / `beta`）
- **Always Thinking Enabled**：始终启用思维模式
- **Show Turn Duration**：显示对话轮次耗时
- **Prefers Reduced Motion**：减少动画效果

支持 **Cmd+S / Ctrl+S** 快捷键保存。

#### Settings Schema 支持的完整字段

虽然 UI 目前只实现了 General 分类，但后端 schema 支持以下所有分类：

| 分类 | 主要字段 |
|------|----------|
| general | model, availableModels, language, autoUpdatesChannel, alwaysThinkingEnabled, showTurnDuration, prefersReducedMotion, outputStyle, cleanupPeriodDays 等 |
| permissions | allow, ask, deny, defaultMode, additionalDirectories |
| sandbox | enabled, autoAllowBashIfSandboxed, excludedCommands, filesystem, network |
| hooks | 事件钩子配置 |
| attribution | commit, pr |
| mcpControl | enableAllProjectMcpServers, enabledMcpjsonServers, disabledMcpjsonServers |
| plugins | enabledPlugins, extraKnownMarketplaces |
| env | 环境变量键值对 |

---

## 配置说明

### 目录结构

OhMyC 管理两个主要目录：

```
~/.config/ohmyc/                          # OhMyC 托管数据目录（WRITE_DIR）
├── settings.json                # 设置文件
├── agents/                      # 全局 agents
│   └── my-agent.md
├── skills/                      # 全局 skills
│   └── my-skill/
│       └── SKILL.md
├── commands/                    # 全局 commands
│   └── my-command.md
├── store/                       # 组件仓库
│   ├── agents/                  # Store 中的 agents
│   ├── skills/                  # Store 中的 skills
│   ├── commands/                # Store 中的 commands
│   ├── model-configs/           # Model Config 配置文件
│   │   └── my-config.json
│   └── .metadata/
│       └── imports.json         # 导入来源记录
├── profiles/                    # Profile 定义
│   ├── .active                  # 当前激活的 Profile 标记
│   └── my-profile/
│       ├── profile.json         # Profile 配置
│       ├── agents/              # 激活时创建的符号链接
│       ├── skills/
│       ├── commands/
│       ├── .claude-plugin/      # 生成的插件文件
│       ├── hooks/
│       ├── .mcp.json
│       └── .lsp.json
├── settings.backup.json         # settings 备份
└── settings.backup.<name>.json  # 每个 Profile 的 settings 备份

~/.claude/                       # Claude Code 原始目录（只读）
├── settings.json                # Claude Code 设置
├── plugins/                     # 已安装的插件
│   └── <marketplace>/
│       └── <plugin-name>/
│           ├── plugin.json
│           ├── agents/
│           ├── skills/
│           ├── commands/
│           ├── hooks/
│           ├── .mcp.json
│           └── .lsp.json
├── .mcp.json                    # MCP 服务器配置
└── .lsp.json                    # LSP 服务器配置

./.claude/                       # 项目级配置（可选）
├── agents/                      # 项目级 agents
├── skills/                      # 项目级 skills
├── commands/                    # 项目级 commands
├── settings.json                # 项目级设置
├── .mcp.json                    # 项目级 MCP 配置
└── .lsp.json                    # 项目级 LSP 配置
```

### 各配置文件的作用

| 文件 | 作用 |
|------|------|
| `settings.json` | 主设置文件，包含 general、permissions、sandbox、hooks、mcpControl、plugins、env 等配置 |
| `.mcp.json` | MCP 服务器配置，定义外部工具和服务 |
| `.lsp.json` | LSP 服务器配置，提供代码智能 |
| `agents/*.md` | Agent 定义文件（Markdown frontmatter + 正文） |
| `skills/*/SKILL.md` | Skill 定义（目录结构，每个 skill 一个目录） |
| `commands/*.md` | 自定义斜杠命令定义 |
| `profiles/*/profile.json` | Profile 配置（组件引用 + 运行时配置） |
| `store/model-configs/*.json` | Model Config 定义（API Key、Base URL 等） |
| `store/.metadata/imports.json` | 组件导入来源追踪 |

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AGENT_HOME` | `.claude` | 覆盖 Claude Code 配置目录名（同时影响全局和项目级） |
| `OHMYC_HOME` | `.cui` | 覆盖 OhMyC 写入目录名 |

**示例**：如果想使用 `.agent` 代替 `.claude`：

```bash
AGENT_HOME=.agent cu
```

---

## 常见问题（FAQ）

### Q: `cu` 和 `ohmyc` 命令有什么区别？

没有区别，两者是同一个 CLI 工具的不同入口名称。

### Q: OhMyC 会修改我的 `~/.claude/` 目录吗？

不会。OhMyC 从 `~/.claude/plugins/` **读取**插件信息，但所有写入操作都在 `~/.config/ohmyc/` 目录下进行。Profile 激活时修改的是 `~/.config/ohmyc/settings.json`，而非 `~/.claude/settings.json`。

### Q: 什么是 Profile？

Profile 是一组 Store 组件（agents、skills、commands）、插件和运行时配置（hooks、MCP、LSP、settings 覆盖）的命名组合。激活 Profile 后，这些组件会通过符号链接和配置合并的方式生效。

### Q: Profile 名称有什么限制？

- 只能包含字母、数字、下划线和连字符（`[a-zA-Z0-9_-]`）
- 以下名称被保留，不可使用：`store`、`.active`、`plugins`、`agents`、`skills`、`commands`

### Q: 可以同时激活多个 Profile 吗？

不可以。同一时间只能有一个活跃 Profile。激活新 Profile 时会自动停用当前活跃的 Profile。

### Q: 删除 Profile 会删除 Store 中的组件吗？

不会。删除 Profile 仅删除 Profile 的组合定义，Store 中的 agents、skills、commands 等组件不受影响。

### Q: 可以删除当前活跃的 Profile 吗？

不可以。需要先停用（Deactivate）Profile，然后才能删除。

### Q: Store 组件的命名有什么规则？

Agents、Skills、Commands 的名称必须匹配 `[a-zA-Z0-9_-]+`。Model Config 的名称允许包含点号和斜杠（`[a-zA-Z0-9_./-]+`），但不能包含 `..`。

### Q: 端口被占用怎么办？

OhMyC 会自动尝试 `port`、`port+1`、`port+2`、然后随机端口。控制台会显示实际使用的端口。

### Q: 如何只启动 API 服务（不打开浏览器）？

```bash
cu start --api-only
```

这在需要自行管理前端开发服务器的场景下很有用。

---

## 故障排除

### 服务启动失败

**症状**：运行 `cu` 后报错 "Failed to start OhMyC"

**排查步骤**：
1. 检查端口是否被占用：`lsof -i :3000`
2. 尝试指定其他端口：`cu start --port 8080`
3. 检查 Node.js 版本（需要支持 ESM）

### UI 无法访问

**症状**：服务启动成功但浏览器显示空白或 404

**排查步骤**：
1. 检查控制台是否显示 "Serving static files from: ..." 日志
2. 如果是开发模式，确保 UI 包也已构建：`pnpm build`
3. 使用 `--api-only` 模式单独启动 API，确认 API 是否正常：`curl http://localhost:3000/health`

### Profile 激活失败

**症状**：点击 Activate 后显示 "Cannot activate profile: missing store components"

**原因**：Profile 引用了 Store 中不存在的组件。

**解决方法**：
1. 在 Store 中创建缺失的组件
2. 或编辑 Profile，移除对不存在组件的引用

### Profile 激活时提示 "Another activation is in progress"

**原因**：存在未释放的操作锁（可能是之前的激活操作异常中断）。

**解决方法**：等待几秒后重试。锁文件位于 `~/.config/ohmyc/profiles/` 目录下的 lock 文件中，也可手动删除。

### Settings 保存失败

**症状**：修改设置后点击 Save 报错

**排查步骤**：
1. 检查 `~/.config/ohmyc/` 目录的写权限
2. 检查 settings.json 是否为有效的 JSON
3. 查看浏览器开发者工具的 Network 面板，确认 API 返回的错误信息

### 组件导入失败

**症状**：Import Components 对话框中点击导入后报错

**排查步骤**：
1. 确认源目录路径正确
2. 确认源目录包含标准的 `agents/`、`skills/`、`commands/` 子目录
3. 检查目标 Store 目录的写权限
4. 如果存在冲突，尝试使用 **Overwrite All** 选项

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd+K` / `Ctrl+K` | 打开命令面板（Command Palette） |
| `Cmd+S` / `Ctrl+S` | 保存当前编辑的 Settings |
| `Esc` | 关闭对话框/命令面板 |

### API 端点参考

OhMyC 后端提供以下 REST API 端点：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/agents` | 列出所有 agents |
| GET | `/api/agents/:name` | 获取单个 agent |
| GET | `/api/skills` | 列出所有 skills |
| GET | `/api/skills/:name` | 获取单个 skill |
| GET | `/api/commands` | 列出所有 commands |
| GET | `/api/commands/:name` | 获取单个 command |
| GET | `/api/plugins` | 列出已安装插件 |
| GET | `/api/plugins/:id` | 获取单个插件 |
| GET | `/api/marketplaces` | 列出已知 marketplaces |
| GET | `/api/marketplaces/:id` | 获取单个 marketplace |
| GET | `/api/mcp` | 列出所有 MCP servers |
| GET | `/api/hooks` | 列出所有 hooks |
| GET | `/api/lsp` | 列出所有 LSP servers |
| GET | `/api/settings` | 读取 settings.json |
| POST | `/api/settings` | 写入 settings.json |
| GET | `/api/settings/schema` | 获取 settings 的 JSON Schema |
| GET | `/api/profiles` | 列出所有 profiles |
| POST | `/api/profiles` | 创建 profile |
| GET | `/api/profiles/:name` | 获取单个 profile |
| PUT | `/api/profiles/:name` | 更新 profile |
| DELETE | `/api/profiles/:name` | 删除 profile |
| GET | `/api/profiles/:name/preflight` | Profile 激活预检 |
| POST | `/api/profiles/:name/activate` | 激活 profile |
| POST | `/api/profiles/:name/deactivate` | 停用当前活跃 profile |
| GET | `/api/store/agents` | 列出 Store agents |
| POST | `/api/store/agents` | 创建 Store agent |
| GET | `/api/store/agents/:name` | 获取 Store agent |
| PUT | `/api/store/agents/:name` | 更新 Store agent |
| DELETE | `/api/store/agents/:name` | 删除 Store agent |
| GET | `/api/store/skills` | 列出 Store skills |
| POST | `/api/store/skills` | 创建 Store skill |
| GET | `/api/store/skills/:name` | 获取 Store skill |
| PUT | `/api/store/skills/:name` | 更新 Store skill |
| DELETE | `/api/store/skills/:name` | 删除 Store skill |
| GET | `/api/store/commands` | 列出 Store commands |
| POST | `/api/store/commands` | 创建 Store command |
| GET | `/api/store/commands/:name` | 获取 Store command |
| PUT | `/api/store/commands/:name` | 更新 Store command |
| DELETE | `/api/store/commands/:name` | 删除 Store command |
| GET | `/api/store/model-configs` | 列出 Store model configs |
| POST | `/api/store/model-configs` | 创建 Store model config |
| GET | `/api/store/model-configs/:name` | 获取 Store model config |
| PUT | `/api/store/model-configs/:name` | 更新 Store model config |
| DELETE | `/api/store/model-configs/:name` | 删除 Store model config |
| POST | `/api/store/import` | 从外部目录导入组件 |

> agents/skills/commands 的 GET 请求支持 `source`、`pluginId`、`scope` 查询参数来指定来源。
> Store 组件的 DELETE 请求支持 `force=true` 查询参数来强制删除被 Profile 引用的组件。
