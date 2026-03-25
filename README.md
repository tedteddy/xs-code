# XS-Code

XS-Code 官网重建项目。采用 AI 驱动开发模式，由 AI 全程负责开发维护，PM 负责产品方向。

## 技术栈

Next.js 16 · TypeScript · Tailwind CSS 4 · Supabase · Bun · Vercel · Turborepo

## 里程碑

### Phase 0: 项目基础设施 `已完成`

搭建项目脚手架和 AI 协作基础设施。

- [x] 初始化 Next.js + TypeScript + Tailwind 项目
- [x] 创建项目目录结构（路由分组、组件、文档）
- [x] 编写 CLAUDE.md（AI 入职手册）
- [x] 编写 README.md（里程碑记录）
- [x] 保存首次讨论记录
- [x] 重构为 Turborepo Monorepo（apps/website + packages/types）
- [x] 搭建 AI Agent 编排系统（Sandbank BoxLite 沙箱 + Orchestrator）
- [x] 完成旧站内容爬取（72 个路由，全量 scraped-content）
- [x] 生成 URL 路由审计报告和内容映射文档

### Phase 1: 官网重建（中文版） `进行中`

重建 xs-code.com 中文版官网，参考苹果 UI 视觉设计风格。

- [ ] PM Agent 输出各页面 PRD + i18n 文件
- [ ] UI Agent 设计系统和组件规范
- [ ] Frontend Agent 实现导航、首页、产品页等核心页面
- [ ] 响应式适配（移动端 / 平板 / 桌面端）
- [ ] SEO 优化

### Phase 2: 多语言国际化（英文+日文） `待开始`

在中文版基础上添加英文和日文版本。原站已有中英文内容，日文为新增。

- [ ] 搭建 i18n 国际化框架（URL 前缀路由：`/zh`、`/en`、`/ja`）
- [ ] 英文版内容迁移（基于原站英文内容）
- [ ] 日文版内容翻译
- [ ] 语言切换组件
- [ ] 多语言 SEO 优化（hreflang 标签等）

### Phase 3: 后台管理系统 `待开始`

搭建后台管理系统，实现内容管理功能。

- [ ] Supabase 项目搭建和数据库设计
- [ ] 用户认证和权限管理
- [ ] Product 管理（CRUD）
- [ ] News 管理（CRUD）
- [ ] 其他管理功能（按需扩展）

## 项目结构

```
xs-code/
├── apps/
│   ├── website/              # Next.js 16（@xs/website）
│   │   └── src/              # app/ components/ lib/ types/ i18n/
│   └── miniprogram/          # 原生微信小程序（空壳）
├── packages/
│   └── types/                # @xs/types — 共享 TypeScript 类型
├── agents/
│   ├── product/              # PM + UI Agent 工作区
│   │   ├── skills/           # pm.md + ui.md
│   │   └── workspace/        # PRD、i18n、scraped-content 等产出物
│   ├── frontend/             # Frontend + CTO Agent 工作区
│   ├── qa/                   # QA Agent（Playwright 测试）
│   ├── lib/                  # sandbox.ts（Sandbank 集成）
│   ├── sandbox.config.ts     # 5 角色沙箱配置
│   └── orchestrator.ts       # Fallback 编排器
├── docs/                     # 项目文档
├── turbo.json
└── package.json              # workspace root
```

## 常用命令

```bash
# 确保 bun 可用
export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH"

# 开发
bun dev

# 构建
bun run build

# Fallback 编排器（Claude Code 不可用时）
USE_SANDBOX=1 bun run orchestrate

# 查看 agent 日志
bun run logs
```
