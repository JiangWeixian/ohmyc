# 设置页：界面里配置 quota、菜单栏和主题 — 设计文档

日期：2026-10-31
关联 issue：#31（本设计主体）、#32（菜单栏图标隐藏）、#30（重开主窗口，前置依赖）
开发基准：`next` 分支（0.2.0）；`develop` 为 0.1.0，不在本设计范围。

## Intent / Why

从 Dock/Finder 启动的 app 读不到 shell 环境变量，导致 Claude quota 开关和轮询间隔对普通用户等于不可用。0.2.0 的核心目标：**普通用户不碰环境变量也能管好 quota 行为**。本设计新增一个设置页和一套 OhMyC 自己的应用设置存储，把 quota 开关、轮询间隔、菜单栏图标、主题收进界面。

## Goals

- 新增独立路由 `/explore/settings`，Explorer 侧边导航一项，与 Monitor、Timeline、Quota 并列；⌘K「Go to」自动接入。
- 设置项：**quota 总开关**（一键启停全部轮询）、8 个 quota provider 各自的启用开关、菜单栏图标开关、主题。轮询间隔与主题强度**不上设置页**（轮询间隔保留 `OHMYC_QUOTA_POLL_SECS` 环境变量，强度仍走 ⌘K）。
- 改完立即生效，不用重启；重启后保留。
- 每项设置的取值优先级：**环境变量 > 设置文件 > 默认值**。被环境变量覆盖的项在界面上明确标注（环境变量名 + 当前生效值），控件禁用，不让用户误以为界面改动生效。
- 从 0.1.0 升级后主题保持用户原来的选择（localStorage 迁移）。

## Non-goals

- quota 累计用量与历史曲线（#29）。
- provider 凭据的录入/管理界面（凭据发现逻辑维持现状）。
- 设置的导入/导出、多 profile。
- web 模式的完整设置页（web 没有 Rust 后端，仅保证现有功能不回归；见「web 降级」）。

## Anti-goals

- 做成传统控制面板式的表单堆砌（PRODUCT.md 明确禁止「heavy configuration-admin UI」）。
- 为每个 provider 单独设轮询间隔（全局一个值，与现状一致）。
- 设置项写入 Claude 的 `settings.json`（那是 Claude 的配置，不是 OhMyC 的）。

## Constraints

- 遵循 DESIGN.md 视觉体系与 PRODUCT.md 产品原则；WCAG 2.1 AA、`prefers-reduced-motion`。
- 菜单栏图标可隐藏必须以 #30（从「应用程序」重开回到主窗口）为前提，否则用户会丢失 app 入口（#32）。
- 现有环境变量行为保持兼容：`OHMYC_QUOTA_CLAUDE_ENABLED=1` 的老用户行为不变；`OHMYC_QUOTA_POLL_SECS` 保留。
- 主窗口与菜单栏 popover 是两个独立窗口，设置变更要两边都生效。

## Approaches（已选定）

| 方案 | 说明 | 取舍 | 结论 |
|---|---|---|---|
| 一、全部集中到 Rust 设置文件 | 所有设置（含主题）存 Rust 侧文件，统一 resolve 层返回「生效值 + 来源」 | 单一事实源、env 覆盖语义统一；代价是主题需迁移、web 需降级 | **选定**（用户拍板） |
| 二、按消费方拆分 | Rust 消费的设置进文件，主题留 localStorage | 改动小，但存储两处、主题无 env 覆盖 | 否决 |
| 三、纯前端 localStorage | Rust 靠前端同步设置 | 同步脆弱、双窗口复杂 | 否决 |

## 存储与 Schema

新设置文件：`ohmyc_core::store::base_dir()/settings.json`（即现有的 `~/.config/ohmyc/` 目录，与 `quota-cache.json` 同目录）。原子写入（临时文件 + rename），复用现有模式。

**sparse 存储**：只写用户显式设置过的字段，缺失字段走默认值。带 `version` 字段便于未来迁移。

```json
{
  "version": 1,
  "quota": {
    "enabled": true,
    "pollSecs": 300,
    "providers": {
      "claude": { "enabled": true },
      "codex": { "enabled": false }
    }
  },
  "menubar": { "iconVisible": false },
  "theme": { "id": "amber-crt", "intensity": "calm" }
}
```

旧 `crates/ohmyc-core/src/settings.rs`（读写 Claude `settings.json` 的模块）**废弃重写**为 OhMyC 应用设置模块；`packages/desktop/src-tauri/src/api/settings.rs` 的旧 command 一并移除。已确认前端无任何 `settings_get/settings_set` 引用，无其他调用方。

## 设置项、环境变量与默认值

resolve 结果每项返回 `{ value, source: "env" | "settings" | "default", envVar }`，供界面展示覆盖状态。env 值非法时忽略该 env（沿用现有 `poll_interval()` 对非法值回落的语义）。

