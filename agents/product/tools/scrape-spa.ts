#!/usr/bin/env bun
/**
 * SPA 网站爬取脚本 — 适配 hash-based routing（#/ 路由）
 *
 * 基于 website-rebuild skill 的 scrape-site.ts 修改，
 * 专门处理 Vue/React SPA 的 hash 路由和客户端渲染。
 *
 * 用法：
 *   bun run scripts/scrape-spa.ts --file scripts/urls.txt
 *   bun run scripts/scrape-spa.ts --url "https://www.xs-code.com/#/goods"
 *
 * 选项：
 *   --output <dir>    输出目录（默认 scraped-content）
 *   --delay <ms>      页面间延迟毫秒数（默认 1500）
 *   --timeout <ms>    页面加载超时毫秒数（默认 30000）
 */

import { chromium, type Page } from "playwright";
import { parseArgs } from "util";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";

// ── CLI 参数解析 ──────────────────────────────────────────────

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    url: { type: "string", multiple: true },
    file: { type: "string" },
    output: { type: "string", default: "scraped-content" },
    delay: { type: "string", default: "1500" },
    timeout: { type: "string", default: "30000" },
  },
  strict: true,
});

const OUTPUT_DIR = values.output!;
const DELAY = parseInt(values.delay!, 10);
const TIMEOUT = parseInt(values.timeout!, 10);

// ── URL 收集 ─────────────────────────────────────────────────

async function collectUrls(): Promise<string[]> {
  const urls: string[] = [];

  if (values.url) {
    urls.push(...values.url);
  }

  if (values.file) {
    const content = await readFile(values.file, "utf-8");
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    urls.push(...lines);
  }

  if (urls.length === 0) {
    console.error("错误：请提供至少一个 URL（--url 或 --file）");
    process.exit(1);
  }

  return [...new Set(urls)];
}

// ── Hash URL → 文件名（适配 #/ 路由）─────────────────────────

