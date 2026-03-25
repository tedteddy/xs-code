/**
 * db9.ai 集成
 *
 * 为 orchestrator 提供 agent 运行记录功能。
 * 如果未设置 DB9_API_TOKEN，所有操作静默跳过，不影响主流程。
 *
 * 环境变量：
 *   DB9_API_TOKEN     — db9.ai API token（必须）
 *   DB9_DATABASE_ID   — 已有数据库 ID（可选，设置后跳过创建步骤）
 */

import { Db9Client, initBrainSchema } from "@sandbank.dev/db9";

let _client: Db9Client | null = null;
let _dbId: string | null = null;

function getClient(): Db9Client | null {
  if (!process.env.DB9_API_TOKEN) return null;
  if (!_client) {
    _client = new Db9Client({ token: process.env.DB9_API_TOKEN });
  }
  return _client;
}

/**
 * 初始化 db9 数据库。
 * - 若设置了 DB9_DATABASE_ID，直接复用；
 * - 否则创建新数据库并初始化 brain schema（memory / tasks / artifacts 表）。
 *
 * @returns dbId（成功），null（未配置 token 或初始化失败）
 */
export async function initDb9(projectName: string): Promise<string | null> {
  const client = getClient();
  if (!client) {
    console.log("[db9] DB9_API_TOKEN 未设置，跳过 db9 初始化");
    return null;
  }

  try {
    if (process.env.DB9_DATABASE_ID) {
      _dbId = process.env.DB9_DATABASE_ID;
      console.log(`[db9] 复用已有数据库 ${_dbId}`);
      return _dbId;
    }

    const db = await client.createDatabase(projectName);
    await initBrainSchema(client, db.id);
    _dbId = db.id;
    console.log(`[db9] ✅ 数据库已创建：${db.id}`);
    console.log(`[db9] 提示：设置 DB9_DATABASE_ID=${db.id} 可在下次运行时复用`);
    return _dbId;
  } catch (err) {
    console.error("[db9] 初始化失败，跳过记录功能：", err);
    return null;
  }
}

/** 转义 PostgreSQL 字符串中的单引号 */
function escape(s: string): string {
  return s.replace(/'/g, "''");
}

/**
 * 将 agent 运行记录写入 memory 表。
 *
 * @param opts.role    agent 角色（pm / ui / frontend / cto / qa）
 * @param opts.scope   所属阶段（如 "pm" / "ui" / "frontend"）
 * @param opts.kind    记录类型（"task_input" / "task_output" / "review_result"）
 * @param opts.content 内容正文
 */
export async function recordRun(opts: {
  role: string;
  scope: string;
  kind: string;
  content: string;
}): Promise<void> {
  const client = getClient();
  if (!client || !_dbId) return;

  try {
    await client.executeSQL(
      _dbId,
      `INSERT INTO memory (agent, scope, kind, content)
       VALUES ('${escape(opts.role)}', '${escape(opts.scope)}', '${escape(opts.kind)}', '${escape(opts.content)}')`
    );
  } catch (err) {
    // 记录失败不中断主流程
    console.error(`[db9] 写入 memory 失败（${opts.role}/${opts.kind}）：`, err);
  }
}
