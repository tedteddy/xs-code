#!/usr/bin/env bun
/**
 * 路由发现脚本 — 自动爬取网站的所有内部路由
 *
 * 原理：
 *   1. 从入口 URL 开始，提取页面上所有内部链接
 *   2. 模拟交互（hover 导航栏、点击汉堡菜单）来暴露隐藏链接
 *   3. 递归访问发现的新 URL，直到没有新路由
 *   4. 输出去重排序的 URL 列表
 *
 * 用法：
 *   bun run discover-routes.ts --start https://example.com
 *   bun run discover-routes.ts --start https://example.com --output urls.txt
 *   bun run discover-routes.ts --start https://example.com --max-depth 3 --no-interact
 *
 * 选项：
 *   --start <url>       起始 URL（必填）
 *   --output <file>     输出文件路径（默认 urls.txt）
 *   --max-depth <n>     最大递归深度（默认 5）
 *   --delay <ms>        页面间延迟毫秒数（默认 800）
 *   --timeout <ms>      页面加载超时（默认 15000）
 *   --no-interact       跳过交互式发现（不 hover/click，只解析静态链接）
 *   --include <path>    只保留包含此路径前缀的 URL（可多次使用）
 *   --exclude <path>    排除包含此路径的 URL（可多次使用）
 *
 * 输出管线：
 *   bun run discover-routes.ts --start https://example.com
 *   bun run scrape-site.ts --file urls.txt
 *
 * 依赖：
 *   bun add playwright
 *   bunx playwright install chromium
 */

import { chromium, type Page, type Browser } from "playwright";
import { parseArgs } from "util";
import { writeFile } from "fs/promises";

// ── CLI 参数 ─────────────────────────────────────────────────

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    start: { type: "string" },
    output: { type: "string", default: "urls.txt" },
    "max-depth": { type: "string", default: "5" },
    delay: { type: "string", default: "800" },
    timeout: { type: "string", default: "15000" },
    "no-interact": { type: "boolean", default: false },
    include: { type: "string", multiple: true },
    exclude: { type: "string", multiple: true },
  },
  strict: true,
});

if (!values.start) {
  console.error("错误：请提供起始 URL（--start https://example.com）");
  process.exit(1);
}

const START_URL = values.start;
const OUTPUT_FILE = values.output!;
const MAX_DEPTH = parseInt(values["max-depth"]!, 10);
const DELAY = parseInt(values.delay!, 10);
const TIMEOUT = parseInt(values.timeout!, 10);
const SKIP_INTERACT = values["no-interact"]!;
const INCLUDE_PATHS = values.include ?? [];
const EXCLUDE_PATHS = values.exclude ?? [];

const startOrigin = new URL(START_URL).origin;

// ── URL 规范化与过滤 ─────────────────────────────────────────

function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);

    // 只要同域
    if (url.origin !== startOrigin) return null;

    // 跳过非页面资源
    const skip = [
      ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp",
      ".css", ".js", ".ico", ".xml", ".json", ".zip", ".mp4", ".mp3",
    ];
    const lower = url.pathname.toLowerCase();
    if (skip.some((ext) => lower.endsWith(ext))) return null;

    // 跳过 mailto:, tel:, javascript:
    if (["mailto:", "tel:", "javascript:"].some((p) => href.startsWith(p)))
      return null;

    // 移除 hash，保留 pathname + search
    url.hash = "";

    // 规范化尾部斜杠：如果路径非根且无扩展名，统一加 /
    if (url.pathname !== "/" && !url.pathname.endsWith("/")) {
      const lastSegment = url.pathname.split("/").pop() ?? "";
      if (!lastSegment.includes(".")) {
        url.pathname += "/";
      }
    }

    return url.toString();
  } catch {
    return null;
  }
}

function shouldInclude(url: string): boolean {
  const path = new URL(url).pathname;

  if (EXCLUDE_PATHS.length > 0) {
    if (EXCLUDE_PATHS.some((ex) => path.includes(ex))) return false;
  }

  if (INCLUDE_PATHS.length > 0) {
    return INCLUDE_PATHS.some((inc) => path.startsWith(inc));
  }

  return true;
}

