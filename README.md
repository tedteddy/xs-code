# XS-Code

XS-Code 官网重建项目。采用 AI 驱动开发模式，由 AI 全程负责开发维护，PM 负责产品方向。

## 技术栈

Next.js 16 · TypeScript · Tailwind CSS 4 · Supabase · Bun · Vercel

## 里程碑

### Phase 0: 项目基础设施 `已完成`

搭建项目脚手架和 AI 协作基础设施。

- [x] 初始化 Next.js + TypeScript + Tailwind 项目
- [x] 创建项目目录结构（路由分组、组件、文档）
- [x] 编写 CLAUDE.md（AI 入职手册）
- [x] 编写 README.md（里程碑记录）
- [x] 保存首次讨论记录

### Phase 1: 官网重建（中文版） `进行中`

重建 xs-code.com 中文版官网，参考苹果 UI 视觉设计风格。

- [ ] 调研现有 xs-code.com 内容和结构
- [ ] 调研苹果官网 UI 视觉设计，沉淀设计规范
- [ ] 设计并实现官网页面（首页、产品页、新闻页等）
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
src/app/(public)/    # 官网页面
src/app/(admin)/     # 后台管理
src/components/      # 组件库
src/lib/             # 工具和配置
src/i18n/            # 国际化
docs/                # 项目文档
```