function urlToSlug(url: string): string {
  const u = new URL(url);
  const hash = u.hash || "#/";
  // 提取 hash 路径部分，去掉 #/ 前缀和查询参数
  let path = hash.replace(/^#\/?/, "").split("?")[0];
  if (!path) return "index";
  // 将 / 替换为 -，清理特殊字符
  return path.replace(/\//g, "-").replace(/[^a-zA-Z0-9\-]/g, "").toLowerCase();
}

// ── DOM → Markdown 转换器 ────────────────────────────────────

const domToMarkdown = () => {
  function nodeToMd(node: Node, listDepth = 0, ordered = false, listIndex = 0): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      return text.replace(/\s+/g, " ");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (["script", "style", "noscript", "svg", "template"].includes(tag)) return "";

    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return "";

    const childContent = () => {
      let result = "";
      for (const child of Array.from(node.childNodes)) {
        result += nodeToMd(child, listDepth, ordered, listIndex);
      }
      return result;
    };

    switch (tag) {
      case "h1": return `\n\n# ${childContent().trim()}\n\n`;
      case "h2": return `\n\n## ${childContent().trim()}\n\n`;
      case "h3": return `\n\n### ${childContent().trim()}\n\n`;
      case "h4": return `\n\n#### ${childContent().trim()}\n\n`;
      case "h5": return `\n\n##### ${childContent().trim()}\n\n`;
      case "h6": return `\n\n###### ${childContent().trim()}\n\n`;

      case "p": return `\n\n${childContent().trim()}\n\n`;
      case "blockquote": {
        const inner = childContent().trim();
        return "\n\n" + inner.split("\n").map((l) => `> ${l}`).join("\n") + "\n\n";
      }
      case "pre": {
        const code = el.querySelector("code");
        const lang = code?.className?.match(/language-(\w+)/)?.[1] ?? "";
        const text = el.textContent ?? "";
        return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
      }
      case "hr": return "\n\n---\n\n";
      case "br": return "\n";

      case "ul": {
        let result = "\n";
        let idx = 0;
        for (const child of Array.from(el.children)) {
          if (child.tagName.toLowerCase() === "li") {
            result += nodeToMd(child, listDepth, false, idx++);
          }
        }
        return result + "\n";
      }
      case "ol": {
        let result = "\n";
        let idx = 0;
        for (const child of Array.from(el.children)) {
          if (child.tagName.toLowerCase() === "li") {
            result += nodeToMd(child, listDepth, true, idx++);
          }
        }
        return result + "\n";
      }
      case "li": {
        const indent = "  ".repeat(listDepth);
        const marker = ordered ? `${listIndex + 1}. ` : "- ";
        let text = "";
        let subList = "";
        for (const child of Array.from(node.childNodes)) {
          const childTag = (child as HTMLElement).tagName?.toLowerCase();
          if (childTag === "ul" || childTag === "ol") {
            subList += nodeToMd(child, listDepth + 1, childTag === "ol", 0);
          } else {
            text += nodeToMd(child, listDepth, ordered, listIndex);
          }
        }
        return `${indent}${marker}${text.trim()}${subList ? "\n" + subList : ""}\n`;
      }

      case "table": {
        const rows: string[][] = [];
        const allRows = el.querySelectorAll("tr");
        for (const row of Array.from(allRows)) {
          const cells = Array.from(row.querySelectorAll("th, td")).map(
            (cell) => (cell.textContent ?? "").trim().replace(/\|/g, "\\|")
          );
          if (cells.length > 0) rows.push(cells);
        }
        if (rows.length === 0) return "";
        const colCount = Math.max(...rows.map((r) => r.length));
        const normalized = rows.map((r) => {
          while (r.length < colCount) r.push("");
          return r;
        });
        let result = "\n\n";
        result += "| " + normalized[0].join(" | ") + " |\n";
        result += "| " + normalized[0].map(() => "---").join(" | ") + " |\n";
        for (let i = 1; i < normalized.length; i++) {
          result += "| " + normalized[i].join(" | ") + " |\n";
        }
        return result + "\n";
      }
      case "thead": case "tbody": case "tfoot": case "tr":
      case "td": case "th": case "colgroup": case "col":
        return "";

      case "a": {
        const href = el.getAttribute("href") ?? "";
        const text = childContent().trim();
        if (!text) return "";
        if (href && !href.startsWith("javascript:")) {
          return `[${text}](${href})`;
        }
        return text;
      }
      case "strong": case "b": {
        const text = childContent().trim();
        return text ? `**${text}**` : "";
      }
      case "em": case "i": {
        const text = childContent().trim();
        return text ? `*${text}*` : "";
      }
      case "code": {
        const text = el.textContent ?? "";
        return text ? `\`${text}\`` : "";
      }
      case "del": case "s": {
        const text = childContent().trim();
        return text ? `~~${text}~~` : "";
      }

      case "img": {
        const src = el.getAttribute("src") ?? "";
        const alt = el.getAttribute("alt") ?? "";
        if (!src || src.startsWith("data:")) return "";
        return `![${alt}](${src})`;
      }

      case "video": return `\n\n[Video: ${el.getAttribute("src") ?? el.querySelector("source")?.getAttribute("src") ?? ""}]\n\n`;
      case "iframe": {
        const src = el.getAttribute("src") ?? "";
        return src ? `\n\n[Embed: ${src}]\n\n` : "";
      }

      case "button": return `[Button: ${childContent().trim()}]`;
      case "input": {
        const type = el.getAttribute("type") ?? "text";
        const placeholder = el.getAttribute("placeholder") ?? "";
        const label = el.getAttribute("aria-label") ?? "";
        return `[Input(${type}): ${label || placeholder || ""}]`;
      }
      case "select": return `[Select: ${childContent().trim()}]`;
      case "textarea": return `[Textarea: ${el.getAttribute("placeholder") ?? ""}]`;
      case "label": return childContent();
      case "form": return `\n\n[Form]\n${childContent()}\n[/Form]\n\n`;

      case "div": case "section": case "article": case "aside":
      case "main": case "figure": case "figcaption": case "details":
      case "summary": case "span": case "small": case "time":
      case "address": case "cite": case "abbr": case "dfn":
      case "dl": {
        return childContent();
      }
      case "dt": return `\n**${childContent().trim()}**\n`;
      case "dd": return `${childContent().trim()}\n`;

      default:
        return childContent();
    }
  }

  return nodeToMd;
};

// ── 提取结果类型 ─────────────────────────────────────────────

interface SharedComponents {
  header: string;
  footer: string;
}

interface PageResult {
  url: string;
  title: string;
  bodyMarkdown: string;
  assetUrls: string[];
  phones: string[];
  emails: string[];
}

// ── 提取共用组件 ─────────────────────────────────────────────

async function extractSharedComponents(page: Page): Promise<SharedComponents> {
  return await page.evaluate((converterStr) => {
    const nodeToMd = new Function("return (" + converterStr + ")()")() as ReturnType<typeof domToMarkdown>;

    const extractPart = (selectors: string[]): string => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return nodeToMd(el).trim();
      }
      return "";
    };

    const header = extractPart(["header", '[role="banner"]', "#header", ".header"]);
    const footer = extractPart(["footer", '[role="contentinfo"]', "#footer", ".footer"]);

    return { header, footer };
  }, domToMarkdown.toString());
}

