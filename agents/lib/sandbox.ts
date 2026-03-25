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
  cto: "cto",
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
