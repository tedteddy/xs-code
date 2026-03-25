# XS-Code Monorepo + AI Agent 沙箱架构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 xs-code 改造为 Turborepo monorepo，整合 Sandbank AI Agent 沙箱架构，支持微信小程序扩展

**Architecture:** 根目录管理 Turborepo workspace，Next.js 站点迁移至 `apps/website/`，原 `scripts/` 工具迁移至 `agents/`；Claude Code Team 系统替代手动编排命令；Sandbank BoxLite 提供沙箱隔离、快照、流式输出和端口暴露能力

**Tech Stack:** Turborepo, Bun Workspaces, Next.js 16, @sandbank.dev/core + boxlite + relay + db9 + agent + skills, TypeScript strict

---

## 文件结构映射

### 新建文件
- `turbo.json` — Turborepo tasks 配置
- `apps/website/package.json` — @xs/website workspace 包（name + @xs/types 依赖）
- `apps/website/tsconfig.json` — 继承 root，添加 Next.js plugin 和 @/* 路径别名
- `apps/miniprogram/project.config.json` — 微信小程序项目配置（空壳）
- `apps/miniprogram/app.json` — 小程序 pages 声明
- `apps/miniprogram/app.ts` — 小程序 App 入口
- `apps/miniprogram/app.wxss` — 全局样式（空）
- `apps/miniprogram/pages/index/index.{ts,wxml,wxss}` — 首页存根
- `apps/miniprogram/pages/products/index.{ts,wxml,wxss}` — 产品列表存根
- `apps/miniprogram/pages/product-detail/index.{ts,wxml,wxss}` — 产品详情存根
- `packages/types/package.json` — @xs/types workspace 包
- `packages/types/tsconfig.json` — 类型包 tsconfig
- `packages/types/src/product.ts` — Product 接口定义
- `packages/types/src/news.ts` — News 接口定义
- `packages/types/src/index.ts` — 统一导出
- `agents/product/skills/pm.md` — PM Agent 提示词（从 .claude/skills/pm/role.md 复制）
- `agents/product/skills/ui.md` — UI Agent 提示词（从 .claude/skills/ui/role.md 复制）
- `agents/frontend/skills/frontend.md` — Frontend Agent 提示词（复制）
- `agents/frontend/skills/cto.md` — CTO Agent 提示词（复制）
- `agents/qa/skills/qa.md` — QA Agent 提示词（新建）

### 迁移文件（移动位置）
- `src/` → `apps/website/src/`
- `next.config.ts` → `apps/website/next.config.ts`
- `postcss.config.mjs` → `apps/website/postcss.config.mjs`
- `eslint.config.mjs` → `apps/website/eslint.config.mjs`
- `scripts/scrape-site.ts` → `agents/product/tools/scrape-site.ts`
- `scripts/scrape-spa.ts` → `agents/product/tools/scrape-spa.ts`
- `scripts/discover-routes.ts` → `agents/product/tools/discover-routes.ts`
- `scripts/urls.txt` → `agents/product/workspace/urls.txt`
- `scripts/urls-supplement-2.txt` → `agents/product/workspace/urls-supplement-2.txt`
- `scripts/urls-audit.md` → `agents/product/workspace/urls-audit.md`
- `scripts/content-map.md` → `agents/product/workspace/content-map.md`
- `scripts/file-server-inventory.md` → `agents/product/workspace/file-server-inventory.md`
- `scraped-content/` → `agents/product/workspace/scraped-content/`
- `scripts/sandbox.config.ts` → `agents/sandbox.config.ts`（内容更新）
- `scripts/lib/sandbox.ts` → `agents/lib/sandbox.ts`（重写）
- `scripts/orchestrator.ts` → `agents/orchestrator.ts`（更新）

### 删除文件
- `scripts/lib/skills.ts` — 被 @sandbank.dev/skills 替代

### 更新文件
- `package.json` — 改为 monorepo root（workspaces、turbo、sandbank 依赖）
- `tsconfig.json` — 改为只覆盖 agents/ 和 packages/
- `CLAUDE.md` — 更新项目结构和命令

---

## Task 1: 初始化 Turborepo workspace 配置

**Files:**
- Create: `turbo.json`
- Modify: `package.json`
- Modify: `tsconfig.json`（root，改为 agents-only 覆盖）

- [ ] **Step 1: 创建 turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
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

- [ ] **Step 2: 更新 root package.json**

将 `package.json` 替换为以下内容（注意 `workspaces` 只含 `apps/*` 和 `packages/*`，`agents/` 不入 workspace）：

```json
{
  "name": "xs-code",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev --filter=@xs/website",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "orchestrate": "bun run agents/orchestrator.ts",
    "logs": "tail -f logs/$(ls -t logs/ | head -1)"
  },
  "devDependencies": {
    "turbo": "latest",
    "@sandbank.dev/core": "latest",
    "@sandbank.dev/boxlite": "latest",
    "@sandbank.dev/relay": "latest",
    "@sandbank.dev/db9": "latest",
    "@sandbank.dev/agent": "latest",
    "@sandbank.dev/skills": "latest"
  },
  "trustedDependencies": ["sharp", "unrs-resolver"],
  "ignoreScripts": ["sharp", "unrs-resolver"]
}
```

- [ ] **Step 3: 更新 root tsconfig.json**

root tsconfig 只覆盖 agents/ 和 packages/（website 有自己的 tsconfig）：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["agents/**/*.ts", "packages/**/*.ts"]
}
```

- [ ] **Step 4: 验证 turbo 可用**

```bash
export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH"
bun install
bunx turbo --version
```

预期输出：turbo 版本号（如 2.x.x）

- [ ] **Step 5: Commit**

```bash
git add turbo.json package.json tsconfig.json bun.lock
git commit -m "chore: initialize turborepo monorepo workspace"
```

---

## Task 2: 迁移 Next.js 站点到 apps/website/

**Files:**
- Create: `apps/website/package.json`
- Create: `apps/website/tsconfig.json`
- Move: `src/` → `apps/website/src/`
- Move: `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs` → `apps/website/`

- [ ] **Step 1: 创建 apps/website/ 目录并添加 package.json**

```bash
mkdir -p apps/website
```

`apps/website/package.json`:
```json
{
  "name": "@xs/website",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "16.1.6",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "@xs/types": "workspace:*"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: 创建 apps/website/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "outDir": ".next"
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 移动站点文件**

```bash
mv src apps/website/src
mv next.config.ts apps/website/next.config.ts
mv postcss.config.mjs apps/website/postcss.config.mjs
mv eslint.config.mjs apps/website/eslint.config.mjs
```

检查 public/ 目录是否需要一并移动（Next.js 图片资源）：

```bash
ls public/ 2>/dev/null && mv public apps/website/public || echo "no public dir"
```

- [ ] **Step 4: 安装依赖并验证 Next.js 启动**

```bash
bun install
bun dev
```

预期：Next.js 在 `apps/website/` 下启动，localhost:3000 可访问

- [ ] **Step 5: Commit**

```bash
git add apps/website/ bun.lock
git rm -r --cached src/ next.config.ts postcss.config.mjs eslint.config.mjs 2>/dev/null || true
git commit -m "feat: migrate Next.js site to apps/website/"
```

---

## Task 3: 创建 apps/miniprogram 微信小程序空壳

**Files:**
- Create: `apps/miniprogram/project.config.json`
- Create: `apps/miniprogram/app.json`
- Create: `apps/miniprogram/app.ts`
- Create: `apps/miniprogram/app.wxss`
- Create: `apps/miniprogram/pages/{index,products,product-detail}/index.{ts,wxml,wxss}`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p apps/miniprogram/pages/index
mkdir -p apps/miniprogram/pages/products
mkdir -p apps/miniprogram/pages/product-detail
```

- [ ] **Step 2: 创建配置文件**

`apps/miniprogram/project.config.json`:
```json
{
  "miniprogramRoot": "./",
  "projectname": "xs-code-miniprogram",
  "appid": "",
  "setting": {
    "es6": true,
    "enhance": true,
    "minified": true
  },
  "compileType": "miniprogram"
}
```

`apps/miniprogram/app.json`:
```json
{
  "pages": [
    "pages/index/index",
    "pages/products/index",
    "pages/product-detail/index"
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#fff",
    "navigationBarTitleText": "XS-Code",
    "navigationBarTextStyle": "black"
  }
}
```

- [ ] **Step 3: 创建 App 入口和存根页面**

`apps/miniprogram/app.ts`:
```typescript
// 微信小程序入口 — 待 website 中文版稳定后填充
App({
  onLaunch() {
    console.log("xs-code miniprogram launched");
  },
});
```

`apps/miniprogram/app.wxss`: （空文件，仅占位）

各页面存根（以 index 页为例，products 和 product-detail 同理）：

`apps/miniprogram/pages/index/index.ts`:
```typescript
Page({
  data: {},
  onLoad() {},
});
```

`apps/miniprogram/pages/index/index.wxml`:
```xml
<!-- 首页 — 待实现 -->
<view class="container">
  <text>XS-Code</text>
</view>
```

`apps/miniprogram/pages/index/index.wxss`: （空文件）

- [ ] **Step 4: Commit**

```bash
git add apps/miniprogram/
git commit -m "feat: add miniprogram empty shell"
```

---

## Task 4: 创建 packages/types 共享类型包

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/product.ts`
- Create: `packages/types/src/news.ts`
- Create: `packages/types/src/index.ts`

- [ ] **Step 1: 创建目录和 package.json**

```bash
mkdir -p packages/types/src
```

`packages/types/package.json`:
```json
{
  "name": "@xs/types",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

`packages/types/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 2: 定义 Product 类型**

`packages/types/src/product.ts`:
```typescript
/** 产品信息 — website 和 miniprogram 共享 */
export interface Product {
  id: string;
  name: string;
  nameEn: string;
  nameJa: string;
  description: string;
  descriptionEn: string;
  descriptionJa: string;
  category: string;
  imageUrl?: string;
  downloadUrl?: string;
  isNew?: boolean;
}
```

- [ ] **Step 3: 定义 News 类型**

`packages/types/src/news.ts`:
```typescript
/** 新闻/资讯 — website 和 miniprogram 共享 */
export interface News {
  id: string;
  title: string;
  titleEn: string;
  titleJa: string;
  content: string;
  publishedAt: string;
  category?: string;
}
```

- [ ] **Step 4: 创建 index.ts 导出**

`packages/types/src/index.ts`:
```typescript
export type { Product } from "./product";
export type { News } from "./news";
```

- [ ] **Step 5: Commit**

```bash
git add packages/types/
git commit -m "feat: add @xs/types shared type package"
```

---

## Task 5: 迁移 agents/ 目录和工具文件

**Files:**
- Create dirs: `agents/product/{tools,workspace,skills}`, `agents/frontend/{skills,workspace}`, `agents/qa/{skills,tests}`, `agents/lib/`
- Move: 爬虫脚本、workspace 产出物、scraped-content/

- [ ] **Step 1: 创建 agents/ 目录结构**

```bash
mkdir -p agents/product/tools
mkdir -p agents/product/workspace
mkdir -p agents/product/skills
mkdir -p agents/frontend/skills
mkdir -p agents/frontend/workspace
mkdir -p agents/qa/skills
mkdir -p agents/qa/tests
mkdir -p agents/lib
```

- [ ] **Step 2: 迁移爬虫脚本**

```bash
mv scripts/scrape-site.ts agents/product/tools/scrape-site.ts
mv scripts/scrape-spa.ts agents/product/tools/scrape-spa.ts
mv scripts/discover-routes.ts agents/product/tools/discover-routes.ts
```

- [ ] **Step 3: 迁移 workspace 产出物**

```bash
mv scripts/urls.txt agents/product/workspace/urls.txt
mv scripts/urls-supplement-2.txt agents/product/workspace/urls-supplement-2.txt
mv scripts/urls-audit.md agents/product/workspace/urls-audit.md
mv scripts/content-map.md agents/product/workspace/content-map.md
mv scripts/file-server-inventory.md agents/product/workspace/file-server-inventory.md
```

- [ ] **Step 4: 迁移 scraped-content/**

```bash
mv scraped-content agents/product/workspace/scraped-content
```

- [ ] **Step 5: Commit**

```bash
git add agents/
git rm -r --cached scripts/scrape-site.ts scripts/scrape-spa.ts scripts/discover-routes.ts 2>/dev/null || true
git rm -r --cached scraped-content/ 2>/dev/null || true
git commit -m "feat: migrate scripts and content to agents/ directory"
```

---

## Task 6: 迁移 Agent 提示词文件到对应 skills/ 目录

**Files:**
- Create: `agents/product/skills/pm.md`（从 `.claude/skills/pm/role.md` 复制）
- Create: `agents/product/skills/ui.md`（从 `.claude/skills/ui/role.md` 复制）
- Create: `agents/frontend/skills/frontend.md`（从 `.claude/skills/frontend/role.md` 复制）
- Create: `agents/frontend/skills/cto.md`（从 `.claude/skills/cto/role.md` 复制）
- Create: `agents/qa/skills/qa.md`（新建 QA Agent 提示词）

- [ ] **Step 1: 复制现有提示词文件**

注意：是复制（不是移动）。`.claude/skills/` 下的文件由 Claude Code 运行时读取，保留原位置。`agents/*/skills/` 下的副本供 Sandbank 沙箱路径（`@sandbank.dev/skills` 的 `loadSkill()`）使用。

```bash
cp .claude/skills/pm/role.md agents/product/skills/pm.md
cp .claude/skills/ui/role.md agents/product/skills/ui.md
cp .claude/skills/frontend/role.md agents/frontend/skills/frontend.md
cp .claude/skills/cto/role.md agents/frontend/skills/cto.md
```

- [ ] **Step 2: 创建 QA Agent 提示词**

`agents/qa/skills/qa.md`:
```markdown
# QA Agent

你是 XS-Code 项目的 QA 工程师。你的职责是为 website（Next.js 16）编写和执行 Playwright E2E 测试。

## 工作目录
- 测试文件写入：`agents/qa/tests/`
- Playwright 配置：`agents/qa/playwright.config.ts`
- 被测应用：`apps/website/`（开发服务器由沙箱环境提供，URL 通过环境变量 `TEST_BASE_URL` 传入）

## 测试规范
- 使用 TypeScript 编写测试
- 每个页面一个测试文件，命名：`{page-name}.spec.ts`
- 每个测试用例聚焦一个用户场景
- 断言要具体：检查文本内容、URL、元素可见性
- 多语言页面：分别测试 `/zh`、`/en`、`/ja` 路由

## Playwright 配置模板
```typescript
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
  },
});
```

## 任务执行流程
1. 收到 Team Lead 的测试指令（Frontend Agent 完成后触发）
2. 读取 `apps/website/src/` 了解已实现的页面和组件
3. 为每个 P0 页面编写测试用例
4. 执行：`bunx playwright test`
5. 汇总测试报告，回报 Team Lead
```

- [ ] **Step 3: 验证文件存在**

```bash
ls agents/product/skills/ agents/frontend/skills/ agents/qa/skills/
```

预期：列出 pm.md、ui.md、frontend.md、cto.md、qa.md

- [ ] **Step 4: Commit**

```bash
git add agents/product/skills/ agents/frontend/skills/ agents/qa/skills/
git commit -m "feat: add agent skill prompts to agents/ directories"
```

---

## Task 7: 更新 CLAUDE.md 反映新 monorepo 结构

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 更新项目结构章节**

将 CLAUDE.md 中的"项目结构"部分替换为：

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

- [ ] **Step 2: 更新常用命令章节**

```bash
# 开发（Turborepo 过滤 website）
bun dev  # 即 turbo dev --filter=@xs/website

# 构建
bun run build

# Fallback 编排器（Claude Code 不可用时）
USE_SANDBOX=1 bun run orchestrate

# 查看 agent 日志
bun run logs
```

- [ ] **Step 3: 添加 Agent 工作区说明**

在 CLAUDE.md 末尾追加：

```markdown
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
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for monorepo structure"
```

---

## Task 8: 更新 agents/sandbox.config.ts 添加 allowedPaths

**Files:**
- Create: `agents/sandbox.config.ts`（从 scripts/sandbox.config.ts 迁移并更新）
- Delete: `scripts/sandbox.config.ts`

- [ ] **Step 1: 创建 agents/sandbox.config.ts**

```typescript
/**
 * 各 agent 角色的沙箱配置
 * OCI 镜像兼容 BoxLite（本地 microVM）和 Docker Hub
 */

export interface SandboxConfig {
  image: string;
  /** 需要预装的命令 */
  setup?: string[];
  /** 额外环境变量 */
  env?: Record<string, string>;
  /** 路径隔离权限 */
  allowedPaths?: {
    read: string[];
    write: string[];
  };
}

export const sandboxConfigs: Record<string, SandboxConfig> = {
  pm: {
    image: "node:22-slim",
    setup: ["npm install -g @anthropic-ai/claude-code --silent"],
    allowedPaths: {
      read: ["agents/product/workspace/"],
      write: ["agents/product/workspace/", "apps/website/src/i18n/"],
    },
  },

  ui: {
    image: "node:22-slim",
    setup: ["npm install -g @anthropic-ai/claude-code --silent"],
    allowedPaths: {
      read: ["agents/product/workspace/"],
      write: ["agents/product/workspace/", "apps/website/src/i18n/"],
    },
  },

  frontend: {
    image: "oven/bun:1",
    setup: ["npm install -g @anthropic-ai/claude-code --silent"],
    allowedPaths: {
      read: ["agents/product/workspace/", "apps/website/"],
      write: ["apps/website/"],
    },
  },

  cto: {
    image: "node:22-slim",
    setup: ["npm install -g @anthropic-ai/claude-code --silent"],
    allowedPaths: {
      read: ["agents/product/workspace/", "apps/website/"],
      write: ["docs/decisions/"],
    },
  },

  qa: {
    // Playwright 官方镜像，已含 Chromium/Firefox/WebKit
    image: "mcr.microsoft.com/playwright:v1.50.0-noble",
    setup: ["npm install -g @anthropic-ai/claude-code --silent"],
    allowedPaths: {
      read: ["apps/website/"],
      write: ["agents/qa/tests/"],
    },
  },
};
```

- [ ] **Step 2: 删除旧文件**

```bash
rm scripts/sandbox.config.ts
git rm scripts/sandbox.config.ts
```

- [ ] **Step 3: Commit**

```bash
git add agents/sandbox.config.ts
git commit -m "feat: add allowedPaths to sandbox.config.ts, move to agents/"
```

---

## Task 9: 重写 agents/lib/sandbox.ts — 集成 Relay + db9 + Stream + Skills

**Files:**
- Create: `agents/lib/sandbox.ts`（全新实现）
- Delete: `scripts/lib/sandbox.ts`
- Delete: `scripts/lib/skills.ts`

关键变化：
- 新增 `qa` 角色支持
- 新增 pre-flight 沙箱验证（`preflightAgent`）+ BoxLite Snapshot 缓存
- 用 `sandbox.stream()` 替代 `sandbox.exec()`（实时输出 + 避免安全 hook）
- QA Agent 额外：启动 `bun dev`、调用 `sandbox.exposePort(3000)` 获取测试 URL
- 用 `@sandbank.dev/skills` 的 `loadSkill()` 替代 `buildSystemPrompt()`
- 更新 `packProject()` 的路径（`apps/`, `packages/`, `agents/`, `docs/`）

- [ ] **Step 1: 创建 agents/lib/sandbox.ts**

```typescript
/**
 * Sandbank BoxLite 集成（重写版）
 *
 * 运行方式：USE_SANDBOX=1 bun run agents/orchestrator.ts
 *
 * 新增特性：
 * - qa 角色支持
 * - pre-flight 验证 + BoxLite Snapshot 缓存
 * - sandbox.stream() 实时输出
 * - QA Port exposure（bun dev + exposePort）
 * - @sandbank.dev/skills loadSkill() 替代 buildSystemPrompt()
 */

import { createProvider } from "@sandbank.dev/core";
import { BoxLiteAdapter } from "@sandbank.dev/boxlite";
import { loadSkill } from "@sandbank.dev/skills";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { sandboxConfigs } from "../sandbox.config";

// ── 类型 ──────────────────────────────────────────────────────────────────────

export type AgentRole = "pm" | "ui" | "frontend" | "cto" | "qa";

/** 角色 → agents/ 工作组映射 */
const ROLE_GROUP: Record<AgentRole, string> = {
  pm: "product",
  ui: "product",
  frontend: "frontend",
  cto: "frontend",
  qa: "qa",
};

/** Pre-flight 验证命令（每角色） */
const PREFLIGHT_CMDS: Record<AgentRole, string> = {
  pm: 'claude --version && echo "pm ready"',
  ui: 'claude --version && echo "ui ready"',
  frontend: 'bun --version && claude --version && echo "frontend ready"',
  cto: 'claude --version && echo "cto ready"',
  qa: 'playwright --version && claude --version && echo "qa ready"',
};

export interface SandboxRunOptions {
  role: AgentRole;
  task: string;
  projectRoot: string;
  /** CTO 评审时不需要回写文件 */
  readonly?: boolean;
  /** 超时时间（毫秒），默认 10 分钟 */
  timeout?: number;
  /** BoxLite Snapshot ID（pre-flight 通过后缓存） */
  snapshotId?: string;
}

export interface SandboxRunResult {
  stdout: string;
  stderr: string;
}

export interface PreflightResult {
  role: AgentRole;
  snapshotId: string;
}

// ── Provider 初始化 ───────────────────────────────────────────────────────────

function createBoxLiteProvider() {
  if (process.env.BOXRUN_API_URL) {
    return createProvider(
      new BoxLiteAdapter({
        apiUrl: process.env.BOXRUN_API_URL,
        apiToken: process.env.BOXRUN_API_TOKEN,
      })
    );
  }
  return createProvider(
    new BoxLiteAdapter({
      mode: "local",
      boxliteHome: process.env.BOXLITE_HOME ?? `${process.env.HOME}/.boxlite`,
    })
  );
}

let _provider: ReturnType<typeof createBoxLiteProvider> | null = null;
function getProvider() {
  if (!_provider) _provider = createBoxLiteProvider();
  return _provider;
}

// ── 文件归档工具 ───────────────────────────────────────────────────────────────

/** 将项目关键目录打包为 tar.gz（排除 node_modules / .git / .next 等） */
function packProject(projectRoot: string): Uint8Array {
  const candidates = [
    "apps",
    "packages",
    "agents",
    "docs",
    ".claude",
    "turbo.json",
    "package.json",
    "tsconfig.json",
  ];

  const { existsSync } = require("node:fs");
  const targets = candidates.filter((p) =>
    existsSync(join(projectRoot, p))
  );

  const buffer = execFileSync("tar", ["-czf", "-", ...targets], {
    cwd: projectRoot,
    maxBuffer: 100 * 1024 * 1024,
  });
  return new Uint8Array(buffer);
}

/** 将 sandbox 中 /workspace 的修改解压回本地 */
async function unpackToProject(
  stream: ReadableStream,
  projectRoot: string
): Promise<void> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const tmpFile = join("/tmp", `sandbank-result-${Date.now()}.tar.gz`);
  try {
    writeFileSync(tmpFile, Buffer.from(merged));
    execFileSync("tar", ["-xzf", tmpFile, "-C", projectRoot], {
      stdio: "pipe",
    });
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // 忽略清理错误
    }
  }
}

