# 项目 AI 编程指南

## 开发环境设置

## 项目概述
- tauri markdown编辑器

## 技术栈
- tauri + react 

## 配置项

# 注意事项
- 除了更换库, 不要询问我
- 都使用 utf-8
- 绝不能在前端代码中硬编码任何 API 密钥或敏感凭证
- 尽量使用最新版包
- 必要时分离共用逻辑和api
- 尽可能的不要检索 node_modules 目录

# React 组件开发指南

## 组件创建模板

## 组件规范

### 文件结构

### Props 设计原则

1. 使用 TypeScript 严格类型定义
2. 提供合理的默认值
3. 避免过多的 props（遵循选项对象模式）

### 样式指南

- 使用 TailwindCSS 最新版 现在是4.0+
- 优先使用全局 TailwindCSS
- 使用 TailwindCSS 工具类
- 优先使用语义化颜色（如`text-primary`而不是`text-blue-500`）
- 响应式设计：mobile-first 原则
- 使用 shadcn ui 组件库

## 编码规范

### 文件组织

### 命名约定

- 组件：PascalCase（如：`UserProfile.tsx`）
- 工具函数：camelCase（如：`formatDate.ts`）
- 常量：UPPER_SNAKE_CASE

