/**
 * xs-code Dispatcher（Standby 路径）
 *
 * 保持 5 个 VM 常驻，通过 REPL 随时派发任务：
 *   pm: <任务描述>
 *   frontend: <任务描述>
 *   status
 *   exit
 *
 * 运行：bun run agents/dispatcher.ts
 */

import { createProvider, withStreaming } from "@sandbank.dev/core";
import { BoxLiteAdapter } from "@sandbank.dev/boxlite";
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import * as readline from "node:readline";
import { sandboxConfigs } from "./sandbox.config";
import { execAgentTask } from "./lib/sandbox";
import { initDb9, recordRun } from "./lib/db9";
import type { Sandbox, SandboxProvider } from "@sandbank.dev/core";

type AgentRole = "pm" | "ui" | "frontend" | "cto" | "qa";

const ALL_ROLES: AgentRole[] = ["pm", "ui", "frontend", "cto", "qa"];
const READONLY_ROLES = new Set<AgentRole>(["cto"]);

const PROJECT_ROOT = process.cwd();
const LOG_DIR = join(PROJECT_ROOT, "logs");
const LOG_FILE = join(
  LOG_DIR,
  `dispatcher-${new Date().toISOString().replace(/[:.]/g, "-")}.log`
);

mkdirSync(LOG_DIR, { recursive: true });

function log(msg: string) {
  const line = `[dispatcher] ${new Date().toISOString()} ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + "\n");
}

// ── VM 状态 ────────────────────────────────────────────────────────────────

interface VMState {
  sandbox: Sandbox;
  status: "spawning" | "idle" | "busy" | "error";
  taskCount: number;
  currentTask?: string;
  lastError?: string;
  /** 当前任务链（用于串行化同角色任务） */
  pendingTask?: Promise<void>;
}

const vms = new Map<AgentRole, VMState>();

// ── 启动所有 VM ────────────────────────────────────────────────────────────

async function spawnAll(provider: SandboxProvider): Promise<void> {
  log("启动所有角色 VM…");

  const promises = ALL_ROLES.map(async (role) => {
    const config = sandboxConfigs[role];
    log(`[${role}] 创建 sandbox…`);

    try {
      const sandbox = await provider.create({
        image: config.image,
        env: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
          HOME: "/root",
          ...config.env,
        },
        // 不设 autoDestroyMinutes，保持常驻
      });

      const state: VMState = { sandbox, status: "spawning", taskCount: 0 };
      vms.set(role, state);

      // 执行安装依赖命令
      for (const cmd of config.setup ?? []) {
        log(`[${role}] setup: ${cmd}`);
        const s = withStreaming(sandbox);
        if (s) {
          const stream = await s.execStream(cmd, { cwd: "/workspace" });
          const reader = stream.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            process.stdout.write(decoder.decode(value, { stream: true }));
          }
        } else {
          const result = await sandbox.exec(cmd, { cwd: "/workspace" });
          process.stdout.write(result.stdout);
        }
      }

      state.status = "idle";
      log(`[${role}] ✅ 就绪`);
    } catch (err) {
      log(`[${role}] ❌ 启动失败: ${err}`);
      const existing = vms.get(role);
      if (existing) {
        existing.status = "error";
        existing.lastError = String(err);
      }
    }
  });

  await Promise.all(promises);
  log("所有 VM 启动完成");
}

// ── 派发任务 ───────────────────────────────────────────────────────────────

function dispatch(role: AgentRole, task: string): void {
  const state = vms.get(role);
  if (!state) {
    console.log(`❌ 角色 ${role} 的 VM 未初始化`);
    return;
  }
  if (state.status === "spawning") {
    console.log(`⏳ ${role} VM 仍在启动中，请稍后再试`);
    return;
  }
  if (state.status === "error") {
    console.log(`❌ ${role} VM 处于错误状态：${state.lastError}`);
    return;
  }

  const run = async () => {
    state.status = "busy";
    state.currentTask = task;
    state.taskCount++;
    log(`[${role}] 开始任务 #${state.taskCount}: ${task.slice(0, 80)}`);

    await recordRun({ role, scope: role, kind: "task_input", content: task });

    try {
      const output = await execAgentTask({
        role,
        task,
        projectRoot: PROJECT_ROOT,
        sandbox: state.sandbox,
        readonly: READONLY_ROLES.has(role),
        onChunk: (text) => process.stdout.write(text),
      });

      await recordRun({ role, scope: role, kind: "task_output", content: output });
      log(`[${role}] ✅ 任务 #${state.taskCount} 完成`);
    } catch (err) {
      log(`[${role}] ❌ 任务失败: ${err}`);
      state.lastError = String(err);
    } finally {
      state.status = "idle";
      state.currentTask = undefined;
    }
  };

  // 同角色串行，跨角色并行
  state.pendingTask = (state.pendingTask ?? Promise.resolve()).then(run);
  console.log(`✉️  已派发 ${role} 任务（队列中）`);
}