// ── Pre-flight 验证 ────────────────────────────────────────────────────────────

/**
 * 对单个角色执行 pre-flight 验证：
 * 1. 创建 sandbox（角色对应镜像）
 * 2. 安装依赖（setup 命令）
 * 3. 运行验证命令（claude --version 等）
 * 4. 拍 Snapshot（供后续任务从快照恢复，跳过安装）
 * 5. 销毁 sandbox（快照已保存到 BoxLite 存储）
 *
 * 验证失败会抛出异常，orchestrator 负责捕获并中止。
 */
export async function preflightAgent(role: AgentRole): Promise<PreflightResult> {
  const provider = getProvider();
  const config = sandboxConfigs[role];

  console.log(`[preflight] 验证 ${role} sandbox…`);
  const sandbox = await provider.create({
    image: config.image,
    env: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
      HOME: "/root",
    },
    autoDestroyMinutes: 15,
  });

  try {
    // 安装依赖
    for (const cmd of config.setup ?? []) {
      let output = "";
      for await (const chunk of sandbox.stream(cmd, { cwd: "/workspace" })) {
        output += chunk;
      }
      console.log(`[preflight:${role}] setup: ${output.trim()}`);
    }

    // 运行角色验证命令
    let verifyOutput = "";
    for await (const chunk of sandbox.stream(PREFLIGHT_CMDS[role], { cwd: "/workspace" })) {
      verifyOutput += chunk;
    }

    if (!verifyOutput.includes(`${role} ready`)) {
      throw new Error(`${role} 验证失败：${verifyOutput}`);
    }

    console.log(`[preflight] ✅ ${role} 就绪，拍快照…`);
    const snapshotId = await sandbox.snapshot();
    console.log(`[preflight] ${role} snapshotId: ${snapshotId}`);

    return { role, snapshotId };
  } finally {
    await provider.destroy(sandbox.id).catch(() => {});
  }
}