| 设置项 | 环境变量 | 取值 | 默认值 |
|---|---|---|---|
| **quota 总开关** | `OHMYC_QUOTA_ENABLED` | `1` 启用 / `0` 禁用，未设置不覆盖 | 启用 |
| provider 开关 ×8 | `OHMYC_QUOTA_<PROVIDER>_ENABLED`（Claude 的已存在） | `1` 启用 / `0` 禁用，未设置不覆盖 | **claude：禁用**（保持 opt-in 现状）；其余 7 个：启用 |
| 轮询间隔（仅 env/文件，不上 UI） | `OHMYC_QUOTA_POLL_SECS`（已存在） | 秒，>0 | 300 |
| 菜单栏图标 | `OHMYC_MENUBAR_ICON_ENABLED` | `1` 显示 / `0` 隐藏 | 显示 |
| 主题 | `OHMYC_THEME` | theme id | `phosphor`（与 registry 现状一致） |
| 主题强度（仅 env/文件，不上 UI） | `OHMYC_THEME_INTENSITY` | `calm` / `expressive` | `expressive` |

总开关与单 provider 开关是「与」的关系：某 provider 被轮询 = 总开关开 **且** 该 provider 开。总开关关闭时所有 provider 停止轮询，各 provider 的勾选状态保留。

provider id 到 env 名的映射：`codex → OHMYC_QUOTA_CODEX_ENABLED`、`cursor → OHMYC_QUOTA_CURSOR_ENABLED`、`gemini → OHMYC_QUOTA_GEMINI_ENABLED`、`glm → OHMYC_QUOTA_GLM_ENABLED`、`grok → OHMYC_QUOTA_GROK_ENABLED`、`kimi → OHMYC_QUOTA_KIMI_ENABLED`、`opencodeGo → OHMYC_QUOTA_OPENCODE_ENABLED`。

## 各模块改造

### Rust：poller 与 provider 开关

- `quota_poller` 每轮循环开始时重新 resolve 轮询间隔和 provider 开关。
- 「立即生效」的确切语义：`settings_set` 写入后**唤醒 poller 当前休眠**，立即重算间隔；provider 开关发生变更时立即触发一轮刷新（开启的 provider 马上拉数据，禁用的马上显示「已禁用」卡片），而不是等旧周期结束。实现用可唤醒的等待（如 channel + timeout），取代裸 `thread::sleep`。
- `QuotaRegistry::fetch_all` 每轮接收 resolved 的启用集合（由 poller 传入，core 保持可测试、不依赖 Tauri state）。
- 新增 `SnapshotStatus::Disabled` 变体：被禁用的 provider 不发请求，快照中保留该状态，UI 卡片显示「已在设置中禁用」。serde camelCase 契约同步更新 `use-quota.ts` 的 TS 类型。`Disabled` 不参与 stale 合并（与 `NotLoggedIn`/`Unsupported` 同类）。
- 现有 `claude.rs` 里直接读 `OHMYC_QUOTA_CLAUDE_ENABLED` 的逻辑迁移到统一 resolve 层。

### Rust：菜单栏图标

- `settings_set` 写入后立即应用 tray 显隐副作用。
- 隐藏前，前端弹确认说明找回方式：从「应用程序」/Dock/Spotlight 重新打开 OhMyC 即回主窗口，可在设置里重新开启图标（#32 验收）。
- **依赖 #30**：macOS `RunEvent::Reopened` → `open_main_window`，保证图标隐藏后 app 找得回来。实施顺序上 #30 先行或同批交付。
- 平台范围：找回路径（#30/#32）本次只在 macOS 完整实现与验收；Windows/Linux 的菜单栏开关本次不展示（设置项与存储结构是全平台的，待各平台有等价找回入口后再开放）。

### Tauri commands 与事件

- `settings_get()` → 完整 resolved 视图（每项生效值 + source + envVar + 文件中的原始值）。
- `settings_set(patch)` → 校验、原子写入、应用副作用（tray 显隐），然后广播 `settings:changed` 事件（携带完整 resolved 视图）。
- 主窗口与 popover 都订阅 `settings:changed`，前端设置状态以事件为准保持双窗口一致。

### 主题迁移与 web 降级

- 桌面端主题事实源从 localStorage 改为设置文件；`theme-provider` 在 Tauri 环境改经 settings command 读写，并订阅 `settings:changed`。
- **一次性迁移**：前端启动时按字段分别迁移——`theme.id` 与 `theme.intensity` 各自判断：该字段 resolved 来源为 `default` 且 localStorage 的 `ohmyc-theme` 中有对应值，才把该字段写入设置文件（一个字段被 env 覆盖不影响另一字段迁移）。这样 0.1.0 升级用户主题不丢。迁移后 localStorage 键保留（web 降级仍用），桌面端不再读它。
- **web 降级**：非 Tauri 环境（web dev、storybook、vitest）维持现有 localStorage 路径，主题功能不变。web 下设置路由与导航入口**保留**，但设置页只渲染「外观」分区（主题在 web 可用）；Quota 与菜单栏分区仅在有 Tauri 后端时显示。
- 主题被 `OHMYC_THEME`/`OHMYC_THEME_INTENSITY` 覆盖时，设置页与 ⌘K 的对应项都标注覆盖并禁用切换。

