# Prompt Version Manager

一个使用 Electron、React、Vite 与 SQLite 构建的桌面端提示词版本管理原型。

## MVP 能力

- 管理提示词项目、标签与多个历史版本
- 版本按创建时间倒序排列
- 保存 Markdown 正文、图片/文档/视频附件
- 复制提示词正文与附件绝对路径
- 导出完整版本素材包为文件夹或 ZIP
- 搜索标题、标签、版本内容
- 本地优先：SQLite + 本地 `assets` 附件目录

## 信息架构与数据模型

完整说明见 `docs/architecture.md`。

## 本地开发

```bash
npm install
npm run dev
```

## 构建前端资源

```bash
npm run build
```

## 目录结构

- `electron/`：Electron 主进程、预加载脚本、SQLite/导出逻辑
- `src/`：React 渲染层与三栏式界面
- `docs/architecture.md`：信息架构、数据模型、交互流程