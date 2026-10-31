---
"@ohmyc/desktop": minor
"@ohmyc/ui": minor
---

新增设置页（/explore/settings）：quota 总开关与 8 个 provider 的独立轮询开关、主题选择、菜单栏图标显隐（隐藏前提示找回方式）。设置存于 `~/.config/ohmyc/settings.json`，环境变量优先并在界面标注覆盖；主题从 localStorage 自动迁移，升级不丢选择。macOS 从「应用程序」重新打开现在会回到主窗口。
