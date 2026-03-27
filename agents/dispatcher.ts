/**
 * xs-code Orchestrator
 *
 * 按需派发：接收任务和角色列表，spawn VM 执行，完成后销毁。
 * 不常驻、不 REPL——由 Claude Code 主 agent 直接调用。
 *
 * CLI 用法：
 *   bun run agents/dispatcher.ts --task "重建首页" --roles "pm,ui,frontend"
 *   bun run agents/dispatcher.ts --task "审查架构" --roles "cto"
 *
 * 也可作为模块导入：
 *   import { orchestrate } from './dispatcher'
 */

import { createProvider, createSession, withStreaming } from "@sandbank.dev/core";
import { BoxLiteAdapter } from "@sandbank.dev/boxlite";
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { sandboxConfigs } from "./sandbox.config";
import { execAgentTask } from "./lib/sandbox";
import { initDb9, recordRun } from "./lib/db9";

export type AgentRole = "pm" | "ui" | "frontend" | "cto" | "qa";

const ALL_ROLES: AgentRole[] = ["pm", "ui", "frontend", "cto", "qa"];
const READONLY_ROLES = new Set<AgentRole>(["cto"]);

const PROJECT_ROOT = process.cwd();
const LOG_DIR = join(PROJECT_ROOT, "logs");
mkdirSync(LOG_DIR, { recursive: true });

function log(msg: string) {
  const line = `[orchestrator] ${new Date().toISOString()} ${msg}`;
  console.log(line);
  appendFileSync(
    join(LOG_DIR, `orchestrator-${new Date().toISOString().slice(0, 10)}.log`),
    line + "\n"
  );
}

/**
 * 清理上次崩溃遗留的 boxlite-bridge Python 进程。
 * 这些进程会持有 ~/.boxlite/.lock，导致新 runtime 无法获取锁。
 */
function cleanupStaleBridges() {
  try {
    execSync("pkill -f 'boxlite-bridge'", { stdio: "ignore" });
    // 等待 OS 释放 flock
    Bun.sleepSync(300);
  } catch {
    // pkill 找不到进程时返回 1，属正常情况，忽略
  }
}

function createSandboxProvider() {
  return createProvider(
    process.env.BOXRUN_API_URL
      ? new BoxLiteAdapter({
          apiUrl: process.env.BOXRUN_API_URL,
          apiToken: process.env.BOXRUN_API_TOKEN,
        })
      : new BoxLiteAdapter({
          mode: "local",
          boxliteHome: process.env.BOXLITE_HOME ?? `${process.env.HOME}/.boxlite`,
          pythonPath:
            process.env.BOXLITE_PYTHON ??
            `${process.env.HOME}/.boxlite-venv/bin/python3`,
        })
  );
}

export interface OrchestrateResult {
  role: AgentRole;
  output: string;
  success: boolean;
  error?: string;
}

/**
 * 按需 orchestrate：spawn 指定角色的 VM，并行执行任务，完成后全部销毁。
 */
