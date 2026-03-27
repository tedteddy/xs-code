/**
 * Sandbank BoxLite 集成
 *
 * 提供两种使用模式：
 * - execAgentTask()：在已有 sandbox 中执行 Claude agent（dispatcher 使用）
 * - runAgentInSandbox()：一次性创建 sandbox、执行、销毁（orchestrator fallback 使用）
 */

import { createProvider, withStreaming, withPortExpose } from "@sandbank.dev/core";
import { BoxLiteAdapter } from "@sandbank.dev/boxlite";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sandboxConfigs } from "../sandbox.config";
import type { Sandbox, SandboxProvider } from "@sandbank.dev/core";

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

export interface ExecAgentTaskOptions {
  role: AgentRole;
  task: string;
  projectRoot: string;
  sandbox: Sandbox;
  /** CTO 等只读角色不回写文件 */
  readonly?: boolean;
  /** 超时（毫秒），默认 10 分钟 */
  timeout?: number;
  /** 流式输出回调 */
  onChunk?: (text: string) => void;
}

export interface SandboxRunOptions {
  role: AgentRole;
  task: string;
  projectRoot: string;
  /** CTO 评审时不需要回写文件 */
  readonly?: boolean;
  /** 超时时间（毫秒），默认 10 分钟 */
  timeout?: number;
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

export function createSandbankProvider(): SandboxProvider {
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
      pythonPath: process.env.BOXLITE_PYTHON ?? `${process.env.HOME}/.boxlite-venv/bin/python3`,
    })
  );
}

let _provider: SandboxProvider | null = null;
export function getProvider(): SandboxProvider {
  if (!_provider) _provider = createSandbankProvider();
  return _provider;
}

// ── 文件归档工具 ───────────────────────────────────────────────────────────────

/** 将项目关键目录打包为 tar.gz（排除 node_modules / .git / .next 等） */
export function packProject(projectRoot: string): Uint8Array {
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

  const targets = candidates.filter((p) => existsSync(join(projectRoot, p)));

  // 写到临时文件避免 stdout 缓冲区溢出（ENOBUFS）
  const tmpFile = join("/tmp", `sandbank-pack-${Date.now()}.tar.gz`);
  try {
    execFileSync(
      "tar",
      [
        "-czf",
        tmpFile,
        "--exclude=*/node_modules",
        "--exclude=*/.next",
        "--exclude=*/dist",
        "--exclude=*/build",
        "--exclude=*/.turbo",
        "--exclude=*/.cache",
        ...targets,
      ],
      { cwd: projectRoot }
    );
    const buffer = readFileSync(tmpFile);
    return new Uint8Array(buffer);
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // 忽略清理错误
    }
  }
}

