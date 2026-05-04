# ohmyc

一个带有 WebUI 的 CLI 工具，用于可视化展示和编辑 `.claude` 配置文件。

## 功能特性

- 可视化管理 `.claude` 目录下的所有配置文件
- 查看和编辑 `settings.json`、`CLAUDE.md`、hooks、MCP servers、commands、agents、skills、plugins 等
- 基于 React + shadcn/ui 的本地 Web 界面
- 通过 CLI 一键启动 WebUI

## 技术栈

- **CLI**: [cac](https://github.com/cacjs/cac)
- **WebUI**: React + [shadcn/ui](https://ui.shadcn.com/)
- **语言**: TypeScript
- **构建工具**: [Vite](https://vitejs.dev/) (WebUI) + [tsup](https://github.com/egoist/tsup) (CLI)
- **包管理器**: npm

## 安装

```bash
npm install -g ohmyc
```

## 使用

```bash
ohmyc
```

启动后会在本地开启一个 Web 服务，自动打开浏览器，你可以在界面中浏览和编辑 `.claude` 下的所有配置。

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build
```

## 许可证

[MIT](./LICENSE)
