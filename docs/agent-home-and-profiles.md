# Agent Home 与 Profile 使用指南

## 概述

ClaudeUI 是一个本地管理工具，用于管理 Claude Code 的扩展组件和配置。它围绕两个核心概念构建：**Store**（组件仓库）和 **Profile**（环境配置）。用户可以导入组件到本地仓库，组合成可复用的 Profile，并在不同环境之间安全切换。

## Agent Home

Agent Home 是 Claude Code 存储所有配置、插件和组件的根目录。

**配置方式：**
- 环境变量：`AGENT_HOME`
- 默认值：`~/.claude`

**目录结构：**

```
~/.claude/
├── agents/                # Agent 定义文件（.md）
├── skills/                # Skill 定义（含 SKILL.md 的目录）
├── commands/              # Command 定义文件（.md）
├── plugins/               # 已安装的插件
├── store/                 # 组件仓库（ClaudeUI 管理）
│   ├── agents/            # 仓库中的 Agent
│   ├── skills/            # 仓库中的 Skill
│   ├── commands/          # 仓库中的 Command
│   └── .metadata/
│       └── imports.json   # 导入来源追踪
├── profiles/              # Profile 定义和激活状态
│   ├── .active            # 当前激活的 Profile 标记
│   └── <profile-name>/    # 各 Profile 目录
│       ├── profile.json   # Profile 配置
│       ├── agents/        # → 指向 store 的符号链接
│       ├── skills/        # → 指向 store 的符号链接
│       ├── commands/      # → 指向 store 的符号链接
│       ├── .claude-plugin/  # 生成的插件文件
│       ├── hooks/         # Hooks 配置
│       ├── .mcp.json      # MCP 服务器配置
│       └── .lsp.json      # LSP 服务器配置
├── settings.json                        # 主设置文件
└── settings.backup.<profile>.json       # 各 Profile 的设置备份
```

## Store（组件仓库）

Store 是组件的规范存储位置，所有 Profile 从 Store 引用组件。

### 导入组件

从已有目录导入 Agent、Skill、Command 到 Store：

```bash
# API 调用
POST /api/store/import
Body: { "sourceDir": "/path/to/your/components", "dryRun": true }
```

**导入流程：**
1. 扫描源目录，发现所有 Agent、Skill、Command
2. 检测与现有组件的冲突
3. `dryRun: true` 模式仅返回预览结果，不实际导入
4. 正式导入时复制文件到 Store，并在 `imports.json` 中记录来源

**导入后自动追踪来源信息：**
- `importPath`：原始导入路径
- `importedAt`：导入时间

### 管理 Store 组件

| 操作 | API | 说明 |
|------|-----|------|
| 查看所有 Agent | `GET /api/store/agents` | 列出仓库中的 Agent |
| 查看 Agent 详情 | `GET /api/store/agents/:name` | 获取单个 Agent |
| 创建 Agent | `POST /api/store/agents` | 在仓库中创建 Agent |
| 编辑 Agent | `PUT /api/store/agents/:name` | 更新 Agent 内容 |
| 删除 Agent | `DELETE /api/store/agents/:name` | 删除 Agent（检查 Profile 引用） |

Skill 和 Command 的 API 结构相同，将路径中的 `agents` 替换为 `skills` 或 `commands` 即可。

> **注意：** 如果有 Profile 引用了某个组件，删除操作会返回 `409 Conflict` 并列出引用该组件的 Profile。可通过 `?force=true` 强制删除。

## Profile（环境配置）

Profile 是从 Store 组件组合而成的可复用工作环境。

### 创建 Profile

```bash
POST /api/profiles
Body: {
  "name": "my-profile",
  "description": "日常开发环境",
  "agents": ["reviewer", "debugger"],
  "skills": ["deploy", "test-runner"],
  "commands": ["commit", "review"],
  "plugins": ["some-plugin"],
  "settings": { "theme": "dark" },
  "hooks": { ... },
  "mcpServers": { ... },
  "lspServers": { ... }
}
```

