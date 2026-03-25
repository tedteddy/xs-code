---
date: 2026-03-24
topic: monorepo-agent-redesign
status: approved
---

# XS-Code 项目重设计：Monorepo + AI Agent 沙箱架构

## 背景

原项目以单应用结构组织，未来需支持微信小程序；Agent 编排依赖手动运行 `bun orchestrate` 命令。本次重设计目标：

1. 改为 Monorepo（Turborepo + Bun Workspaces）
2. 用不同目录隔离 Product / Dev / QA 三个 Agent 角色的工作区
3. 用 Claude Code 原生 Team 系统替代手动命令触发编排
4. 为微信小程序预留位置

---

## 一、Monorepo 目录结构

```
xs-code/
├── apps/
│   ├── website/              # Next.js 16（Dev Agent 负责）
│   │   └── src/              # 现有 src/ 迁移至此
│   └── miniprogram/          # 原生微信小程序（空壳，待 website 稳定后填充）
│       ├── project.config.json
│       ├── app.json
│       ├── app.ts
│       ├── app.wxss
│       └── pages/
│           ├── index/
│           ├── products/
│           └── product-detail/
├── packages/
│   └── types/                # @xs/types — 共享 TypeScript 类型
│       ├── package.json
│       └── src/
│           ├── product.ts
│           ├── news.ts
│           └── index.ts
├── agents/
│   ├── product/              # PM + UI Agent
│   │   ├── skills/           # 系统提示词 / skill 定义
│   │   ├── tools/            # 爬虫脚本（从 scripts/ 迁移）
│   │   │   ├── scrape-site.ts
│   │   │   ├── scrape-spa.ts
│   │   │   └── discover-routes.ts
│   │   └── workspace/        # 产出物暂存
│   │       ├── scraped-content/
│   │       ├── urls.txt
│   │       ├── content-map.md
│   │       └── urls-audit.md
│   ├── dev/                  # Frontend + CTO Agent
│   │   ├── skills/
│   │   └── workspace/        # CTO 评审日志等
│   ├── qa/                   # QA Agent
│   │   ├── skills/
│   │   ├── tests/            # Playwright 测试用例
│   │   └── playwright.config.ts
│   ├── lib/                  # Agent 基础设施（从 scripts/lib/ 迁移）
│   │   ├── sandbox.ts
│   │   └── skills.ts
│   ├── sandbox.config.ts     # Sandbank 沙箱配置（三角色）
│   └── orchestrator.ts       # 保留为 fallback（主流程改用 Claude Code Team）
├── docs/                     # 项目文档（保持现有结构）
├── turbo.json
├── package.json              # workspace root
└── CLAUDE.md                 # AI 入职手册（需更新）
```

### 迁移映射

| 现在 | 新位置 |
|------|--------|
| `src/` | `apps/website/src/` |
| `scripts/lib/` | `agents/lib/` |
| `scripts/sandbox.config.ts` | `agents/sandbox.config.ts` |
| `scripts/orchestrator.ts` | `agents/orchestrator.ts` |
| `scripts/scrape-*.ts`, `discover-routes.ts` | `agents/product/tools/` |
| `scripts/urls.txt`, `content-map.md` 等 | `agents/product/workspace/` |
| `scraped-content/` | `agents/product/workspace/scraped-content/` |
| `docs/` | 保持不动 |

---

## 二、Turborepo 配置

### `turbo.json`

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

### workspace root `package.json`

```json
{
  "name": "xs-code",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev --filter=website",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck"
  }
}
```

---

## 三、Agent 编排方式

### 核心变化

废弃 `bun orchestrate` 手动命令，改为 Claude Code 原生 Team 系统。Jason 只需在对话中说"开始构建"，其余全自动。

### 触发流程

```
Jason: "开始构建官网首页"
    │
    ▼
Claude Code（Team Lead）
    ├── TeamCreate 建立团队
    ├── 派发 Product Agent
    │       └── 读 scraped-content/，写 PRD / i18n 到 workspace/
    │       └── 完成 → 通知 Team Lead
    ├── 派发 CTO Agent → 评审 PRD
    │       └── 通过 → 继续 / 打回 → Product Agent 修改
    ├── 派发 Dev Agent → 写代码到 apps/website/
    │   （同时并行）
    └── 派发 QA Agent → 写 Playwright 测试到 agents/qa/tests/
            └── Dev 完成后 → 自动执行测试 → 报告给 Jason
```

### Sandbank 隔离边界

| Agent | 读权限 | 写权限 |
|-------|--------|--------|
| Product | `agents/product/workspace/` | `agents/product/workspace/`（PRD/i18n） |
| Dev | `agents/product/workspace/`（PRD） + `apps/website/` | `apps/website/` |
| QA | `apps/website/`（代码） | `agents/qa/tests/` |
| CTO | 全局只读 | `docs/decisions/`（评审记录） |

### `agents/orchestrator.ts` 保留原因

作为 fallback：Claude Code 不可用时可手动触发 `bun orchestrate` 运行完整流程。

---

## 四、微信小程序

- 初期只建空壳目录结构，不实现业务逻辑
- 等 website 中文版稳定后，Dev Agent 接管开发
- 与 website 共享 `@xs/types` 中的产品、新闻等类型定义
- 样式与组件独立维护（不共享 UI 库）

---

## 五、待办（实施阶段）

1. 初始化 Turborepo workspace 配置
2. 迁移现有文件到新目录结构
3. 更新 `apps/website/package.json`（添加 `@xs/types` 依赖）
4. 创建 `apps/miniprogram/` 空壳
5. 创建 `packages/types/` 并定义基础类型
6. 更新 `CLAUDE.md` 和 `README.md` 反映新结构
7. 更新 `agents/sandbox.config.ts` 隔离权限配置
8. 验证 `bun dev` 在新结构下正常运行
