#!/usr/bin/env bun
/**
 * 通用网站爬取脚本 — Website Rebuild Skill 配套工具
 *
 * 特点：
 *   - 完整提取页面所有内容，不遗漏任何章节
 *   - Header / Footer / Nav 单独沉淀为共用组件文件
 *   - 每个页面只保存主体内容（去除共用部分）
 *   - 自动提取关键数据（价格、电话、邮箱、地址）
 *
 * 用法：
 *   bun run scrape-site.ts --url https://example.com/page1 --url https://example.com/page2
 *   bun run scrape-site.ts --file urls.txt
 *   bun run scrape-site.ts --sitemap https://example.com/sitemap.xml
 *
 * 选项：
 *   --output <dir>    输出目录（默认 scraped-content）
 *   --delay <ms>      页面间延迟毫秒数（默认 1000）
 *   --timeout <ms>    页面加载超时毫秒数（默认 30000）
 *
 * 输出：
 *   scraped-content/_header.md   — 全站共用 header（含导航结构）
 *   scraped-content/_footer.md   — 全站共用 footer
 *   scraped-content/_index.md    — 所有页面的索引
 *   scraped-content/{slug}.md    — 每个页面的完整主体内容
 *
 * 依赖：
 *   bun add playwright
 *   bunx playwright install chromium
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
    sitemap: { type: "string" },
    output: { type: "string", default: "scraped-content" },
    delay: { type: "string", default: "1000" },
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

  if (values.sitemap) {
    const res = await fetch(values.sitemap);
    const xml = await res.text();
    const matches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
    for (const match of matches) {
      urls.push(match[1]);
    }
  }

  if (urls.length === 0) {
    console.error("错误：请提供至少一个 URL（--url, --file, 或 --sitemap）");
    process.exit(1);
  }

  return [...new Set(urls)];
}

// ── URL → 文件名 ─────────────────────────────────────────────

function urlToSlug(url: string): string {
  const u = new URL(url);
  const path = u.pathname.replace(/^\/|\/$/g, "");
  if (!path) return "index";
  return path.replace(/\//g, "-");
}

// ── DOM → Markdown 转换器（在浏览器上下文中运行）──────────────

/**
 * 在 page.evaluate 内运行的完整 DOM → Markdown 转换器。
 * 递归遍历 DOM 树，将每个节点转为对应的 markdown 语法，
 * 不遗漏任何可见文本内容。
 */