export async function orchestrate(
  task: string,
  roles: AgentRole[] = ALL_ROLES
): Promise<OrchestrateResult[]> {
  log(`=== 开始 orchestrate | 任务: ${task.slice(0, 80)} | 角色: ${roles.join(",")} ===`);

  // 清理上次可能残留的 bridge 进程，释放 ~/.boxlite/.lock
  cleanupStaleBridges();

  await initDb9("xs-code");

  const provider = createSandboxProvider();
  const session = await createSession({
    provider,
    relay: { type: "memory" },
    timeoutMinutes: 60,
  });

  log(`Session 已创建: ${session.id}`);

  // 顺序 spawn VM（BoxLite 本地模式每次只允许一个 runtime 锁定 ~/.boxlite）
  type SpawnedVM = { role: AgentRole; sandbox: Awaited<ReturnType<typeof session.spawn>> };
  const spawnedVMs: SpawnedVM[] = [];
  const spawnErrors: OrchestrateResult[] = [];

  for (const role of roles) {
    const config = sandboxConfigs[role];
    log(`[${role}] spawn VM…`);
    try {
      // rootfsPath（绝对路径）由 BoxLite adapter 自动识别为本地 OCI layout
      const sandbox = await session.spawn(role, {
        image: config.rootfsPath ?? config.image ?? "",
        env: {
          ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY ?? "",
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL ?? "",
          HOME: "/root",
          ...config.env,
        },
      });
      log(`[${role}] VM 已就绪`);
      spawnedVMs.push({ role, sandbox });
    } catch (err) {
      const error = String(err);
      log(`[${role}] ❌ spawn 失败: ${error}`);
      spawnErrors.push({ role, output: "", success: false, error });
    }
  }

  // 并行执行任务（各 VM 相互独立，无 runtime 冲突）
  const taskResults = await Promise.all(
    spawnedVMs.map(async ({ role, sandbox }): Promise<OrchestrateResult> => {
      const config = sandboxConfigs[role];
      try {
        // 安装依赖（自定义镜像已预装，此处通常为空）
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
            if (result.stdout) process.stdout.write(result.stdout);
          }
        }

        log(`[${role}] 开始执行任务…`);
        await recordRun({ role, scope: role, kind: "task_input", content: task });

        const output = await execAgentTask({
          role,
          task,
          projectRoot: PROJECT_ROOT,
          sandbox,
          readonly: READONLY_ROLES.has(role),
          onChunk: (text) => process.stdout.write(text),
        });

        await recordRun({ role, scope: role, kind: "task_output", content: output });
        log(`[${role}] ✅ 完成`);

        return { role, output, success: true };
      } catch (err) {
        const error = String(err);
        log(`[${role}] ❌ 失败: ${error}`);
        await recordRun({ role, scope: role, kind: "task_output", content: `ERROR: ${error}` });
        return { role, output: "", success: false, error };
      }
    })
  );

  const results = [...spawnErrors, ...taskResults];

  // 关闭 session，销毁所有 VM
  log("关闭 session，销毁所有 VM…");
  await session.close();
  log("=== orchestrate 完成 ===");

  return results;
}

// ── CLI 入口 ───────────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);
  const taskIdx = args.indexOf("--task");
  const rolesIdx = args.indexOf("--roles");

  if (taskIdx === -1 || !args[taskIdx + 1]) {
    console.error("用法: bun run agents/dispatcher.ts --task <任务> [--roles <role1,role2,...>]");
    console.error(`可用角色: ${ALL_ROLES.join(", ")}`);
    process.exit(1);
  }

  const task = args[taskIdx + 1];
  const rolesRaw = rolesIdx !== -1 ? args[rolesIdx + 1] : null;
  const roles = rolesRaw
    ? (rolesRaw.split(",").map((r) => r.trim()) as AgentRole[])
    : ALL_ROLES;

  // 验证角色
  const invalid = roles.filter((r) => !ALL_ROLES.includes(r));
  if (invalid.length > 0) {
    console.error(`未知角色: ${invalid.join(", ")}。可用角色: ${ALL_ROLES.join(", ")}`);
    process.exit(1);
  }

  orchestrate(task, roles)
    .then((results) => {
      console.log("\n═══════════════════════════════════════════════════════");
      console.log("  Agent 执行结果汇总");
      console.log("═══════════════════════════════════════════════════════");
      for (const r of results) {
        const icon = r.success ? "✅" : "❌";
        console.log(`\n${icon} [${r.role}]`);
        console.log("───────────────────────────────────────────────────────");
        if (r.success) {
          // 打印完整输出，最多 2000 字符
          const preview = r.output.length > 2000
            ? r.output.slice(0, 2000) + `\n…（已截断，共 ${r.output.length} 字符）`
            : r.output;
          console.log(preview || "(无输出)");
        } else {
          console.log(`失败原因: ${r.error}`);
        }
      }
      console.log("\n═══════════════════════════════════════════════════════\n");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Orchestrator 异常:", err);
      process.exit(1);
    });
}