// ── 核心运行函数 ───────────────────────────────────────────────────────────────

/**
 * 在 BoxLite microVM 中运行 Claude agent
 *
 * 流程：
 * 1. 从 Snapshot 恢复（若有）或创建新 sandbox
 * 2. 上传项目文件到 /workspace
 * 3. 加载 system prompt（loadSkill）并写入 /tmp/system-prompt.txt
 * 4. 写 task 到 /tmp/task.txt
 * 5. 用 sandbox.stream() 执行 claude CLI（实时输出）
 * 6. QA 角色额外：启动 bun dev + exposePort(3000) 获取测试 URL
 * 7. 如非只读，同步文件回本地
 * 8. 销毁 sandbox
 */
export async function runAgentInSandbox(
  opts: SandboxRunOptions
): Promise<SandboxRunResult> {
  const provider = getProvider();
  const timeout = opts.timeout ?? 10 * 60 * 1000;
  const config = sandboxConfigs[opts.role];
  const group = ROLE_GROUP[opts.role];

  console.log(`[sandbox] 启动 ${opts.role} sandbox… (${opts.snapshotId ? "snapshot" : "fresh"})`);

  // 从快照恢复（跳过依赖安装）或创建新 sandbox
  const sandbox = opts.snapshotId
    ? await provider.restore(opts.snapshotId, {
        env: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
          HOME: "/root",
        },
        autoDestroyMinutes: Math.ceil(timeout / 60_000) + 5,
      })
    : await provider.create({
        image: config.image,
        env: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
          HOME: "/root",
        },
        autoDestroyMinutes: Math.ceil(timeout / 60_000) + 5,
      });

  try {
    // 若非快照启动，执行安装步骤
    if (!opts.snapshotId) {
      for (const cmd of config.setup ?? []) {
        for await (const chunk of sandbox.stream(cmd, { cwd: "/workspace" })) {
          process.stdout.write(chunk);
        }
      }
    }

    // 上传项目文件
    console.log(`[sandbox] 上传项目文件…`);
    const archive = packProject(opts.projectRoot);
    await sandbox.uploadArchive(archive, "/workspace");

    // 加载 system prompt（从 agents/{group}/skills/{role}.md）
    const skillPath = `agents/${group}/skills/${opts.role}.md`;
    const systemPrompt = await loadSkill(skillPath);
    await sandbox.writeFile("/tmp/system-prompt.txt", systemPrompt);
    await sandbox.writeFile("/tmp/task.txt", opts.task);

    // QA 角色：启动 dev server 并暴露端口
    let testBaseUrl = "";
    if (opts.role === "qa") {
      console.log(`[sandbox:qa] 启动 bun dev…`);
      // 后台启动（不阻塞）
      void sandbox.stream("cd apps/website && bun dev &", { cwd: "/workspace" });
      // 等待 dev server 就绪
      await new Promise((r) => setTimeout(r, 5000));
      testBaseUrl = await sandbox.exposePort(3000);
      console.log(`[sandbox:qa] dev server 暴露 URL: ${testBaseUrl}`);
    }

    // 执行 claude CLI（stream 实时输出）
    console.log(`[sandbox] 运行 ${opts.role} agent…`);
    const qaEnv = opts.role === "qa" ? `TEST_BASE_URL="${testBaseUrl}" ` : "";
    const claudeCmd = [
      `cat /tmp/task.txt |`,
      `${qaEnv}claude --print`,
      `--append-system-prompt "$(cat /tmp/system-prompt.txt)"`,
      `--permission-mode bypassPermissions`,
      `--allowedTools Read,Write,Edit,MultiEdit,Glob,Grep,Bash`,
    ].join(" ");

    let captured = "";
    for await (const chunk of sandbox.stream(claudeCmd, {
      cwd: "/workspace",
      timeout,
    })) {
      captured += chunk;
      process.stdout.write(chunk);
    }

    // 同步文件回本地（只读 agent 跳过）
    if (!opts.readonly) {
      console.log(`[sandbox] 同步文件回本地…`);
      const modifiedArchive = await sandbox.downloadArchive("/workspace");
      await unpackToProject(modifiedArchive, opts.projectRoot);
    }

    return { stdout: captured, stderr: "" };
  } finally {
    await provider.destroy(sandbox.id).catch(() => {});
  }
}
```

- [ ] **Step 2: 删除旧文件**

```bash
rm scripts/lib/sandbox.ts scripts/lib/skills.ts
git rm scripts/lib/sandbox.ts scripts/lib/skills.ts
```

如果 `scripts/lib/` 目录为空则一并删除：

```bash
rmdir scripts/lib 2>/dev/null || true
```

- [ ] **Step 3: Commit**

```bash
git add agents/lib/sandbox.ts
git commit -m "feat: rewrite agents/lib/sandbox.ts with stream, preflight, snapshot, QA port exposure"
```

---

## Task 10: 更新 agents/orchestrator.ts — Pre-flight + Relay + db9

**Files:**
- Create: `agents/orchestrator.ts`（从 scripts/orchestrator.ts 迁移并更新）
- Delete: `scripts/orchestrator.ts`

关键变化：
- `AgentRole` 改为 `"pm" | "ui" | "frontend" | "cto"`（QA 不走 fallback）
- `USE_SANDBOX=1` 时启动时执行 `preflightAll()`（4 角色并行验证）
- 各阶段任务路径更新（`scraped-content/` → `agents/product/workspace/scraped-content/`）
- `runAgent()` 传入 `snapshotId`

- [ ] **Step 1: 创建 agents/orchestrator.ts**

```typescript
/**
 * xs-code Orchestrator（Fallback 路径）
 *
 * 流程：PM → CTO评审 → UI → CTO评审 → Frontend → CTO评审
 * 每阶段最多重试 MAX_RETRIES 次。
 *
 * 注意：此 fallback 只覆盖 pm/ui/frontend/cto（不含 qa）。
 * QA 测试依赖 Port exposure，需手动运行：cd agents/qa && bunx playwright test
 *
 * 运行：USE_SANDBOX=1 bun run agents/orchestrator.ts
 */

