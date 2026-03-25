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
│   ├── product/              # PM + UI Agent（原 pm + ui 两个角色合并）
│   │   ├── skills/           # pm.md + ui.md 两个提示词文件分开保存
│   │   ├── tools/            # 爬虫脚本（从 scripts/ 迁移）
│   │   │   ├── scrape-site.ts
│   │   │   ├── scrape-spa.ts
│   │   │   └── discover-routes.ts
│   │   └── workspace/        # 产出物暂存
│   │       ├── scraped-content/
│   │       ├── urls.txt
│   │       ├── urls-supplement-2.txt
│   │       ├── content-map.md
│   │       ├── urls-audit.md
│   │       └── file-server-inventory.md
│   ├── dev/                  # Frontend + CTO Agent（原 frontend + cto 两个角色）
│   │   ├── skills/           # frontend.md + cto.md 两个提示词文件分开保存
│   │   └── workspace/        # CTO 评审日志等
│   ├── qa/                   # QA Agent（原 qa 角色）
│   │   ├── skills/           # qa.md 提示词
│   │   ├── tests/            # Playwright 测试用例
│   │   └── playwright.config.ts
│   ├── lib/                  # Agent 基础设施（从 scripts/lib/ 迁移）
│   │   ├── sandbox.ts
│   │   └── skills.ts
│   ├── sandbox.config.ts     # Sandbank 沙箱配置（5 角色保持不变：pm/ui/frontend/cto/qa）
│   └── orchestrator.ts       # 保留为 fallback（主流程改用 Claude Code Team）
├── docs/                     # 项目文档（保持现有结构）
├── turbo.json
├── package.json              # workspace root（依赖 turbo、sandbank 等在此统一管理）
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
| `scripts/urls.txt`, `urls-supplement-2.txt` | `agents/product/workspace/` |
| `scripts/content-map.md`, `urls-audit.md`, `file-server-inventory.md` | `agents/product/workspace/` |
| `scraped-content/` | `agents/product/workspace/scraped-content/` |
| `docs/` | 保持不动 |

### Agent 角色目录对应关系

`agents/` 目录按**工作组**划分（product / dev / qa），原 `sandbox.config.ts` 的 5 个角色（pm / ui / frontend / cto / qa）保持不变，各角色提示词文件分别放在对应工作组的 `skills/` 下：

| sandbox 角色 | 工作组目录 | 提示词文件 |
|---|---|---|
| `pm` | `agents/product/skills/` | `pm.md` |
| `ui` | `agents/product/skills/` | `ui.md` |
| `frontend` | `agents/dev/skills/` | `frontend.md` |
| `cto` | `agents/dev/skills/` | `cto.md` |
| `qa` | `agents/qa/skills/` | `qa.md` |

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

`agents/` 不加入 Bun workspace（它是脚本集合，不是库包），其依赖（`@sandbank.dev/core` 等）统一安装在 workspace root。

```json
{
  "name": "xs-code",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev --filter=@xs/website",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "orchestrate": "bun run agents/orchestrator.ts"
  },
  "devDependencies": {
    "turbo": "latest",
    "@sandbank.dev/core": "latest",
    "@sandbank.dev/boxlite": "latest"
  }
}
```

### `apps/website/package.json` name 字段

```json
{
  "name": "@xs/website"
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
    ├── 派发 Product Agent（pm + ui 角色）
    │       └── 读 workspace/scraped-content/，写 PRD 到 workspace/
    │       └── 写 i18n 文件直接到 apps/website/src/i18n/
    │       └── 完成 → 通知 Team Lead
    ├── 派发 CTO Agent → 评审 PRD（只读 workspace/ 和 apps/website/）
    │       └── 通过 → 继续 / 打回 → Product Agent 修改
    ├── 派发 Dev Agent → 写代码到 apps/website/
    │   （同时并行）
    └── 派发 QA Agent → 写 Playwright 测试到 agents/qa/tests/
            │
            └── Team Lead 收到 Dev Agent "完成"通知后
                → 发送消息给 QA Agent 触发测试执行
                → QA 测试完成 → 报告给 Team Lead → 报告给 Jason
```

**QA 时序协调**：由 Team Lead 负责。Dev Agent 完成后向 Team Lead 发送完成消息，Team Lead 再通知 QA Agent 执行测试。QA Agent 不轮询，等待指令。

### Sandbank 隔离边界

| Agent | 读权限 | 写权限 |
|-------|--------|--------|
| Product (pm/ui) | `agents/product/workspace/` | `agents/product/workspace/`（PRD）+ `apps/website/src/i18n/`（i18n 文件） |
| Dev (frontend) | `agents/product/workspace/`（PRD）+ `apps/website/` | `apps/website/` |
| QA | `apps/website/`（代码） | `agents/qa/tests/` |
| CTO | `agents/product/workspace/` + `apps/website/`（只读审查范围） | `docs/decisions/`（评审记录） |

### `agents/orchestrator.ts` 保留原因

作为 fallback：Claude Code 不可用时可手动触发 `bun orchestrate` 运行完整流程。内部 `AgentRole` 类型和 `sandbox.config.ts` 的 5 角色定义保持不变，无需修改。

---

## 四、微信小程序

- 初期只建空壳目录结构，不实现业务逻辑
- 等 website 中文版稳定后，Dev Agent 接管开发
- 与 website 共享 `@xs/types` 中的产品、新闻等类型定义
- 样式与组件独立维护（不共享 UI 库）

---

## 五、待办（实施阶段）

1. 初始化 Turborepo workspace 配置（`turbo.json`、root `package.json`）
2. 迁移现有文件到新目录结构（含 `urls-supplement-2.txt`、`file-server-inventory.md`）
3. 更新 `apps/website/package.json`（name 改为 `@xs/website`，添加 `@xs/types` 依赖）
4. 创建 `apps/miniprogram/` 空壳
5. 创建 `packages/types/` 并定义基础类型
6. 将各角色提示词迁移到对应工作组 `skills/` 目录
7. 更新 `CLAUDE.md` 和 `README.md` 反映新结构
8. 更新 `agents/sandbox.config.ts` 隔离权限配置
9. 验证 `bun dev`（即 `turbo dev --filter=@xs/website`）在新结构下正常运行