// ── 提取页面主体内容 ─────────────────────────────────────────

async function extractPageContent(page: Page): Promise<PageResult> {
  return await page.evaluate((converterStr) => {
    const nodeToMd = new Function("return (" + converterStr + ")()")() as ReturnType<typeof domToMarkdown>;

    const title = document.title || document.querySelector("h1")?.textContent?.trim() || "";

    // 克隆 #app（SPA 根节点），移除共用组件后转换
    const appEl = document.querySelector("#app") || document.body;
    const clone = appEl.cloneNode(true) as HTMLElement;
    const removeSelectors = [
      "header", '[role="banner"]', "#header", ".header",
      "footer", '[role="contentinfo"]', "#footer", ".footer",
      "nav", '[role="navigation"]',
      "script", "style", "noscript", "link",
    ];
    for (const sel of removeSelectors) {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    }

    const bodyMarkdown = nodeToMd(clone).trim();

    // 收集资源 URL
    const assetUrls: string[] = [];
    const resolveUrl = (raw: string): string => {
      if (!raw || raw.startsWith("data:") || raw.startsWith("javascript:")) return "";
      try { return new URL(raw, window.location.href).href; } catch { return ""; }
    };
    const addUrl = (u: string) => { if (u) assetUrls.push(u); };

    document.querySelectorAll("img").forEach((img) => {
      addUrl(resolveUrl(img.getAttribute("src") ?? ""));
      const srcset = img.getAttribute("srcset") ?? "";
      srcset.split(",").forEach((entry) => {
        const src = entry.trim().split(/\s+/)[0];
        if (src) addUrl(resolveUrl(src));
      });
    });

    // CSS 背景图
    document.querySelectorAll("[style]").forEach((el) => {
      const style = el.getAttribute("style") ?? "";
      const bgMatch = style.match(/url\(["']?([^"')]+)["']?\)/);
      if (bgMatch) addUrl(resolveUrl(bgMatch[1]));
    });

    // 视频
    document.querySelectorAll("video, video source").forEach((el) => {
      addUrl(resolveUrl(el.getAttribute("src") ?? ""));
    });

    const uniqueAssetUrls = [...new Set(assetUrls)];

    // 提取关键数据
    const bodyText = document.body.textContent ?? "";
    const phones = [...new Set(
      bodyText.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}|(?:\d{3,4}[-\s])?\d{7,8}/g) ?? []
    )];
    const emails = [...new Set(
      bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []
    )];

    return { url: window.location.href, title, bodyMarkdown, assetUrls: uniqueAssetUrls, phones, emails };
  }, domToMarkdown.toString());
}