// ── 静态链接提取 ─────────────────────────────────────────────

async function extractStaticLinks(page: Page): Promise<string[]> {
  const currentUrl = page.url();
  const hrefs = await page.evaluate(() => {
    const anchors = document.querySelectorAll("a[href]");
    return Array.from(anchors).map((a) => a.getAttribute("href") ?? "");
  });

  const urls: string[] = [];
  for (const href of hrefs) {
    const normalized = normalizeUrl(href, currentUrl);
    if (normalized && shouldInclude(normalized)) {
      urls.push(normalized);
    }
  }
  return urls;
}

// ── 交互式链接发现 ───────────────────────────────────────────
// 通过 hover / click 暴露隐藏的导航链接

async function extractInteractiveLinks(page: Page): Promise<string[]> {
  const beforeLinks = await extractStaticLinks(page);

  // 策略 1: Hover 所有导航栏链接（触发下拉菜单）
  try {
    const navLinks = await page.locator("nav a, header a, [role='navigation'] a").all();
    for (const link of navLinks.slice(0, 30)) {
      // 上限 30，避免太慢
      try {
        await link.hover({ timeout: 500 });
        await page.waitForTimeout(200);
      } catch {
        // 元素不可见或已销毁，跳过
      }
    }
  } catch {
    // nav 不存在
  }

  // 策略 2: 点击常见的汉堡菜单 / 移动端菜单按钮
  const menuSelectors = [
    'button[aria-label*="menu" i]',
    'button[aria-label*="nav" i]',
    'button[class*="hamburger" i]',
    'button[class*="menu" i]',
    'button[class*="mobile" i]',
    '[class*="hamburger" i]',
    '[class*="menu-toggle" i]',
    '[class*="nav-toggle" i]',
    "#menu-toggle",
    ".mobile-menu-button",
  ];

  for (const selector of menuSelectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 300 })) {
        await btn.click({ timeout: 500 });
        await page.waitForTimeout(500);
        break; // 只点一个菜单按钮
      }
    } catch {
      // 该选择器不存在
    }
  }

  // 策略 3: Hover 有子菜单指示的元素（含 aria-expanded, 含 ▼ 等）
  try {
    const dropdownTriggers = await page
      .locator('[aria-expanded], [aria-haspopup], [class*="dropdown" i]')
      .all();
    for (const trigger of dropdownTriggers.slice(0, 15)) {
      try {
        await trigger.hover({ timeout: 500 });
        await page.waitForTimeout(300);
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }

  // 策略 4：点击 Footer 中可能折叠的 section
  try {
    const footerToggles = await page
      .locator("footer button, footer [role='button'], footer summary")
      .all();
    for (const toggle of footerToggles.slice(0, 10)) {
      try {
        await toggle.click({ timeout: 500 });
        await page.waitForTimeout(200);
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }

  // 交互完成后，重新提取所有链接
  const afterLinks = await extractStaticLinks(page);

  // 返回交互后新发现的链接
  const beforeSet = new Set(beforeLinks);
  const newLinks = afterLinks.filter((l) => !beforeSet.has(l));

  if (newLinks.length > 0) {
    console.log(`    ↳ 交互发现 ${newLinks.length} 个隐藏链接`);
  }

  return [...new Set([...beforeLinks, ...afterLinks])];
}

// ── BFS 爬取 ─────────────────────────────────────────────────

interface CrawlResult {
  url: string;
  title: string;
  depth: number;
  linksFound: number;
}

async function crawl(browser: Browser): Promise<CrawlResult[]> {
  const visited = new Set<string>();
  const results: CrawlResult[] = [];
  const queue: { url: string; depth: number }[] = [
    { url: normalizeUrl(START_URL, START_URL) ?? START_URL, depth: 0 },
  ];

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  while (queue.length > 0) {
    const { url, depth } = queue.shift()!;

    if (visited.has(url)) continue;
    if (depth > MAX_DEPTH) continue;

    visited.add(url);
    const index = visited.size;
    console.log(`[${index}] depth=${depth} ${url}`);

    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
      await page.waitForTimeout(500);

      // 获取页面标题
      const title = await page.title();

      // 提取链接
      const links = SKIP_INTERACT
        ? await extractStaticLinks(page)
        : await extractInteractiveLinks(page);

      const newLinks = links.filter((l) => !visited.has(l));
      for (const link of newLinks) {
        queue.push({ url: link, depth: depth + 1 });
      }

      results.push({
        url,
        title: title || url,
        depth,
        linksFound: newLinks.length,
      });

      console.log(
        `  ✓ "${title}" — ${links.length} links, ${newLinks.length} new`
      );

      await page.close();

      if (queue.length > 0) {
        await new Promise((r) => setTimeout(r, DELAY));
      }
    } catch (err) {
      console.error(`  ✗ 失败: ${(err as Error).message}`);
      results.push({ url, title: "(failed)", depth, linksFound: 0 });
    }
  }

  await context.close();
  return results;
}

// ── 输出 ─────────────────────────────────────────────────────

async function writeResults(results: CrawlResult[]) {
  // urls.txt — 纯 URL 列表，可直接传给 scrape-site.ts
  const urls = results
    .filter((r) => r.title !== "(failed)")
    .map((r) => r.url)
    .sort();

  await writeFile(OUTPUT_FILE, urls.join("\n") + "\n", "utf-8");
  console.log(`\n✓ 已写入 ${urls.length} 个 URL → ${OUTPUT_FILE}`);

  // route-audit.md — 详细路由审计报告
  const auditFile = OUTPUT_FILE.replace(/\.[^.]+$/, "") + "-audit.md";
  const auditLines = [
    "# 路由审计报告",
    "",
    `起始 URL: ${START_URL}`,
    `发现时间: ${new Date().toISOString()}`,
    `总路由数: ${urls.length}`,
    `最大深度: ${MAX_DEPTH}`,
    `交互式发现: ${SKIP_INTERACT ? "关闭" : "开启"}`,
    "",
    "## 路由列表",
    "",
    "| URL | 页面标题 | 深度 |",
    "|-----|---------|------|",
    ...results
      .filter((r) => r.title !== "(failed)")
      .sort((a, b) => a.url.localeCompare(b.url))
      .map((r) => `| ${r.url} | ${r.title} | ${r.depth} |`),
    "",
  ];

  // 按路径层级分组展示
  const byPath = new Map<string, string[]>();
  for (const url of urls) {
    const path = new URL(url).pathname;
    const segments = path.split("/").filter(Boolean);
    const prefix = segments.length > 0 ? `/${segments[0]}/` : "/";
    if (!byPath.has(prefix)) byPath.set(prefix, []);
    byPath.get(prefix)!.push(path);
  }

  auditLines.push("## 按路径分组");
  auditLines.push("");
  for (const [prefix, paths] of [...byPath.entries()].sort()) {
    auditLines.push(`### ${prefix}`);
    for (const p of paths.sort()) {
      auditLines.push(`- ${p}`);
    }
    auditLines.push("");
  }

  // 失败的 URL
  const failed = results.filter((r) => r.title === "(failed)");
  if (failed.length > 0) {
    auditLines.push("## 访问失败的 URL");
    auditLines.push("");
    for (const r of failed) {
      auditLines.push(`- ${r.url}`);
    }
    auditLines.push("");
  }

  await writeFile(auditFile, auditLines.join("\n"), "utf-8");
  console.log(`✓ 路由审计报告 → ${auditFile}`);
}

// ── 主流程 ───────────────────────────────────────────────────

async function main() {
  console.log(`开始路由发现: ${START_URL}`);
  console.log(
    `配置: depth=${MAX_DEPTH}, delay=${DELAY}ms, interact=${!SKIP_INTERACT}`
  );
  console.log("");

  const browser = await chromium.launch({ headless: true });

  try {
    const results = await crawl(browser);
    await writeResults(results);

    console.log("\n下一步：");
    console.log(`  bun run scrape-site.ts --file ${OUTPUT_FILE}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("致命错误:", err);
  process.exit(1);
});
