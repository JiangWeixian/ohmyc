# 设置页（quota / 菜单栏 / 主题）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/explore/settings` 设置页与 OhMyC 应用级设置存储，让普通用户不碰环境变量即可管理 8 个 quota provider 开关、轮询间隔、菜单栏图标和主题（issue #31，含前置 #30 与配套 #32）。

**Architecture:** 所有设置存 `~/.config/ohmyc/settings.json`（sparse、原子写入），core 提供纯函数 resolve 层（env > 设置文件 > 默认值），每项返回「生效值 + 来源 + env 名」。Rust poller 每轮重读 resolve 并可被写入唤醒；前端经 `settings.get`/`settings.set` wire 与 `settings:changed` 事件保持双窗口同步；主题桌面端迁到设置文件（localStorage 一次性按字段迁移），无后端时回退 localStorage。

**Tech Stack:** Rust（ohmyc-core、Tauri v2 desktop）、React + TanStack Query、vitest（unit + storybook）、现有 `components/ui`（switch/select/button）。无新依赖、无数据库。

**Spec:** `docs/superpowers/specs/2026-10-31-settings-page-design.md`

**分支:** `feat/settings-page`（基于 `origin/next`，MR 回 `next`）。

## Global Constraints

- 优先级严格为 **环境变量 > 设置文件 > 默认值**；env 值非法时忽略该 env（沿用现有 `poll_interval()` 语义）。
- 默认值：**quota 总开关 `enabled=true`**；claude `enabled=false`（保持 opt-in），其余 7 个 provider `enabled=true`；`pollSecs=300`（仅 env/文件，不上 UI）；`menubarIconVisible=true`；主题 `phosphor` / `expressive`（以 `packages/ui/src/theme/registry.ts` 的实际 id 为准：`monitor|phosphor|amber|retro|cyberpunk`；强度不上设置页）。
- 某 provider 被轮询 = 总开关开 **且** 该 provider 开（`quota_enabled && provider_enabled(p)`）；总开关关闭时所有 provider 停止轮询且各勾选状态保留。
- serde 一律 camelCase；Rust `SnapshotStatus`/`ResolvedSettings` 与前端 TS 类型同步修改（`use-quota.ts` 头注释要求保持同步）。
- 菜单栏图标开关仅在 macOS 开放 UI；#30 的 Reopen 处理先于该开关交付。
- 遵循 PRODUCT.md：不做成控制面板式表单堆砌；控件复用 `packages/ui/src/components/ui/`，不引入新组件库。
- 验证基线：`cargo clippy --all-targets --all-features -- -D warnings`（先 `rustup show active-toolchain` 确认 pinned 版本）、`pnpm build`、`pnpm --filter @ohmyc/ui test`、`pnpm --filter @ohmyc/ui test:storybook`。
- Rust env 相关单测必须用现有 `EnvGuard`（`crates/ohmyc-core/src/quota/testutil.rs`）并串行，沿用现有测试模式。

## Review Focus

以下失败模式 spec 未逐项展开，但最容易咬到真实用户；每行已归入对应 task 的测试步骤：

1. **非法 env 值**：`OHMYC_QUOTA_POLL_SECS=0/abc`、`OHMYC_QUOTA_CODEX_ENABLED=maybe` → 忽略 env，走文件/默认（Task 2 测试）。`OHMYC_THEME=不存在的 id` → 前端回退默认主题而不是白屏（Task 7 测试）。
2. **设置文件损坏 JSON**：resolve 按全默认处理、app 正常启动，`settings.set` 仍能写入修复文件（Task 2 测试）。
3. **bool env 的显式禁用**：`OHMYC_QUOTA_CLAUDE_ENABLED=0` 是「env 显式禁用」（source=env），不是「未设置」；老用户 `=1` 行为不变（Task 2 测试）。
4. **popover 挂起错过 `settings:changed`**：隐藏期间改的设置，popover 重新可见时必须自愈（Task 6 的 visibility/focus invalidate，仿 `use-quota.ts` 现有模式）。
5. **迁移覆盖用户已有设置**：文件里已有 `theme.id` 时，localStorage 旧值不得覆盖它；`id`/`intensity` 按字段独立判断（Task 7 测试）。

---

### Task 1: #30 — 从「应用程序」重开回到主窗口（macOS Reopen）