import { spawn } from "child_process";
import { appendFileSync, mkdirSync } from "fs";
import { preflightAgent, runAgentInSandbox } from "./lib/sandbox";

const USE_SANDBOX = process.env.USE_SANDBOX === "1";

// ── 配置 ──────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const PROJECT_ROOT = process.cwd();
const LOG_FILE = `${PROJECT_ROOT}/logs/orchestrator-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;

mkdirSync(`${PROJECT_ROOT}/logs`, { recursive: true });

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  const line = `[orchestrator] ${new Date().toISOString()} ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + "\n");
}

type FallbackRole = "pm" | "ui" | "frontend" | "cto";

/** 角色 → snapshot ID 缓存（pre-flight 通过后存储） */
const snapshotIds: Partial<Record<FallbackRole, string>> = {};

// ── Pre-flight 验证 ────────────────────────────────────────────────────────────

/**
 * 并行验证所有 4 个 fallback 角色的沙箱，拍快照缓存。
 * 任一失败则中止，Jason 修复环境后重跑。
 */
async function preflightAll(): Promise<void> {
  log("=== Pre-flight：并行验证 4 个角色沙箱 ===");

  const roles: FallbackRole[] = ["pm", "ui", "frontend", "cto"];
  const results = await Promise.allSettled(
    roles.map((role) => preflightAgent(role))
  );

  const failures: string[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      const { role, snapshotId } = result.value;
      snapshotIds[role] = snapshotId;
      log(`✅ ${role} 就绪 (snapshotId: ${snapshotId})`);
    } else {
      failures.push(result.reason?.message ?? "未知错误");
      log(`❌ pre-flight 失败: ${result.reason?.message}`);
    }
  }

  if (failures.length > 0) {
    log(`⛔ Pre-flight 未通过，请修复后重跑：\n${failures.join("\n")}`);
    process.exit(1);
  }

  log("=== Pre-flight 通过，开始正式任务 ===");
}

