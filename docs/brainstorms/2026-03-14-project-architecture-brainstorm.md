---
date: 2026-03-14
topic: project-architecture
---

# 项目架构与技术选型讨论

## 背景

Jason 希望重建 xs-code.com，采用纯 AI 驱动开发模式（AI 开发，Jason 作为 PM）。

## 需求概述（Jason 草稿）

1. 重建 xs-code.com，需要实现日文功能
2. 调研苹果官网 UI 视觉设计，参考其风格进行优化
3. 实现后台管理系统（用户管理、Product/News 的 CRUD 等）

## 讨论决策

### 1. 里程碑记录方式

**选项**：时间线式 / 阶段式 / 看板式

**决策**：阶段式（Phase 0/1/2/3），每个 Phase 有明确目标和完成状态

**理由**：结构清晰，适合长期项目追踪

### 2. 技术栈

**选项**：Next.js + Tailwind / Next.js + 其他 CSS 方案 / 其他框架

**决策**：Next.js + TypeScript + Tailwind CSS

**理由**：现代全栈方案，AI 最熟悉，生态最好

### 3. 前后台架构

**选项**：Monorepo 路由分组 / Turborepo 多应用 / 分仓库

**决策**：Monorepo 路由分组（`(public)` + `(admin)`）

**理由**：
- 项目规模适合单仓库
- AI 开发效率最高（一个仓库完整上下文）
- 共享组件和类型定义
- Next.js 原生支持路由分组

### 4. 后端/数据库

**选项**：Supabase / PlanetScale + NextAuth / 后续再定

**决策**：Supabase（PostgreSQL + Auth + API）

**理由**：一体化方案，免费额度够用，AI 熟悉度高

### 5. AI 协作基础设施

**决策**：建立以下文件体系

- `CLAUDE.md` — AI 入职手册（编码规范、项目结构、技术栈）
- `README.md` — 项目愿景 + 阶段式里程碑
- `docs/brainstorms/` — 讨论记录
- `docs/decisions/` — 决策记录
- `docs/prd/` — 产品需求文档

### 6. 阶段规划

| Phase | 内容 |
|---|---|
| Phase 0 | 项目基础设施搭建 |
| Phase 1 | 官网重建（中文版，苹果风格 UI） |
| Phase 2 | 日文国际化 |
| Phase 3 | 后台管理系统（Supabase） |

## 下一步

→ 完成 Phase 0 基础设施搭建后，进入 Phase 1 官网重建
