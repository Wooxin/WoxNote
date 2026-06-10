# WoxNote

轻量级、本地优先的笔记应用，基于 Tauri + React 构建。笔记库就是普通文件夹，放到 OneDrive 目录下即可实现原生文件同步，无需额外插件。

## 开发

在 Windows 上，从 **x64 Native Tools Command Prompt for VS** 启动，确保 Rust 能找到 MSVC `link.exe`：

```powershell
npm install
npm run tauri dev
```

仅前端 UI 开发（浏览器模式）：

```powershell
npm run dev
```

## 功能

- **Obsidian 风格界面** — 侧边栏功能区、文件树、标签页、右侧大纲/反链面板
- **实时预览编辑器** — 源码 / 阅读 / 分屏三种模式，所见即所得
- **快捷键** — `Ctrl+P` 快速打开、`Ctrl+N` 新建笔记、`Ctrl+S` 保存、`Ctrl+W` 关闭标签
- **双向链接** — `[[wiki link]]` 语法，自动反链、出链、标签提取
- **全文搜索** — SQLite FTS5 引擎，BM25 排序
- **会话持久化** — 重启自动恢复打开的标签页和文件树展开状态
- **深色 / 浅色主题** — 完整双主题支持，编辑器、代码块、表格全面适配
- **文件预览** — 支持 Markdown、纯文本、PDF、图片、Excel、Word、PowerPoint
- **右键菜单** — 编辑器内复制/剪切/粘贴/文字颜色
- **代码块** — 语言徽章一键复制
- **大纲跳转** — 右侧面板点击标题自动定位
- **本地文件同步** — 笔记库即文件夹，OneDrive 无缝同步
- **自动构建发布** — 推送 `v*` 标签自动触发 GitHub Actions 构建 `.exe`

## 下载

前往 [Releases](https://github.com/Wooxin/WoxNote/releases) 下载最新版 `.exe` 或 `.msi` 安装包。