// ── runAgent ──────────────────────────────────────────────────────────────────

async function runAgent(opts: {
  role: FallbackRole;
  task: string;
  silent?: boolean;
}): Promise<string> {
  log(`启动 ${opts.role} agent… (${USE_SANDBOX ? "sandbox" : "host"})`);
  appendFileSync(LOG_FILE, `\n${"─".repeat(60)}\n[${opts.role}] task:\n${opts.task}\n${"─".repeat(60)}\n`);

  if (USE_SANDBOX) {
    const result = await runAgentInSandbox({
      role: opts.role,
      task: opts.task,
      projectRoot: PROJECT_ROOT,
      readonly: opts.role === "cto",
      snapshotId: snapshotIds[opts.role],
    });
    appendFileSync(LOG_FILE, result.stdout);
    if (!opts.silent) process.stdout.write(result.stdout);
    return result.stdout;
  }

  // ── 直接在宿主机运行（默认）──────────────────────────────────────────────
  return new Promise((resolve, reject) => {
    const args = [
      "--print",
      "--permission-mode",
      "bypassPermissions",
      "--allowedTools",
      "Read,Write,Edit,MultiEdit,Glob,Grep,Bash",
    ];

    const child = spawn("claude", args, {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
    });

    child.stdin.write(opts.task);
    child.stdin.end();

    let captured = "";

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      captured += text;
      appendFileSync(LOG_FILE, text);
      if (!opts.silent) process.stdout.write(text);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      appendFileSync(LOG_FILE, `[stderr] ${text}`);
      process.stderr.write(text);
    });

    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`${opts.role} agent 退出码 ${code}`));
      else resolve(captured);
    });
  });
}