const domToMarkdown = () => {
  function nodeToMd(node: Node, listDepth = 0, ordered = false, listIndex = 0): string {
    // 文本节点
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      // 压缩连续空白为单空格，但保留非空内容
      return text.replace(/\s+/g, " ");
    }

    // 非元素节点跳过
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // 跳过不可见元素和脚本
    if (["script", "style", "noscript", "svg", "template"].includes(tag)) return "";

    // 检查是否隐藏
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return "";

    // 递归获取子节点内容
    const childContent = () => {
      let result = "";
      for (const child of Array.from(node.childNodes)) {
        result += nodeToMd(child, listDepth, ordered, listIndex);
      }
      return result;
    };

    switch (tag) {
      // ── 标题 ──
      case "h1": return `\n\n# ${childContent().trim()}\n\n`;
      case "h2": return `\n\n## ${childContent().trim()}\n\n`;
      case "h3": return `\n\n### ${childContent().trim()}\n\n`;
      case "h4": return `\n\n#### ${childContent().trim()}\n\n`;
      case "h5": return `\n\n##### ${childContent().trim()}\n\n`;
      case "h6": return `\n\n###### ${childContent().trim()}\n\n`;

      // ── 段落和块元素 ──
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

      // ── 列表 ──
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
        // 子列表需要递归处理
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

      // ── 表格 ──
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
        // 确保每行列数一致
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
        // 表格子元素由 table case 统一处理，避免重复输出
        return "";

      // ── 内联元素 ──
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
      case "mark": {
        const text = childContent().trim();
        return text ? `==${text}==` : "";
      }
      case "sup": return `^(${childContent().trim()})`;
      case "sub": return `_(${childContent().trim()})`;

      // ── 图片 ──
      case "img": {
        const src = el.getAttribute("src") ?? "";
        const alt = el.getAttribute("alt") ?? "";
        if (!src || src.startsWith("data:")) return "";
        return `![${alt}](${src})`;
      }

      // ── 媒体 ──
      case "video": return `\n\n[Video: ${el.getAttribute("src") ?? el.querySelector("source")?.getAttribute("src") ?? ""}]\n\n`;
      case "iframe": {
        const src = el.getAttribute("src") ?? "";
        return src ? `\n\n[Embed: ${src}]\n\n` : "";
      }

      // ── 表单元素（保留文本信息）──
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

      // ── 语义化容器（透传内容）──
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
  metaDescription: string;
  bodyMarkdown: string;
  assetUrls: string[];
  prices: string[];
  phones: string[];
  emails: string[];
  addresses: string[];
}

// ── 提取共用组件（header / footer）─────────────────────────

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
    const metaDescription =
      document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";

    // 克隆 body，移除共用组件后转换剩余内容
    const clone = document.body.cloneNode(true) as HTMLElement;
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

    // 收集所有可下载资源的绝对 URL
    const assetUrls: string[] = [];
    const resolveUrl = (raw: string): string => {
      if (!raw || raw.startsWith("data:") || raw.startsWith("javascript:")) return "";
      try { return new URL(raw, window.location.href).href; } catch { return ""; }
    };
    const addUrl = (u: string) => { if (u) assetUrls.push(u); };

    // 图片
    document.querySelectorAll("img").forEach((img) => {
      addUrl(resolveUrl(img.getAttribute("src") ?? ""));
      // srcset 中的高清图
      const srcset = img.getAttribute("srcset") ?? "";
      srcset.split(",").forEach((entry) => {
        const src = entry.trim().split(/\s+/)[0];
        if (src) addUrl(resolveUrl(src));
      });
    });

    // 链接引用的文件（PDF、文档、压缩包等）
    const downloadExts = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|csv|txt|rtf|odt|ods|epub)$/i;
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") ?? "";
      if (downloadExts.test(href)) {
        addUrl(resolveUrl(href));
      }
    });

    // 自托管视频（不含 YouTube/Vimeo 等外部 embed）
    document.querySelectorAll("video, video source").forEach((el) => {
      addUrl(resolveUrl(el.getAttribute("src") ?? ""));
    });

    // 音频
    document.querySelectorAll("audio, audio source").forEach((el) => {
      addUrl(resolveUrl(el.getAttribute("src") ?? ""));
    });

    // CSS 背景图（常用于 hero banner）
    document.querySelectorAll("[style]").forEach((el) => {
      const style = el.getAttribute("style") ?? "";
      const bgMatch = style.match(/url\(["']?([^"')]+)["']?\)/);
      if (bgMatch) addUrl(resolveUrl(bgMatch[1]));
    });

    // 去重
    const uniqueAssetUrls = [...new Set(assetUrls)];

    // 提取关键数据
    const bodyText = document.body.textContent ?? "";
    const prices = [...new Set(bodyText.match(/\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*\w+)?/g) ?? [])];
    const phones = [...new Set(
      bodyText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) ?? []
    )];
    const emails = [...new Set(
      bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []
    )];
    const addresses = [...new Set(
      bodyText.match(/\d+[^,\n]{5,50},\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,?\s*[A-Z]{2}\s*\d{5}/g) ?? []
    )];

    return { url: window.location.href, title, metaDescription, bodyMarkdown, assetUrls: uniqueAssetUrls, prices, phones, emails, addresses };
  }, domToMarkdown.toString());
}

// ── 资源下载 ─────────────────────────────────────────────────

const MAX_ASSET_SIZE = 100 * 1024 * 1024; // 100MB，超过则跳过并提示
const downloadedAssets = new Map<string, string>(); // url → local relative path (e.g. "assets/index/hero.jpg")
const skippedAssets: { url: string; page: string; reason: string }[] = [];

