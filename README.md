# MMD

`MMD` 是一个基于 `Tauri + React` 打造的桌面 Markdown 编辑器，面向写作、提示词整理、代码片段记录与本地文本工作流。

`MMD` is a desktop Markdown editor built with `Tauri + React`, designed for writing, prompt organization, code snippets, and local text-based workflows.

它强调一件事：让 Markdown 编辑保持轻、快、稳定，同时具备现代桌面应用应有的体验。打开即用，默认双栏编辑与预览，适合长期停留在本地文件体系中的内容创作场景。

Its focus is simple: keep Markdown editing fast, stable, and lightweight while still feeling like a modern desktop app. It opens quickly, works directly with local files, and provides a side-by-side editing and preview experience by default.

## Features | 特性

- 桌面原生体验，启动轻量，适合日常高频使用
- Desktop-native experience with a lightweight startup flow
- 默认双栏布局，编辑与预览同时进行
- Split view by default for simultaneous editing and preview
- 面向本地文件工作流，支持直接打开和保存 Markdown / 文本文件
- Built around local files with direct open and save support for Markdown and text documents
- 保持 UTF-8 读写，适合中英文混合内容与代码片段管理
- UTF-8 read and write support for multilingual content and code snippets
- 提供常用 Markdown 格式化能力，减少重复手写
- Common Markdown formatting actions to reduce repetitive typing
- 支持拖拽打开文件与双击关联文件启动
- Supports drag-and-drop opening and opening associated files by double-clicking
- 提供明暗主题切换，更适合长时间阅读与编辑
- Light and dark themes for long editing sessions

## Use Cases | 适用场景

- Markdown 笔记与文档写作
- Markdown notes and documentation writing
- Prompt / System Prompt / Agent 配置整理
- Prompt, system prompt, and agent configuration editing
- 命令行片段、脚本片段、开发备忘记录
- Command snippets, scripts, and development notes
- 本地知识库与轻量文稿编辑
- Local knowledge bases and lightweight drafting

## Tech Stack | 技术栈

- `Tauri`
- `React`
- `TypeScript`
- `Vite`

## Development | 开发

```powershell
npm install
npm run tauri dev
```

## Build | 构建

```powershell
npm run build
```