// ── CTO 评审 ──────────────────────────────────────────────────────────────────

type Stage = "pm" | "ui" | "frontend";

async function ctoReview(stage: Stage): Promise<"approved" | "rejected"> {
  log(`CTO 评审 ${stage} 阶段…`);

  const output = await runAgent({
    role: "cto",
    task: `
请评审 ${stage.toUpperCase()} 阶段的产出物。

1. 读取相关文件，按你的评审标准逐项检查
2. 通过 → 写入 decision 记录（scope='${stage}'，内容包含"${stage} 阶段评审通过"）
3. 打回 → 写入 blocker 记录（scope='${stage}'，内容以"打回原因："开头，列出具体问题）

最后一行必须输出 JSON（不加任何其他字符）：
{"result":"approved"} 或 {"result":"rejected"}
    `.trim(),
    silent: true,
  });

  const lines = output.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('{"result":')) {
      try {
        const json = JSON.parse(line) as { result: string };
        if (json.result === "approved" || json.result === "rejected") {
          log(`CTO 评审结果：${json.result}`);
          return json.result;
        }
      } catch {
        // 继续找
      }
    }
  }

  log("⚠️ 未能解析 CTO 评审结果 JSON，视为 rejected");
  return "rejected";
}

// ── 阶段任务定义 ──────────────────────────────────────────────────────────────