function assetFilename(url: string, pageSlug: string): string {
  const u = new URL(url);
  let name = u.pathname.split("/").filter(Boolean).pop() ?? "asset";
  if (!/\.\w{2,5}$/.test(name)) name += ".bin";
  name = name.replace(/[?#&=]/g, "_");

  // 在当前页面子目录下检查重名
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

    // 跳过外部视频平台
    if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|wistia\.com/.test(url)) {
      skippedAssets.push({ url, page: pageSlug, reason: "外部视频平台，记录 URL 即可" });
      continue;
    }

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

      // 按需创建页面子目录
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
  if (result.metaDescription) {
    lines.push(`> Meta Description: ${result.metaDescription}`);
  }
  lines.push("");

  // 关键数据摘要
  if (result.prices.length || result.phones.length || result.emails.length || result.addresses.length) {
    lines.push("## 提取的关键数据");
    lines.push("");
    if (result.prices.length) lines.push(`**价格:** ${result.prices.join(", ")}`);
    if (result.phones.length) lines.push(`**电话:** ${result.phones.join(", ")}`);
    if (result.emails.length) lines.push(`**邮箱:** ${result.emails.join(", ")}`);
    if (result.addresses.length) lines.push(`**地址:** ${result.addresses.join("; ")}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  // 完整页面主体内容
  // 清理多余空行（3+ 连续空行 → 2 空行）
  const cleaned = result.bodyMarkdown.replace(/\n{3,}/g, "\n\n");
  lines.push(cleaned);

  return lines.join("\n");
}

function formatSharedComponent(name: string, content: string, sourceUrl: string): string {
  const lines = [
    `# ${name}`,
    "",
    `> 提取自: ${sourceUrl}`,
    `> 此为全站共用组件，所有页面共享`,
    "",
    "---",
    "",
    content.replace(/\n{3,}/g, "\n\n"),
    "",
  ];
  return lines.join("\n");
}

// ── 主流程 ───────────────────────────────────────────────────

async function main() {
  const urls = await collectUrls();
  console.log(`准备爬取 ${urls.length} 个页面...\n`);

  await mkdir(OUTPUT_DIR, { recursive: true });
  const assetsDir = join(OUTPUT_DIR, "assets");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const indexEntries: { slug: string; title: string; url: string }[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const slug = urlToSlug(url);
    console.log(`[${i + 1}/${urls.length}] ${url} → ${slug}.md`);

    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: TIMEOUT });
      await page.waitForTimeout(500);

      // 第一个页面：额外提取 header 和 footer
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

      // 提取页面主体内容
      const result = await extractPageContent(page);
      result.url = url;

      // 下载资源（图片、PDF、视频、音频等）→ assets/{slug}/ 子目录
      if (result.assetUrls.length > 0) {
        await downloadAssets(result.assetUrls, assetsDir, slug);
      }

      // 替换 markdown 中的远程 URL 为本地路径
      const markdown = replaceImageUrls(formatPageMarkdown(result));
      await writeFile(join(OUTPUT_DIR, `${slug}.md`), markdown, "utf-8");

      indexEntries.push({ slug, title: result.title, url });

      const contentLines = result.bodyMarkdown.split("\n").filter((l) => l.trim()).length;
      const assetCount = result.assetUrls.length;
      console.log(
        `  ✓ ${contentLines} 行内容, ${result.prices.length} 个价格, ${assetCount} 个资源`
      );

      await page.close();

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
    `爬取时间: ${new Date().toISOString()}`,
    `共 ${indexEntries.length} 个页面`,
    "",
    "## 共用组件",
    "",
    "- [_header.md](_header.md) — Header / 导航栏",
    "- [_footer.md](_footer.md) — Footer",
    "",
    "## 页面内容",
    "",
    "| 页面 | URL | 文件 |",
    "|------|-----|------|",
    ...indexEntries.map(
      (e) => `| ${e.title} | ${e.url} | [${e.slug}.md](${e.slug}.md) |`
    ),
    "",
    `## 已下载资源 (${downloadedAssets.size} 个)`,
    "",
    "保存在 `assets/` 目录下。",
    "",
  ];

  // 跳过的资源报告
  if (skippedAssets.length > 0) {
    indexLines.push(`## 未下载的资源 (${skippedAssets.length} 个)`);
    indexLines.push("");
    indexLines.push("以下资源因体积过大或为外部平台而未下载，需人工处理：");
    indexLines.push("");
    indexLines.push("| URL | 所属页面 | 原因 |");
    indexLines.push("|-----|---------|------|");
    for (const { url, page, reason } of skippedAssets) {
      indexLines.push(`| ${url} | ${page} | ${reason} |`);
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