/** 将 sandbox 中 /workspace 的修改解压回本地 */
export async function unpackToProject(
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

  const tmpFile = join("/tmp", `sandbank-${Date.now()}.tar.gz`);
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

// ── Agent 任务执行 ────────────────────────────────────────────────────────────

/**
 * 在已有的 sandbox 中执行 Claude agent task。
 * sandbox 的生命周期由调用方管理，此函数不负责创建或销毁。
 */
export async function execAgentTask(
  opts: ExecAgentTaskOptions
): Promise<string> {
  const timeout = opts.timeout ?? 10 * 60 * 1000;
  const group = ROLE_GROUP[opts.role];
  const { sandbox } = opts;

  // 上传最新项目文件
  const archive = packProject(opts.projectRoot);
  await sandbox.uploadArchive(archive, "/workspace");

  // 读取角色 skill 文件
  const skillPath = join(
    opts.projectRoot,
    `agents/${group}/skills/${opts.role}.md`
  );
  let systemPrompt = "";
  try {
    systemPrompt = readFileSync(skillPath, "utf-8");
  } catch {
    // skill 文件不存在时跳过
  }

  await sandbox.writeFile("/tmp/system-prompt.txt", systemPrompt);
  await sandbox.writeFile("/tmp/task.txt", opts.task);
  // 将认证信息写入 sandbox（优先 ANTHROPIC_AUTH_TOKEN，回退到 ANTHROPIC_API_KEY）
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY ?? "";
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? "";
  await sandbox.writeFile("/tmp/api-key", authToken);
  await sandbox.writeFile("/tmp/api-base-url", baseUrl);

  // QA 角色：启动 dev server 并暴露端口
  let testBaseUrl = "";
  if (opts.role === "qa") {
    const portSandbox = withPortExpose(sandbox);
    if (portSandbox) {
      await sandbox.exec(
        "cd /workspace/apps/website && bun dev > /tmp/dev.log 2>&1 &"
      );
      await new Promise((r) => setTimeout(r, 5000));
      const exposed = await portSandbox.exposePort(3000);
      testBaseUrl = typeof exposed === "string" ? exposed : (exposed as { url: string }).url;
    }
  }

  const qaEnv = testBaseUrl ? `TEST_BASE_URL="${testBaseUrl}" ` : "";
  const claudeCmd = [
    `cat /tmp/task.txt |`,
    `${qaEnv}ANTHROPIC_AUTH_TOKEN=$(cat /tmp/api-key) ANTHROPIC_BASE_URL=$(cat /tmp/api-base-url) claude --print --model claude-haiku-4-5-20251001`,
    `--append-system-prompt "$(cat /tmp/system-prompt.txt)"`,
    `--permission-mode acceptEdits`,
    `--allowedTools Read,Write,Edit,MultiEdit,Glob,Grep,Bash`,
  ].join(" ");

  let captured = "";
  const streamSandbox = withStreaming(sandbox);

  if (streamSandbox) {
    const stream = await streamSandbox.execStream(claudeCmd, {
      cwd: "/workspace",
      timeout,
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      captured += text;
      opts.onChunk?.(text);
    }
  } else {
    const result = await sandbox.exec(claudeCmd, { cwd: "/workspace", timeout });
    captured = result.stdout;
    opts.onChunk?.(captured);
  }

  // 回写文件（只读角色跳过）
  if (!opts.readonly) {
    const modifiedArchive = await sandbox.downloadArchive("/workspace");
    await unpackToProject(modifiedArchive, opts.projectRoot);
  }

  return captured;
}

// ── 一次性运行（供 orchestrator fallback 使用）────────────────────────────────

/**
 * 一次性运行：创建 sandbox → 安装依赖 → 执行任务 → 销毁 sandbox。
 */
export async function runAgentInSandbox(
  opts: SandboxRunOptions
): Promise<SandboxRunResult> {
  const provider = getProvider();
  const config = sandboxConfigs[opts.role];
  const timeout = opts.timeout ?? 10 * 60 * 1000;

  console.log(`[sandbox] 启动 ${opts.role} sandbox…`);

  const sandbox = await provider.create({
    image: config.image,
    env: {
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY ?? "",
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL ?? "",
      HOME: "/root",
      ...config.env,
    },
    autoDestroyMinutes: Math.ceil(timeout / 60_000) + 5,
  });

  try {
    // 安装依赖
    for (const cmd of config.setup ?? []) {
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

    const stdout = await execAgentTask({
      ...opts,
      sandbox,
      onChunk: (text) => process.stdout.write(text),
    });

    return { stdout, stderr: "" };
  } finally {
    await provider.destroy(sandbox.id).catch(() => {});
  }
}

// ── Pre-flight 验证（保留兼容接口）──────────────────────────────────────────

/**
 * 验证角色 sandbox 是否可正常工作（不再拍快照）。
 */
export async function preflightAgent(role: AgentRole): Promise<PreflightResult> {
  const provider = getProvider();
  const config = sandboxConfigs[role];
  const VERIFY_CMDS: Record<AgentRole, string> = {
    pm: 'claude --version && echo "pm ready"',
    ui: 'claude --version && echo "ui ready"',
    frontend: 'bun --version && claude --version && echo "frontend ready"',
    cto: 'claude --version && echo "cto ready"',
    qa: 'playwright --version && claude --version && echo "qa ready"',
  };

  console.log(`[preflight] 验证 ${role} sandbox…`);
  const sandbox = await provider.create({
    image: config.image,
    env: {
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY ?? "",
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL ?? "",
      HOME: "/root",
    },
    autoDestroyMinutes: 15,
  });

  try {
    for (const cmd of config.setup ?? []) {
      await sandbox.exec(cmd, { cwd: "/workspace" });
    }

    const result = await sandbox.exec(VERIFY_CMDS[role], { cwd: "/workspace" });
    if (!result.stdout.includes(`${role} ready`)) {
      throw new Error(`${role} 验证失败: ${result.stdout}`);
    }

    console.log(`[preflight] ✅ ${role} 就绪`);
    return { role, snapshotId: "" };
  } finally {
    await provider.destroy(sandbox.id).catch(() => {});
  }
}