function firstAttemptTask(stage: Stage): string {
  const tasks: Record<Stage, string> = {
    pm: `
请执行你的 PM 职责：
1. 读取 agents/product/workspace/scraped-content/ 所有文件，建立全局内容认知
2. 输出 agents/product/workspace/prd/sitemap.md（信息架构）
3. 按 P0→P1 顺序输出每个页面 PRD（agents/product/workspace/prd/*.md）
4. 同步输出三语言 i18n 文件（apps/website/src/i18n/zh.json、en.json、ja.json）
5. 完成后在终端输出"PM 阶段完成"
    `.trim(),

    ui: `
PM PRD 已通过 CTO 评审。请执行你的 UI 职责：
1. 读取 agents/product/workspace/prd/sitemap.md 和 homepage.md
2. 更新 apps/website/src/app/globals.css 的 @theme inline（完整设计 token）
3. 输出 agents/product/workspace/ui-spec.md（设计规范文档）
4. 在 agents/product/workspace/prd/homepage.md 末尾追加"UI 组件拆解"章节
5. 完成后在终端输出"UI 阶段完成"
    `.trim(),

    frontend: `
UI 设计系统已通过 CTO 评审。请执行你的 Frontend 职责：
1. 读取 agents/product/workspace/ui-spec.md 和 agents/product/workspace/prd/ 下的 P0 页面 PRD
2. 实现 NavBar 和 Footer 组件
3. 实现首页所有区块组件
4. 实现产品列表页
5. 实现至少 1 个产品详情页
6. 提取动效 hooks 到 apps/website/src/lib/hooks/
7. 完成后在终端输出"Frontend 阶段完成"
    `.trim(),
  };
  return tasks[stage];
}