// ── 资源下载 ─────────────────────────────────────────────────

const MAX_ASSET_SIZE = 100 * 1024 * 1024;
const downloadedAssets = new Map<string, string>();
const skippedAssets: { url: string; page: string; reason: string }[] = [];

function assetFilename(url: string, pageSlug: string): string {
  const u = new URL(url);
  let name = u.pathname.split("/").filter(Boolean).pop() ?? "asset";
  if (!/\.\w{2,5}$/.test(name)) name += ".bin";
  name = name.replace(/[?#&=]/g, "_");

  const prefix = `assets/${pageSlug}/`;
  const existing = [...downloadedAssets.values()].filter((v) => v.startsWith(prefix));
  const existingNames = existing.map((v) => v.slice(prefix.length));
  if (existingNames.includes(name)) {
    const ext = name.lastIndexOf(".");
    const base = name.slice(0, ext);
    const suffix = name.slice(ext);
    let i = 2;
    while (existingNames.includes(`${base}-${i}${suffix}`)) i++;
    name = `${base}-${i}${suffix}`;
  }
  return name;
}

async function downloadAssets(assetUrls: string[], assetsDir: string, pageSlug: string): Promise<void> {
  const pageAssetsDir = join(assetsDir, pageSlug);
  let dirCreated = false;

  for (const url of assetUrls) {
    if (downloadedAssets.has(url)) continue;

    const filename = assetFilename(url, pageSlug);
    const relativePath = `assets/${pageSlug}/${filename}`;

    try {
      const head = await fetch(url, { method: "HEAD" }).catch(() => null);
      const size = parseInt(head?.headers.get("content-length") ?? "0", 10);
      if (size > MAX_ASSET_SIZE) {
        skippedAssets.push({ url, page: pageSlug, reason: `文件过大 (${(size / 1024 / 1024).toFixed(1)}MB)` });
        downloadedAssets.set(url, relativePath);
        continue;
      }

      const res = await fetch(url);
      if (!res.ok) {
        skippedAssets.push({ url, page: pageSlug, reason: `HTTP ${res.status}` });
        continue;
      }

      if (!dirCreated) {
        await mkdir(pageAssetsDir, { recursive: true });
        dirCreated = true;
      }

      const buffer = await res.arrayBuffer();
      await writeFile(join(pageAssetsDir, filename), Buffer.from(buffer));
      downloadedAssets.set(url, relativePath);
    } catch (err) {
      skippedAssets.push({ url, page: pageSlug, reason: (err as Error).message });
    }
  }
}

function replaceImageUrls(markdown: string): string {
  let result = markdown;
  for (const [url, relativePath] of downloadedAssets) {
    result = result.replaceAll(url, relativePath);
  }
  return result;
}

// ── Markdown 输出格式 ────────────────────────────────────────

function formatPageMarkdown(result: PageResult): string {
  const lines: string[] = [];

  lines.push(`# ${result.title}`);
  lines.push("");
  lines.push(`> Source: ${result.url}`);
  lines.push("");

  if (result.phones.length || result.emails.length) {
    lines.push("## 提取的关键数据");
    lines.push("");
    if (result.phones.length) lines.push(`**电话:** ${result.phones.join(", ")}`);
    if (result.emails.length) lines.push(`**邮箱:** ${result.emails.join(", ")}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  const cleaned = result.bodyMarkdown.replace(/\n{3,}/g, "\n\n");
  lines.push(cleaned);

  return lines.join("\n");
}

function formatSharedComponent(name: string, content: string, sourceUrl: string): string {
  return [
    `# ${name}`,
    "",
    `> 提取自: ${sourceUrl}`,
    `> 此为全站共用组件，所有页面共享`,
    "",
    "---",
    "",
    content.replace(/\n{3,}/g, "\n\n"),
    "",
  ].join("\n");
}

// ── 主流程 ───────────────────────────────────────────────────

async function main() {
  const urls = await collectUrls();
  console.log(`准备爬取 ${urls.length} 个页面（SPA hash 路由模式）...\n`);

  await mkdir(OUTPUT_DIR, { recursive: true });
  const assetsDir = join(OUTPUT_DIR, "assets");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const indexEntries: { slug: string; title: string; url: string }[] = [];

  // SPA 只需打开一个 page，通过 hash 导航切换
  const page = await context.newPage();

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const slug = urlToSlug(url);
    console.log(`[${i + 1}/${urls.length}] ${url} → ${slug}.md`);

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: TIMEOUT });
      // SPA 需要额外等待客户端渲染完成
      await page.waitForTimeout(2000);

      // 第一个页面：提取 header 和 footer
      if (i === 0) {
        console.log("  ⊕ 提取共用组件 (header / footer)...");
        const shared = await extractSharedComponents(page);

        if (shared.header) {
          await writeFile(
            join(OUTPUT_DIR, "_header.md"),
            formatSharedComponent("Header / Navigation", shared.header, url),
            "utf-8"
          );
          console.log("    ✓ _header.md");
        }

        if (shared.footer) {
          await writeFile(
            join(OUTPUT_DIR, "_footer.md"),
            formatSharedComponent("Footer", shared.footer, url),
            "utf-8"
          );
          console.log("    ✓ _footer.md");
        }
      }

      const result = await extractPageContent(page);
      result.url = url;

      if (result.assetUrls.length > 0) {
        await downloadAssets(result.assetUrls, assetsDir, slug);
      }

      const markdown = replaceImageUrls(formatPageMarkdown(result));
      await writeFile(join(OUTPUT_DIR, `${slug}.md`), markdown, "utf-8");

      indexEntries.push({ slug, title: result.title, url });

      const contentLines = result.bodyMarkdown.split("\n").filter((l) => l.trim()).length;
      const assetCount = result.assetUrls.length;
      console.log(`  ✓ ${contentLines} 行内容, ${assetCount} 个资源`);

      if (i < urls.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY));
      }
    } catch (err) {
      console.error(`  ✗ 失败: ${(err as Error).message}`);
    }
  }

  // 生成索引文件
  const indexLines = [
    "# 爬取内容索引",
    "",
    `> 爬取时间: ${new Date().toISOString()}`,
    `> 共 ${indexEntries.length} 个页面`,
    `> 模式: SPA hash-based routing`,
    "",
    "## 共用组件",
    "",
    "- [_header.md](_header.md) — Header / 导航栏",
    "- [_footer.md](_footer.md) — Footer",
    "",
    "## 页面内容",
    "",
    "| 文件 | URL |",
    "|------|-----|",
    ...indexEntries.map(
      (e) => `| [${e.slug}.md](${e.slug}.md) | ${e.url} |`
    ),
    "",
    `## 已下载资源 (${downloadedAssets.size} 个)`,
    "",
    "保存在 `assets/` 目录下。",
    "",
  ];

  if (skippedAssets.length > 0) {
    indexLines.push(`## 未下载的资源 (${skippedAssets.length} 个)`);
    indexLines.push("");
    indexLines.push("| URL | 所属页面 | 原因 |");
    indexLines.push("|-----|---------|------|");
    for (const { url, page: p, reason } of skippedAssets) {
      indexLines.push(`| ${url} | ${p} | ${reason} |`);
    }
    indexLines.push("");
  }

  await writeFile(join(OUTPUT_DIR, "_index.md"), indexLines.join("\n"), "utf-8");

  await browser.close();
  console.log(`\n完成！输出目录: ${OUTPUT_DIR}/`);
  console.log(`  共用组件: _header.md, _footer.md`);
  console.log(`  页面内容: ${indexEntries.length} 个文件`);
  console.log(`  下载资源: ${downloadedAssets.size} 个文件 → assets/`);
  console.log(`  索引文件: _index.md`);
}

main().catch((err) => {
  console.error("致命错误:", err);
  process.exit(1);
});