### 设置页 UI

定稿原型（经用户逐轮评审）：单栏垂直两个分区，配置项内部 label 左、控件右。

- 路由 `/explore/settings`，`NAV_ITEMS` 增加一项（含 ⌘K Go to）；新增 `g` 系列快捷键，避开已占用的 `g m/a/s/c/t` 及 quota 现有键。
- **Quota 分区**：标题右侧一个**总开关**（一键启停全部轮询；关闭时 8 张卡片整体变暗不可点，各卡片勾选状态保留）；下方 8 张 provider 卡片（两列网格）——卡片带 agent 品牌图标（`@lobehub/icons` mono，与 `agent-glyph.tsx` 同源）、名称、状态行，**整卡可点、右上角勾表示启用**（不用 switch、不做亮色边框），未选中图标变暗。
- **Appearance 分区**：5 张主题卡片（色带预览 + 名称描述，选中同样用右上角勾），下方一行「Show menu bar icon」配置卡（switch 控制图标显隐；说明其为 quota popover 入口、隐藏后台仍刷新）。菜单栏开关属于界面偏好，故放本区。隐藏前 inline 展开找回方式确认（见上）。
- 轮询间隔与主题强度**不出现在设置页**。
- 被 env 覆盖的项：控件禁用 + 标注「由环境变量 `X` 覆盖，当前生效值 Y」。
- web 模式保留设置页入口，只渲染 Appearance 的主题部分（quota 区与菜单栏行需 Tauri 后端）。
- 视觉遵循 DESIGN.md；控件优先复用现有 UI 组件，避免引入新组件库。

## 实施顺序建议

1. #30：Reopen 回主窗口（菜单栏隐藏的前置）。
2. core：设置存储 + resolve 层 + 单测；poller/provider 接入；tray 显隐。
3. Tauri commands + `settings:changed` 事件。
4. 主题：provider 改造 + localStorage 一次性迁移 + web 降级。
5. 设置页 UI + 导航/快捷键 + story。
6. 对照 issue #31/#32 验收清单逐项验证。

## 测试与验收

- core 单测：resolve 优先级（env > 文件 > 默认）、非法 env 值忽略、sparse 文件缺省字段、原子写入、Disabled 状态不参与 stale 合并。
- 迁移测试：文件无 theme + localStorage 有值 → 写入文件；文件已有 theme → 不覆盖。
- UI：设置页 story + `pnpm --filter @ohmyc/ui test:storybook`；主题 env 覆盖的展示。
- CI 按 AGENTS.md：`cargo clippy --all-targets --all-features -- -D warnings`（pinned toolchain）、`pnpm build`。
- issue #31 验收清单逐条过：开关 Claude 后下一轮 Quota 页出现数据、关闭后不再请求；改间隔后刷新节奏按新值；重启保留；env 覆盖标注；0.1.0 升级主题不变。

## 留给 builder 的部分

- 设置页的具体视觉排布与文案（在 DESIGN.md 体系内发挥）。
- `g` 快捷键的具体键位（避开已占用即可）。
- Disabled 状态卡片的具体样式。

## 本设计中由助手拍板、待用户确认的决定

1. 设置文件放 `~/.config/ohmyc/settings.json`（与 quota 缓存同目录），sparse 存储。
2. 轮询间隔与主题强度不上设置页（用户定稿）；轮询间隔仅保留 env 覆盖。
3. 新增 `SnapshotStatus::Disabled` 让被禁用 provider 在 Quota 页显示「已禁用」卡片，而非从列表消失。
4. `opencodeGo` 的环境变量名用 `OHMYC_QUOTA_OPENCODE_ENABLED`。
5. 主题迁移由前端启动时完成（Rust 读不到 localStorage），`id`/`intensity` 按字段分别迁移。
6. 新增 `OHMYC_QUOTA_ENABLED`（总开关）/ `OHMYC_THEME` / `OHMYC_THEME_INTENSITY` / `OHMYC_MENUBAR_ICON_ENABLED` 环境变量。
7. 「立即生效」= 写入后唤醒 poller 当前休眠，开关变更立即触发一轮刷新，不等旧周期结束。
8. 菜单栏图标开关本次只在 macOS 开放；Windows/Linux 待有等价找回入口后再开放。
9. web 模式保留设置页入口，只显示主题部分。
10. 设置页视觉定稿：Quota 区（总开关 + 勾选自卡片）+ Appearance 区（主题卡片 + 菜单栏图标行）；菜单栏图标开关归 Appearance。
