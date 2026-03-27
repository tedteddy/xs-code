/**
 * 各 agent 角色的沙箱配置
 * 优先使用本地 OCI layout（~/.boxlite-images/），无需 registry
 */

export interface SandboxConfig {
  /** OCI layout 本地路径（优先），BoxLite 直接加载，无需联网 */
  rootfsPath?: string;
  /** 回退用 registry image（需 HTTPS registry） */
  image?: string;
  /** 需要预装的命令 */
  setup?: string[];
  /** 额外环境变量（会合并进 sandbox 创建参数） */
  env?: Record<string, string>;
}

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

/** 本地 OCI layout 目录（由 skopeo 从 Docker 导出） */
const IMAGES_DIR =
  process.env.BOXLITE_IMAGES_DIR ?? `${process.env.HOME}/.boxlite-images`;

export const sandboxConfigs: Record<string, SandboxConfig> = {
  pm: {
    rootfsPath: `${IMAGES_DIR}/xs-code-agent`,
    env: agentEnv("pm"),
  },

  ui: {
    rootfsPath: `${IMAGES_DIR}/xs-code-agent`,
    env: agentEnv("ui"),
  },

  frontend: {
    rootfsPath: `${IMAGES_DIR}/xs-code-agent`,
    env: agentEnv("frontend"),
  },

  cto: {
    rootfsPath: `${IMAGES_DIR}/xs-code-agent`,
    env: agentEnv("cto"),
  },

  qa: {
    // 预装了 Playwright + gh + claude-code
    rootfsPath: `${IMAGES_DIR}/xs-code-agent-qa`,
    env: agentEnv("qa"),
  },
};