**Files:**
- Modify: `packages/desktop/src-tauri/src/main.rs:216`（`.run(...)` 改为 `.build(...)` + `app.run` 事件循环）

**Interfaces:**
- Consumes: 现有 `ohmyc_desktop_lib::windows::open_main_window(app: AppHandle) -> Result<(), String>`（已具备「已存在则 show + set_focus」逻辑）。
- Produces: `RunEvent::Reopened` → `open_main_window`。后续 Task 5 的菜单栏隐藏依赖此行为。

- [ ] **Step 1: 改造事件循环**

`main.rs` 中 `tauri::Builder... .run(tauri::generate_context!())` 改为 `.build(tauri::generate_context!())` 后 `app.run(|app_handle, event| ...)`，在 `#[cfg(target_os = "macos")]` 分支匹配 `tauri::RunEvent::Reopened { .. }` 时调用 `open_main_window(app_handle.clone())`，忽略错误时写一行 `quota_poller::log_line("ui-events.log", ...)`（复用现有日志模式）。其余事件不做处理。

- [ ] **Step 2: 编译与静态检查**

Run: `cargo check -p ohmyc-desktop && cargo clippy -p ohmyc-desktop --all-targets -- -D warnings`
Expected: 通过。此行为由 OS 分发、无单测锚点，真机验证在 Task 9 验收清单中（关主窗口 → 从「应用程序」打开 → 主窗口出现并前置；已打开时仅前置，无第二个窗口）。

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/main.rs
git commit -m "fix(desktop): reopen main window from macOS Reopen event (#30)"
```

### Task 2: core::settings 重写 — 存储 + resolve 层

**Files:**
- Modify: `crates/ohmyc-core/src/settings.rs`（整体重写；旧 Claude settings.json 读写废弃，前端已确认无引用）
- Test: 同文件 `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: `crate::store::base_dir() -> Result<PathBuf, ApiError>`；`crate::quota::types::QuotaProvider`（`QuotaProvider::ALL`）。
- Produces（后续 task 依赖的确切签名）:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)] #[serde(rename_all = "camelCase")]
pub enum SettingSource { Env, Settings, Default }

