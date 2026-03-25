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
