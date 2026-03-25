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