#[derive(Debug, Clone, Serialize)] #[serde(rename_all = "camelCase")]
pub struct ResolvedSetting<T> { pub value: T, pub source: SettingSource, pub env_var: Option<&'static str> }

#[derive(Debug, Clone, Serialize)] #[serde(rename_all = "camelCase")]
pub struct ResolvedSettings {
    pub quota_enabled: ResolvedSetting<bool>,
    pub quota_poll_secs: ResolvedSetting<u64>,
    pub providers: std::collections::BTreeMap<QuotaProvider, ResolvedSetting<bool>>,
    pub menubar_icon_visible: ResolvedSetting<bool>,
    pub theme_id: ResolvedSetting<String>,
    pub theme_intensity: ResolvedSetting<String>,
}
impl ResolvedSettings { pub fn provider_enabled(&self, p: QuotaProvider) -> bool }

#[derive(Debug, Default, Deserialize)] #[serde(rename_all = "camelCase")]
pub struct SettingsPatch { /* 全 Option 的 sparse 字段：quota.enabled、quota.pollSecs、quota.providers.<id>.enabled、menubar.iconVisible、theme.id、theme.intensity */ }

pub const DEFAULT_POLL_SECS: u64 = 300;
pub fn settings_path() -> Result<PathBuf, ApiError>;          // base_dir()/settings.json
pub fn write_patch(patch: &SettingsPatch) -> Result<(), ApiError>; // merge 进现有文件 + temp-file rename 原子写
pub fn resolve() -> ResolvedSettings;                          // read_file + 进程 env
pub fn resolve_with(file: &AppSettingsFile, env: &dyn Fn(&str) -> Option<String>) -> ResolvedSettings; // 纯函数
```

- env 名：总开关 `OHMYC_QUOTA_ENABLED`；provider `OHMYC_QUOTA_<NAME>_ENABLED`（claude/codex/cursor/gemini/grok/kimi/glm 大写；opencodeGo → `OHMYC_QUOTA_OPENCODE_ENABLED`）、`OHMYC_QUOTA_POLL_SECS`、`OHMYC_MENUBAR_ICON_ENABLED`、`OHMYC_THEME`、`OHMYC_THEME_INTENSITY`。
- bool env 解析：`1|true|yes|on` → true；`0|false|no|off` → false；其他 → None（忽略 env）。
- `read_file`（私有）：文件不存在或 JSON 损坏都返回全 Option::None 的默认 `AppSettingsFile`。
- `theme_id`/`theme_intensity` 的 env 仅做 trim 非空过滤，合法性由前端校验（Task 7）。

- [ ] **Step 1: 写失败测试**（`resolve_with` 注入 env，无需 EnvGuard）

```rust
#[test] fn defaults_when_nothing_set() // 全默认：总开关 true、claude false、codex true、poll 300、menubar true、theme "phosphor"/"expressive"，source 全 Default
#[test] fn file_overrides_default()    // file 写 claude.enabled=true → value true, source Settings
#[test] fn env_overrides_file()        // file claude=true + env CLAUDE_ENABLED=0 → value false, source Env, env_var Some
#[test] fn invalid_env_ignored()       // POLL_SECS="0"/"abc"、CODEX_ENABLED="maybe" → 走 file/default
#[test] fn explicit_env_disable_is_env_source() // CLAUDE_ENABLED=0 且 file 无值 → false + source Env（不是 Default）
#[test] fn corrupt_file_falls_back_to_defaults() // read_file 对损坏 JSON 返回默认；write_patch 后可正常 resolve
```

- [ ] **Step 2: 运行确认失败**

Run: `cargo test -p ohmyc-core settings`
Expected: 编译失败（`resolve_with` 等不存在）。

- [ ] **Step 3: 实现 `settings.rs` 重写**

schema 用嵌套 struct + `Option` 字段（sparse）；`write_patch` 读出旧文件、按 Some 字段覆盖、`version: 1`、临时文件 + rename 写入（参照旧实现注释的原子写模式）。

- [ ] **Step 4: 运行确认通过**

Run: `cargo test -p ohmyc-core settings`
Expected: 6 个新测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/settings.rs
git commit -m "feat(core): app settings storage with env > file > default resolution (#31)"
```

### Task 3: quota 接入开关 — `SnapshotStatus::Disabled` + `fetch_all(enabled)`

**Files:**
- Modify: `crates/ohmyc-core/src/quota/types.rs:82`（新增 `Disabled` 变体，无字段）
- Modify: `crates/ohmyc-core/src/quota/mod.rs:65`（`fetch_all` 签名）
- Modify: `crates/ohmyc-core/src/quota/providers/claude.rs:25-60`（删除 `polling_enabled`/`DISABLED_MESSAGE` 及 fetch 内检查）
- Modify: `packages/ui/src/hooks/use-quota.ts:37`（TS union 加 `| { status: 'disabled' }`）
- Test: `crates/ohmyc-core/src/quota/mod.rs` 测试模块

**Interfaces:**
- Consumes: Task 2 的 `ResolvedSettings::provider_enabled`（由 Task 4 的 poller 传入闭包）。
- Produces: `pub fn fetch_all(&self, enabled: &dyn Fn(QuotaProvider) -> bool) -> Vec<UsageSnapshot>`——disabled 的 provider 直接 `UsageSnapshot::with_status(provider, SnapshotStatus::Disabled)`，不发请求；serde 输出 `"status": "disabled"`。`fetch(provider)` 单provider签名不变。

- [ ] **Step 1: 改失败测试**

现有 `fetch_all_returns_eight_snapshots_in_fixed_order` 与 `fetch_single_provider_matches_fetch_all_entry` 改为传 `&|_| true`。新增：

```rust
#[test] fn disabled_providers_return_disabled_without_fetch() // fetch_all(&|_| false) → 8 个快照全 Disabled、顺序仍固定
#[test] fn per_provider_disable_only_affects_that_provider() // 仅 claude false → claude Disabled，其余不是 Disabled
#[test] fn disabled_never_merges_stale() // merge_stale 输入 Disabled + 历史有数据 → 不合并（keeps_stale_data 不含 Disabled）
```

- [ ] **Step 2: 运行确认失败**

Run: `cargo test -p ohmyc-core quota`
Expected: 编译失败（`fetch_all` 参数缺失）/ 新测试失败。

- [ ] **Step 3: 实现**

`fetch_all` 内对每个 provider 先查 `enabled(provider)`；`claude.rs` 删除本地开关逻辑与对应旧测试（开关语义已由 registry 层覆盖）；`types.rs` 加变体；前端 TS union 同步。

- [ ] **Step 4: 运行确认通过**

Run: `cargo test -p ohmyc-core && pnpm --filter @ohmyc/ui test`
Expected: PASS（前端仅类型扩展，无行为变化）。

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/quota packages/ui/src/hooks/use-quota.ts
git commit -m "feat(quota): per-provider enable switches with Disabled status (#31)"
```

### Task 4: poller — 每轮 resolve + 可唤醒

**Files:**
- Modify: `packages/desktop/src-tauri/src/quota_poller.rs:41-48,207-235`（删 `poll_interval()`，循环改造）
- Modify: `packages/desktop/src-tauri/src/main.rs:211-212`（manage `PollerWake`）

**Interfaces:**
- Consumes: Task 2 `ohmyc_core::settings::resolve()`、Task 3 `fetch_all(&dyn Fn)`。
- Produces: `pub struct PollerWake(pub std::sync::mpsc::Sender<()>);`（Tauri state，Task 5 的 `settings_set` 通过它唤醒）；poller 循环每轮：`let settings = resolve()` → `refresh_now` 用 `|p| settings.quota_enabled.value && settings.provider_enabled(p)` 拉取（总开关关闭时全部 provider 得 `Disabled`，不再发请求）→ `rx.recv_timeout(Duration::from_secs(settings.quota_poll_secs.value))`，唤醒或超时都进入下一轮（即唤醒 = 立即按新设置刷新一轮）。

- [ ] **Step 1: 改造循环与唤醒通道**

`spawn_poller` 创建 `mpsc::channel<()>`，Sender 包进 `PollerWake` 由调用方 `app.manage(...)`；`refresh_now` 需要拿到 enabled 闭包——把 `refresh_now` 改为内部先 `resolve()` 再 fetch（保持其现有签名 `refresh_now(app: &AppHandle) -> Vec<UsageSnapshot>` 不变，手动刷新路径自动获得同样语义）。

- [ ] **Step 2: 编译 + 现有测试**

Run: `cargo test -p ohmyc-desktop && cargo clippy -p ohmyc-desktop --all-targets -- -D warnings`
Expected: 现有 poller 测试（merge_stale 等）PASS。唤醒时序属线程/OS 行为，真机验证在 Task 9（改间隔后刷新节奏立刻按新值走）。
注意：`DEFAULT_POLL_SECS` 改从 `ohmyc_core::settings` re-export 或替换引用，不留两份默认值。

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src
git commit -m "feat(desktop): resolve settings each poll cycle and wake poller on change (#31)"
```

### Task 5: Tauri commands + `settings:changed` + tray 显隐

**Files:**
- Modify: `packages/desktop/src-tauri/src/api/settings.rs`（重写为 app 设置 command）
- Modify: `packages/desktop/src-tauri/src/main.rs:83-147,209-213`（setup 末尾应用初始 tray 可见性）
- Test: `packages/desktop/src-tauri/src/api/settings.rs` 测试模块（patch 校验逻辑）

**Interfaces:**
- Consumes: Task 2 `resolve()`/`write_patch()`、Task 4 `PollerWake`。
- Produces:
  - `#[tauri::command] pub fn settings_get() -> Result<ResolvedSettings, ApiError>`（wire `settings.get`，签名参数变化无影响——前端无旧引用）
  - `#[tauri::command] pub fn settings_set(app: AppHandle, patch: SettingsPatch) -> Result<ResolvedSettings, ApiError>`：`write_patch` → 若 `menubar.iconVisible` 有值则 `apply_menubar_visibility` → `app.state::<PollerWake>().0.send(())` → 重新 `resolve()` 并 `app.emit("settings:changed", &resolved)` → 返回 resolved。
  - `pub const SETTINGS_CHANGED_EVENT: &str = "settings:changed";`
  - `fn apply_menubar_visibility(app: &AppHandle, visible: bool)`：`app.tray_by_id("main")` → `set_visible(visible)`，无 tray 时忽略。
- 启动时：setup 中 tray 构建完成后按 `resolve().menubar_icon_visible.value` 调一次 `apply_menubar_visibility`。

- [ ] **Step 1: 写 patch 校验的失败测试**

```rust
#[test] fn patch_rejects_zero_poll_secs() // pollSecs=0 → ApiError::Validation
#[test] fn patch_rejects_unknown_theme_intensity() // intensity 非 calm/expressive → Validation
```

- [ ] **Step 2: 运行确认失败**

Run: `cargo test -p ohmyc-desktop settings`
Expected: 编译失败（新 command 不存在）。

- [ ] **Step 3: 实现 commands + tray 副作用 + 启动应用**

旧 `settings_get(_project)/settings_set(content, _project)` 替换为上述签名；`main.rs` 注册保持不变（同名 command）。tray 显隐不区分平台的 Rust 实现（UI 只在 macOS 暴露，Task 8）。

- [ ] **Step 4: 运行确认通过**

Run: `cargo test -p ohmyc-desktop && cargo clippy -p ohmyc-desktop --all-targets -- -D warnings`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/src
git commit -m "feat(desktop): settings commands, settings:changed event, tray visibility (#31 #32)"
```

### Task 6: 前端 settings 数据层 + mock transport

**Files:**
- Create: `packages/ui/src/hooks/use-app-settings.ts`
- Modify: `packages/ui/src/lib/transport/mock.ts`（加 `settings.get`/`settings.set` 内存实现）
- Test: `packages/ui/src/tests/use-app-settings.test.tsx`（沿用 `src/tests` 现有测试模式）

**Interfaces:**
- Consumes: `request`（`@/lib/transport`）、`subscribe`（`@/lib/tauri-event-bridge`，非 Tauri no-op 的现有模式）、Task 5 的 wire 契约。
- Produces:

```ts
export type SettingSource = 'env' | 'settings' | 'default'
export interface ResolvedSetting<T> { value: T; source: SettingSource; envVar: string | null }
export interface ResolvedSettings {
  quotaEnabled: ResolvedSetting<boolean>
  quotaPollSecs: ResolvedSetting<number>
  providers: Record<QuotaProviderId, ResolvedSetting<boolean>> // key 与 use-quota.ts 的 QuotaProviderId 一致
  menubarIconVisible: ResolvedSetting<boolean>
  themeId: ResolvedSetting<string>
  themeIntensity: ResolvedSetting<string>
}
export interface SettingsPatch { quota?: { enabled?: boolean; pollSecs?: number; providers?: Partial<Record<QuotaProviderId, { enabled: boolean }>> }; menubar?: { iconVisible?: boolean }; theme?: { id?: string; intensity?: string } }
export const SETTINGS_QUERY_KEY = ['app-settings'] as const
export function useAppSettings(): UseQueryResult<ResolvedSettings>   // settings.get + subscribe('settings:changed') 写 cache + visibility/focus 时 invalidate（自愈挂起窗口）
export function useUpdateSettings(): (patch: SettingsPatch) => Promise<ResolvedSettings> // settings.set → setQueryData 返回值
```

- mock 默认值与 Global Constraints 一致（含 `quotaEnabled: true`）；mock `settings.set` 合并 patch 后返回新 resolved（source 变 `settings`）。

- [ ] **Step 1: 写失败测试**

```ts
it('returns defaults from settings.get')      // claude false / codex true / poll 300 / theme phosphor
it('useUpdateSettings merges patch and updates cache') // set claude enabled → providers.claude.value true, source 'settings'
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @ohmyc/ui test`
Expected: 失败（模块不存在）。

- [ ] **Step 3: 实现 hook + mock 分支**

事件订阅与自愈逻辑仿 `use-quota.ts` 的 try/catch 动态 import 模式。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @ohmyc/ui test`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/hooks/use-app-settings.ts packages/ui/src/lib/transport/mock.ts packages/ui/src/tests/use-app-settings.test.tsx
git commit -m "feat(ui): app settings hook with settings:changed sync and mock transport (#31)"
```

### Task 7: 主题迁到设置文件 + localStorage 一次性迁移 + env 覆盖

**Files:**
- Modify: `packages/ui/src/theme/theme-provider.tsx`（双模式：settings 文件 / localStorage 回退）
- Modify: `packages/ui/src/theme/use-theme-commands.tsx`（env 覆盖时标注且不切换）
- Test: `packages/ui/src/tests/theme-settings.test.tsx`

**Interfaces:**
- Consumes: Task 6 `request('settings.get'/'settings.set')`（直接经 `request`，不依赖 React Query——ThemeProvider 在 QueryClient 之外也能用）；`registry.ts` 的 `themes`/`intensities` 校验表。
- Produces: `useTheme()` 返回值扩展为 `{ theme, intensity, setTheme, setIntensity, sources: { theme: SettingSource; intensity: SettingSource } }`（`sources` 默认全 `'default'`，非 Tauri 回退时也是）。`setTheme/setIntensity` 签名不变。

- 行为：
  - 初始化 `request('settings.get')` 成功 → 文件模式：theme/intensity 取 resolved 值（经 `themes`/`intensities` 校验，非法回退默认），并做**按字段一次性迁移**：某字段 `source === 'default'` 且 localStorage `ohmyc-theme` 有对应合法值 → `settings.set` 写该字段。
  - `request` 失败 → localStorage 模式（现有 `loadPersistedTheme`/`persistTheme` 行为完全不变）。
  - 文件模式下 `setTheme` = `settings.set({ theme: { id } })` 后更新本地状态；`sources` 来自最近一次 resolved。
- [ ] **Step 1: 写失败测试**

```ts
it('migrates localStorage theme when file has no theme')      // localStorage amber + mock 默认 → theme 'amber'，且 settings 文件被写入
it('does not migrate over an existing file theme')            // mock 预置 theme.id=monitor + localStorage amber → theme 仍 'monitor'
it('migrates intensity independently of id')                  // 文件只有 id → 仅 intensity 从 localStorage 迁移
it('falls back to default for unknown env theme id')          // mock 预置 themeId source env、value 'nonexistent' → theme 回退 'phosphor'，sources.theme==='env'
it('localStorage mode unchanged when settings.get fails')     // mock 抛错 → 走 loadPersistedTheme
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @ohmyc/ui test`
Expected: 失败（`sources` 未实现等）。

- [ ] **Step 3: 实现双模式 provider + ⌘K 覆盖标注**

`use-theme-commands.tsx`：`sources.theme === 'env'` 时主题命令项 label 追加「（被环境变量覆盖）」且 action 不切换；intensity 同理。现有 localStorage 相关测试保持通过。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @ohmyc/ui test && pnpm --filter @ohmyc/ui test:storybook`
Expected: PASS（既有 story 不回归）。

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/theme packages/ui/src/tests/theme-settings.test.tsx
git commit -m "feat(theme): persist theme in app settings with localStorage migration (#31)"
```

### Task 8: 设置页 UI — 路由 + 三分区 + env 覆盖标注

**Files:**
- Create: `packages/ui/src/routes/settings-page.tsx`（页面组装 + 无后端时只渲染外观分区）
- Create: `packages/ui/src/components/settings/quota-section.tsx`、`menubar-section.tsx`、`appearance-section.tsx`
- Modify: `packages/ui/src/components/nav-items.ts:17,28`（`NavItemId` 加 `'settings'`，`NAV_ITEMS` 末尾加 `{ id: 'settings', path: '/explore/settings', label: 'Settings', icon: Settings, keycap: 'E' }`，icon 来自 lucide-react）
- Modify: `packages/ui/src/app-shell.tsx`（加 `<Route path="/explore/settings" element={<ExplorerLayout><SettingsPage /></ExplorerLayout>} />`）
- Test: `packages/ui/src/stories/product/settings-page.stories.tsx`（参照 `src/stories/product/` 现有 story 模式）

**Interfaces:**
- Consumes: Task 6 `useAppSettings`/`useUpdateSettings`、Task 7 `useTheme`、`registry.ts` 的 `themes`/`intensities`、`components/ui/{switch,select,button}`、`use-quota.ts` 的 `QuotaProviderId`。
- Produces: `/explore/settings` 路由（nav-items 与路由同步的既有单测自动覆盖）。

- 行为要点（按定稿原型，单栏两分区）：
  - **Quota 区**：标题右侧总开关（`quotaEnabled`，Switch，关闭时卡片网格整体变暗不可点）；8 张 provider 卡片（两列网格），卡片含 `@lobehub/icons` mono 品牌图标 + 名称 + 状态行，整卡可点切换 `providers[id]`，右上角勾表示启用（无亮色边框、不用 Switch）；状态行来自 `useQuota` 快照。
  - **Appearance 区**：5 张主题卡片（色带预览 + 名称描述，右上角勾表示选中，走 `useTheme`）；下方「Show menu bar icon」配置行（仅 macOS + Tauri 显示，平台判断 `navigator.platform`/`userAgent` 含 Mac）：Switch 关闭时先展开 inline 确认区——文案说明「从应用程序/Dock/Spotlight 重新打开 OhMyC 即可回到主窗口，设置中可重新开启图标」+ 确认/取消按钮，确认后才写入。
  - 轮询间隔与主题强度不上页面。
  - 任一项 `source === 'env'`：控件 disabled + 标注「由环境变量 `envVar` 覆盖，当前生效值：`value`」。
  - `useAppSettings` 查询失败（无后端）：只渲染主题卡片。
- [ ] **Step 1: 写 story + play 测试（先失败）**

stories：默认视图、总开关关闭视图（卡片网格变暗）、env 覆盖视图（mock 预置 `quotaEnabled.source='env'`）、无后端视图。play 断言：8 张卡片渲染；点击 claude 卡片后右上角出现勾且 mock 状态更新；总开关关闭后网格带 `all-off` 类；env 覆盖的总开关为 disabled 且显示 env 名。

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @ohmyc/ui test:storybook`
Expected: 失败（组件不存在）。

- [ ] **Step 3: 实现页面与分区**

视觉按 DESIGN.md 现有页面密度与排版；不新建 dialog 组件（菜单栏确认为 inline 区域）。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @ohmyc/ui test && pnpm --filter @ohmyc/ui test:storybook && pnpm build`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src
git commit -m "feat(ui): settings page with quota, menubar and appearance sections (#31 #32)"
```

### Task 9: 验收 + changeset + 交付

**Files:**
- Create: `.changeset/<name>.md`（按仓库 changeset 惯例，minor，覆盖 desktop 与 ui 包）
- Modify: 无产品代码（此 task 只验证；发现问题回到对应 task 修）

- [ ] **Step 1: CI 等效检查**

Run: `rustup show active-toolchain`（确认 pinned）→ `cargo clippy --all-targets --all-features -- -D warnings` → `pnpm build` → `pnpm --filter @ohmyc/ui test:storybook`
Expected: 全绿。

- [ ] **Step 2: 真机验收（`pnpm --filter @ohmyc/desktop dev` 或现有桌面启动命令）**

对照 issue 逐条：
- #31：开 Claude → 下一轮 Quota 页出现 Claude 数据；关闭 → 不再请求且显示已禁用；总开关关闭 → 全部 provider 停止轮询，重开后各勾选状态保留；设 `OHMYC_QUOTA_POLL_SECS` 后轮询节奏按 env 走（界面无该项）；重启 app 全部设置保留；设 `OHMYC_QUOTA_ENABLED=0` 后总开关显示被覆盖且控件禁用；模拟 0.1.0 localStorage 主题 → 升级后主题不变。
- #30：关主窗口 → 从「应用程序」打开 → 主窗口出现；重复打开只前置不新建。
- #32：隐藏图标前出现找回说明；隐藏后 quota 仍刷新；从「应用程序」打开回主窗口并可重新开启图标。

- [ ] **Step 3: 新增 changeset 并提交**

```bash
git add .changeset docs/superpowers
git commit -m "chore: changeset and design docs for settings page"
```

- [ ] **Step 4: 推送并开 MR 回 `next`**（使用项目 create-mr skill / `gh pr create --base next`）

---

## Self-Review 记录

- Spec 覆盖：存储/resolve（T2）、provider 开关与 Disabled（T3）、poller 立即生效（T4）、commands/事件/tray（T5）、双窗口同步（T5+T6）、主题迁移与 web 降级（T7）、设置页与导航（T8）、#30 前置（T1）、验收清单（T9）。spec 的「新增 OHMYC_* env」全部落在 T2 的 env 名清单。
- 类型一致性：`ResolvedSettings`/`ResolvedSetting<T>`/`SettingsPatch` 在 T2 定义，T5/T6 复用同名；`provider_enabled` 仅 T2 定义、T4 消费；`PollerWake` T4 定义、T5 消费；`SETTINGS_CHANGED_EVENT="settings:changed"` T5 定义、T6 订阅同名。
- Review Focus 五项分别归入 T2（1/2/3）、T6（4）、T7（5，另有 1 的主题部分）。