// ── 状态展示 ───────────────────────────────────────────────────────────────

function showStatus(): void {
  console.log("\n── VM 状态 ────────────────────────────────────");
  for (const role of ALL_ROLES) {
    const state = vms.get(role);
    if (!state) {
      console.log(`  ${role.padEnd(10)} ⚪ 未初始化`);
      continue;
    }
    const icon = { spawning: "⏳", idle: "✅", busy: "🔄", error: "❌" }[state.status];
    const detail =
      state.status === "busy" ? ` — ${state.currentTask?.slice(0, 50)}…` : "";
    const errInfo = state.status === "error" ? ` — ${state.lastError}` : "";
    console.log(
      `  ${role.padEnd(10)} ${icon} ${state.status}${detail}${errInfo}  (任务数: ${state.taskCount})`
    );
  }
  console.log("────────────────────────────────────────────────\n");
}

// ── REPL ───────────────────────────────────────────────────────────────────

async function startREPL(provider: SandboxProvider): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "xs> ",
  });

  console.log("\n=== xs-code Dispatcher ===");
  console.log("命令格式：<角色>: <任务>  |  status  |  exit");
  console.log(`角色列表：${ALL_ROLES.join(", ")}\n`);

  rl.prompt();

  rl.on("line", (line) => {
    const trimmed = line.trim();

    if (trimmed === "exit" || trimmed === "quit") {
      rl.close();
      return;
    }

    if (trimmed === "status") {
      showStatus();
      rl.prompt();
      return;
    }

    const match = trimmed.match(/^(\w+):\s*(.+)$/s);
    if (!match) {
      console.log('格式错误，请使用 "<角色>: <任务>" 或 "status" / "exit"');
      rl.prompt();
      return;
    }

    const [, roleStr, task] = match;
    const role = roleStr as AgentRole;

    if (!ALL_ROLES.includes(role)) {
      console.log(`未知角色 "${role}"，可用角色：${ALL_ROLES.join(", ")}`);
      rl.prompt();
      return;
    }

    dispatch(role, task.trim());
    rl.prompt();
  });

  rl.on("close", async () => {
    log("用户退出 REPL，销毁所有 VM…");
    const destroyAll = [...vms.values()].map((s) =>
      provider.destroy(s.sandbox.id).catch(() => {})
    );
    await Promise.all(destroyAll);
    log("所有 VM 已销毁");
    process.exit(0);
  });
}

// ── 主程序 ─────────────────────────────────────────────────────────────────

async function main() {
  log("=== xs-code Dispatcher 启动 ===");
  log(`日志文件：${LOG_FILE}`);

  await initDb9("xs-code");

  const provider = process.env.BOXRUN_API_URL
    ? createProvider(
        new BoxLiteAdapter({
          apiUrl: process.env.BOXRUN_API_URL,
          apiToken: process.env.BOXRUN_API_TOKEN,
        })
      )
    : createProvider(
        new BoxLiteAdapter({
          mode: "local",
          boxliteHome: process.env.BOXLITE_HOME ?? `${process.env.HOME}/.boxlite`,
        })
      );

  await spawnAll(provider);
  await startREPL(provider);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
