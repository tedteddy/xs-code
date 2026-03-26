# Agent 账号凭证配置

每个 microVM 运行一个独立的 agent，各自持有不同的服务账号。
所有 key 填写在根目录 `.env` 文件中，运行时由 Bun 自动加载。

---

## GitHub

每个 agent 需要一个独立的 GitHub **Personal Access Token（PAT）**。

| env 变量           | agent  | 用途                         |
|--------------------|--------|------------------------------|
| `PM_GH_TOKEN`      | pm     | 创建 issue、管理 project card |
| `UI_GH_TOKEN`      | ui     | 提交 UI spec 文件             |
| `FRONTEND_GH_TOKEN`| frontend | 提交代码、创建 PR           |
| `CTO_GH_TOKEN`     | cto    | Review PR、approve/request changes |
| `QA_GH_TOKEN`      | qa     | 提交测试结果 issue            |

**创建 PAT：** GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens

所需权限（按角色最小权限原则）：
- **pm / ui / qa**：`issues: write`, `contents: read`
- **frontend**：`contents: write`, `pull-requests: write`
- **cto**：`pull-requests: write`（review + approve）

token 在 sandbox 内通过 `GH_TOKEN` 环境变量生效，agent 直接使用 `gh` CLI，**无需手动 `gh auth login`**。

---

## Git 提交身份

每个 agent 提交代码时使用独立的 git 用户名和邮箱。

| env 变量             | 说明                  |
|----------------------|-----------------------|
| `PM_GIT_USER`        | PM agent git 用户名   |
| `PM_GIT_EMAIL`       | PM agent git 邮箱     |
| `UI_GIT_USER`        | UI agent git 用户名   |
| `UI_GIT_EMAIL`       | UI agent git 邮箱     |
| `FRONTEND_GIT_USER`  | Frontend agent 用户名 |
| `FRONTEND_GIT_EMAIL` | Frontend agent 邮箱   |
| `CTO_GIT_USER`       | CTO agent 用户名      |
| `CTO_GIT_EMAIL`      | CTO agent 邮箱        |
| `QA_GIT_USER`        | QA agent 用户名       |
| `QA_GIT_EMAIL`       | QA agent 邮箱         |

这些值通过标准 git 环境变量（`GIT_AUTHOR_NAME` 等）注入，无需在 sandbox 内执行 `git config`。

---

## Linear

Linear 没有官方 CLI，agent 通过 `LINEAR_API_KEY` 直接调用 GraphQL API（`https://api.linear.app/graphql`）。

| env 变量           | agent    | 用途                              |
|--------------------|----------|-----------------------------------|
| `PM_LINEAR_KEY`    | pm       | 创建 Epic、Story，管理 Backlog    |
| `FRONTEND_LINEAR_KEY` | frontend | 更新 task 状态（In Progress → Done） |
| `CTO_LINEAR_KEY`   | cto      | 标记 review cycle 完成             |
| `QA_LINEAR_KEY`    | qa       | 创建 bug report task              |

**获取 API Key：** Linear → Settings → API → Personal API keys → Create key

---

## .env 模板

将以下内容追加到项目根目录的 `.env`：

```env
# ── GitHub PAT（每 agent 独立账号）─────────────────────────────
PM_GH_TOKEN=
UI_GH_TOKEN=
FRONTEND_GH_TOKEN=
CTO_GH_TOKEN=
QA_GH_TOKEN=

# ── Git 提交身份 ─────────────────────────────────────────────────
PM_GIT_USER=xs-pm-agent
PM_GIT_EMAIL=
UI_GIT_USER=xs-ui-agent
UI_GIT_EMAIL=
FRONTEND_GIT_USER=xs-frontend-agent
FRONTEND_GIT_EMAIL=
CTO_GIT_USER=xs-cto-agent
CTO_GIT_EMAIL=
QA_GIT_USER=xs-qa-agent
QA_GIT_EMAIL=

# ── Linear API Key（每 agent 独立账号）──────────────────────────
PM_LINEAR_KEY=
FRONTEND_LINEAR_KEY=
CTO_LINEAR_KEY=
QA_LINEAR_KEY=
```

---

## 注意

- `.env` 已加入 `.gitignore`，不会提交到仓库
- `UI_LINEAR_KEY` 不需要，UI agent 只负责设计产出，不操作 Linear
- 如果某个 agent 暂时不需要某项服务，对应 key 留空即可，sandbox 内命令不会因此报错