**命名规则：** 仅允许 `[a-zA-Z0-9_-]`，保留名称不可使用：`store`、`.active`、`plugins`、`agents`、`skills`、`commands`。

### 编辑 Profile

```bash
PUT /api/profiles/:name
Body: { "description": "更新后的描述", "agents": ["reviewer"] }
```

支持部分更新，未提供的字段保持不变。

### 激活 Profile

激活 Profile 会将其组件和设置应用到 Agent Home：

```bash
POST /api/profiles/:name/activate
```

**激活流程（事务性，支持回滚）：**

```
请求 → 获取锁（防止并发激活）
     → 预检：确认所有组件存在于 Store
     → 停用当前激活的 Profile（如有）
     → 备份当前 settings.json
     → 写入 .active 标记文件
     → 创建符号链接（agents/skills/commands → store）
     → 生成插件文件（.claude-plugin, hooks, .mcp.json, .lsp.json）
     → 合并 Profile 设置到 settings.json
     → 释放锁
     → 返回成功 + 警告信息
```

**如果任何步骤失败，系统会按逆序回滚所有操作，恢复之前的状态。**

### 预检（Preflight）

在激活之前，可以先检查是否可以激活：

```bash
GET /api/profiles/:name/preflight
```

返回：
```json
{
  "canActivate": true,
  "missing": [],
  "settingsWarnings": ["将覆盖 settings.json 中的 theme 字段"],
  "currentActive": "old-profile"
}
```

### 停用 Profile

```bash
POST /api/profiles/:name/deactivate
```

**停用流程：**
1. 从备份恢复 `settings.json`
2. 删除所有符号链接
3. 删除生成的插件文件（`.claude-plugin/`、`hooks/`、`.mcp.json`、`.lsp.json`）
4. 删除 `.active` 标记
5. 清理备份文件

### 切换 Profile

直接调用新 Profile 的激活接口即可切换。系统会自动先停用当前 Profile，再激活新的 Profile。整个过程是事务性的 —— 如果激活失败，之前的状态会被恢复。

### 删除 Profile

```bash
DELETE /api/profiles/:name
```

> **注意：** 当前激活的 Profile 不可删除，会返回 `409 Conflict`。需要先停用。

## 当前环境查看

通过以下 API 查看 Agent Home 中的组件及其来源：

| API | 说明 |
|-----|------|
| `GET /api/agents` | 列出所有 Agent（含来源标签） |
| `GET /api/skills` | 列出所有 Skill（含来源标签） |
| `GET /api/commands` | 列出所有 Command（含来源标签） |
| `GET /api/plugins` | 列出已安装插件 |
| `GET /api/configs` | 查看环境配置 |

**来源标签（source）：**
- `local`：本地文件（非符号链接）
- `profile`：来自当前激活 Profile 的符号链接
- `plugin`：来自已启用的插件

## 错误码

| 状态码 | 含义 | 场景 |
|--------|------|------|
| `400` | 请求无效 | Profile 名称非法、JSON 格式错误 |
| `404` | 资源不存在 | Profile 或组件不存在 |
| `409` | 资源冲突 | Profile 已存在、组件被引用、活跃 Profile 不可删除 |
| `422` | 验证失败 | 激活时缺少 Store 组件（返回 `missing` 列表） |
| `423` | 资源锁定 | 另一个激活操作正在进行 |

## 典型工作流

```
1. 导入组件到 Store
   POST /api/store/import { sourceDir: "/path/to/components" }

2. 创建 Profile
   POST /api/profiles { name: "work", agents: [...], skills: [...] }

3. 预检激活
   GET /api/profiles/work/preflight

4. 激活 Profile
   POST /api/profiles/work/activate

5. 切换到另一个 Profile
   POST /api/profiles/personal/activate

6. 停用
   POST /api/profiles/personal/deactivate
```
