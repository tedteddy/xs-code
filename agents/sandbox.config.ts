/**
 * 各 agent 角色的沙箱配置
 * OCI 镜像兼容 BoxLite（本地 microVM）和 Docker Hub
 */

export interface SandboxConfig {
  image: string;
  /** 需要预装的命令 */
  setup?: string[];
  /** 额外环境变量（会合并进 sandbox 创建参数） */
  env?: Record<string, string>;
}

/** Debian/Ubuntu 系镜像安装 GitHub CLI + git */
const INSTALL_GH =
  "apt-get update -qq && apt-get install -y -qq curl git && " +
  "curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && " +
  'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && ' +
  "apt-get update -qq && apt-get install -y -qq gh";

const INSTALL_CLAUDE = "npm install -g @anthropic-ai/claude-code --silent";

/**
 * 读取角色对应的 env 变量，注入进 sandbox。
 * 约定：env 中用 {ROLE}_ 前缀区分不同 agent 账号。
 * GIT_AUTHOR_* / GIT_COMMITTER_* 是 git 原生支持的环境变量，
 * 无需在 sandbox 内执行 git config。
 */
function agentEnv(role: string): Record<string, string> {
  const p = role.toUpperCase();
  return {
    // GitHub CLI — 设置后 gh 命令自动鉴权，无需 gh auth login
    GH_TOKEN: process.env[`${p}_GH_TOKEN`] ?? "",
    // git 提交身份
    GIT_AUTHOR_NAME: process.env[`${p}_GIT_USER`] ?? `xs-${role}-agent`,
    GIT_AUTHOR_EMAIL: process.env[`${p}_GIT_EMAIL`] ?? "",
    GIT_COMMITTER_NAME: process.env[`${p}_GIT_USER`] ?? `xs-${role}-agent`,
    GIT_COMMITTER_EMAIL: process.env[`${p}_GIT_EMAIL`] ?? "",
    // Linear — agent 通过 LINEAR_API_KEY 调用 GraphQL API
    LINEAR_API_KEY: process.env[`${p}_LINEAR_KEY`] ?? "",
  };
}

export const sandboxConfigs: Record<string, SandboxConfig> = {
  pm: {
    image: "node:22-slim",
    setup: [INSTALL_GH, INSTALL_CLAUDE],
    env: agentEnv("pm"),
  },

  ui: {
    image: "node:22-slim",
    setup: [INSTALL_GH, INSTALL_CLAUDE],
    env: agentEnv("ui"),
  },

  frontend: {
    image: "oven/bun:1",
    setup: [INSTALL_GH, INSTALL_CLAUDE],
    env: agentEnv("frontend"),
  },

  cto: {
    image: "node:22-slim",
    setup: [INSTALL_GH, INSTALL_CLAUDE],
    env: agentEnv("cto"),
  },

  qa: {
    // Playwright 官方镜像，已含 Chromium/Firefox/WebKit
    image: "mcr.microsoft.com/playwright:v1.50.0-noble",
    setup: [INSTALL_GH, INSTALL_CLAUDE],
    env: agentEnv("qa"),
  },
};