function retryTask(stage: Stage, attempt: number): string {
  return `
CTO 打回了你上一次的 ${stage.toUpperCase()} 产出，这是第 ${attempt} 次尝试（最多 ${MAX_RETRIES} 次）。

请先读取 logs/ 目录下最新日志文件中 CTO 的打回原因，
针对每条反馈逐一修改，完成后在终端输出"${stage} 阶段完成"。
  `.trim();
}

async function runStage(stage: Stage): Promise<void> {
  log(`\n${"=".repeat(60)}\n阶段开始：${stage.toUpperCase()}\n${"=".repeat(60)}`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const task = attempt === 1 ? firstAttemptTask(stage) : retryTask(stage, attempt);
    await runAgent({ role: stage as FallbackRole, task });

    const verdict = await ctoReview(stage);

    if (verdict === "approved") {
      log(`✅ ${stage.toUpperCase()} 阶段通过 CTO 评审`);
      return;
    }

    log(`❌ ${stage.toUpperCase()} 阶段被 CTO 打回（第 ${attempt} 次）`);

    if (attempt === MAX_RETRIES) {
      log(`⛔ ${stage.toUpperCase()} 已达最大重试次数（${MAX_RETRIES}），请人工介入。`);
      process.exit(1);
    }
  }
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  log("=== xs-code Orchestrator 启动 (Fallback 路径) ===");
  log(`最大重试次数：${MAX_RETRIES}`);
  log(`日志文件：${LOG_FILE}`);

  // Sandbox 模式下先执行 pre-flight 验证
  if (USE_SANDBOX) {
    await preflightAll();
  }

  await runStage("pm");
  await runStage("ui");
  await runStage("frontend");

  log("\n所有阶段完成！代码已就绪，可以运行 bun dev 预览。");
  log("注意：QA 测试需手动运行：cd agents/qa && bunx playwright test");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: 删除旧文件**

```bash
rm scripts/orchestrator.ts
git rm scripts/orchestrator.ts
```

- [ ] **Step 3: 如果 scripts/ 目录已空，删除它**

```bash
ls scripts/ && echo "scripts/ 还有文件" || rmdir scripts/
```

- [ ] **Step 4: Commit**

```bash
git add agents/orchestrator.ts
git commit -m "feat: update orchestrator with preflight, snapshot support, monorepo paths"
```

---

## Task 11: 验证 monorepo 正常运行

**无新文件 — 验证阶段**

- [ ] **Step 1: 安装全量依赖**

```bash
export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH"
bun install
```

预期：workspace 依赖安装成功，包含 turbo 和 @sandbank.dev/* 包

- [ ] **Step 2: 验证 turbo 可识别所有 workspace**

```bash
bunx turbo ls
```

预期输出包含 `@xs/website` 和 `@xs/types`

- [ ] **Step 3: 验证 typecheck 通过**

```bash
bunx turbo typecheck
```

预期：0 errors

- [ ] **Step 4: 启动开发服务器验证 Next.js 正常**

```bash
bun dev
```

预期：
- `turbo dev --filter=@xs/website` 执行
- Next.js 在 apps/website/ 目录下启动
- `http://localhost:3000` 可访问且页面正常

- [ ] **Step 5: 验证 agents/ 目录结构完整**

```bash
ls agents/product/skills/   # pm.md, ui.md
ls agents/frontend/skills/  # frontend.md, cto.md
ls agents/qa/skills/        # qa.md
ls agents/product/workspace/ # urls.txt, scraped-content/ 等
ls agents/lib/              # sandbox.ts
ls agents/                  # sandbox.config.ts, orchestrator.ts
```

- [ ] **Step 6: 最终 Commit（如有未提交更改）**

```bash
git status
git add -A
git commit -m "chore: verify monorepo structure complete"
```

---

## 验收标准

1. `bun dev` 启动 Next.js，`localhost:3000` 正常显示
2. `bunx turbo typecheck` 无 TypeScript 错误
3. `agents/product/workspace/scraped-content/` 内容完整（47 个已爬取页面）
4. 各 Agent 的 skills/ 提示词文件齐全（pm/ui/frontend/cto/qa 共 5 个）
5. `agents/lib/sandbox.ts` 和 `agents/orchestrator.ts` 可被 `bun run` 无语法错误解析
6. `scripts/lib/skills.ts` 已删除（不再存在）
