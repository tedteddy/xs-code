# XS-Code 项目 AI 入职手册

## 项目概述

XS-Code 官网重建项目。完全由 AI 开发维护，PM（Jason）负责产品方向和审批。

- **官网地址**: https://www.xs-code.com/
- **目标**: 重建官网（中文+英文+日文），参考苹果 UI 视觉设计风格，并搭建后台管理系统
- **当前进度**: 查看 README.md 的里程碑部分

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript (strict mode)
- **样式**: Tailwind CSS 4
- **后端/数据库**: Supabase (PostgreSQL + Auth + API)
- **包管理**: Bun
- **部署**: Vercel

## 项目结构

```
xs-code/
├── apps/
│   ├── website/              # Next.js 16（@xs/website）
│   │   └── src/              # 原 src/ 迁移至此
│   └── miniprogram/          # 原生微信小程序（空壳）
├── packages/
│   └── types/                # @xs/types — 共享 TypeScript 类型
├── agents/
│   ├── product/              # PM + UI Agent 工作区
│   │   ├── skills/           # pm.md + ui.md
│   │   ├── tools/            # 爬虫脚本
│   │   └── workspace/        # 产出物（PRD、i18n、scraped-content 等）
│   ├── frontend/             # Frontend + CTO Agent 工作区
│   │   └── skills/           # frontend.md + cto.md
│   ├── qa/                   # QA Agent 工作区
│   │   ├── skills/           # qa.md
│   │   └── tests/            # Playwright 测试用例
│   ├── lib/                  # sandbox.ts（Sandbank 集成）
│   ├── sandbox.config.ts     # 5 角色沙箱配置
│   └── orchestrator.ts       # Fallback 编排器
├── docs/                     # 项目文档
├── turbo.json
└── package.json              # workspace root
```

## 编码规范

### 通用规则
- 使用中文注释（代码变量名用英文）
- 组件使用 PascalCase 命名，文件名使用 kebab-case
- 优先使用 Server Components，仅在需要交互时使用 Client Components
- 使用 `@/` 路径别名引用 src 下的文件

### 样式规则
- 使用 Tailwind CSS utility classes，避免自定义 CSS
- 设计风格参考苹果官网：大量留白、简洁排版、高级感配色
- 支持暗色模式

### 组件规则
- 每个组件一个文件
- Props 使用 interface 定义，不用 type
- 导出方式：命名导出（named export），不用默认导出

### Git 规范
- Commit message 使用英文，格式：`type: description`
- type: feat / fix / docs / style / refactor / test / chore

## 常用命令

```bash
# 确保 bun 可用
export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH"

# 开发（Turborepo 过滤 website）
bun dev  # 即 turbo dev --filter=@xs/website

# 构建
bun run build

# lint
bun run lint

# Fallback 编排器（Claude Code 不可用时）
USE_SANDBOX=1 bun run orchestrate

# 查看 agent 日志
bun run logs
```

## 重要约定

1. **每次新对话前**：先读 README.md 了解当前进度，再读 CLAUDE.md 了解规范
2. **重大决策**：记录到 `docs/decisions/` 目录
3. **讨论记录**：保存到 `docs/brainstorms/` 目录
4. **不确定时**：问 Jason，不要自行决定产品方向

## Agent 编排

**主路径（推荐）**：在对话中告诉 Claude Code"开始构建"，Team 系统自动派发 Product / Frontend / QA Agent 协作完成。

**Fallback**：`USE_SANDBOX=1 bun run orchestrate`
- 覆盖角色：pm / ui / frontend / cto（不含 qa）
- QA 测试需手动运行：`cd agents/qa && bunx playwright test`

**Agent 隔离边界**：
| Agent | 可写路径 |
|-------|---------|
| Product (pm/ui) | agents/product/workspace/ + apps/website/src/i18n/ |
| Frontend | apps/website/ |
| QA | agents/qa/tests/ |
| CTO | docs/decisions/ |
