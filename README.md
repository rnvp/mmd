# MMD

`MMD` 是一个基于 `Tauri + React` 的桌面 Markdown 编辑器。

当前仓库已经完成第一版工程骨架：参考 `tiledial` 风格的 Markdown 编辑器，默认双栏，左侧编辑，右侧预览，具备本地文件打开、保存和基础格式化能力。

## 第一阶段目标

- 默认双栏编辑
- 实时 Markdown 预览
- 新建 / 打开 / 保存 / 另存为
- 未保存修改状态跟踪
- 基础工具栏插入动作
- 参考 `tiledial` 的桌面工具风格

## 文档

- [实现功能文档](/D:/now/codex/mmd/docs/实现功能文档.md)
- [开发者复刻 Checklist](/D:/now/codex/mmd/docs/开发者复刻-checklist.md)

## 当前状态

当前已实现：

- `Tauri + React + TypeScript + Vite` 工程骨架
- 虚拟标题栏
- 标题栏内文件动作、视图切换、常用 Markdown 格式化按钮
- 标题栏 `More` 菜单
- 标题栏窗口控制按钮
- 双栏编辑 / 预览布局
- 视图模式与分栏比例持久化
- UTF-8 本地文件打开与保存
- Markdown 实时预览
- 未保存修改保护对话框
- `Tab / Shift+Tab` 缩进
- 常用 Markdown 快捷键
- 外部拖拽 Markdown / 文本文件直接打开
- 双击关联的 Markdown / 文本文件时直接打开目标文件
- 编辑区与预览区同步滚动
- `dark / light` 主题切换与持久化
