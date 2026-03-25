# 旧站内容 → 新站组件映射表

> 本文档将旧站（xs-code.com）每个页面的章节结构映射到新站（Next.js 16）的页面路由和组件设计。
> 生成日期: 2026-03-15

---

## 目录

1. [全局布局](#1-全局布局)
2. [首页](#2-首页)
3. [产品列表页](#3-产品列表页)
4. [产品详情页](#4-产品详情页)
5. [产品参数页](#5-产品参数页)
6. [产品下载页](#6-产品下载页)
7. [产品 Q&A 页](#7-产品-qa-页)
8. [产品相似比较页](#8-产品相似比较页)
9. [技术页](#9-技术页)
10. [客户案例页](#10-客户案例页)
11. [关于我们](#11-关于我们)
12. [新闻列表页](#12-新闻列表页)
13. [新闻详情页](#13-新闻详情页)
14. [展会页](#14-展会页)
15. [联系我们](#15-联系我们)
16. [隐私政策 / Cookies 政策](#16-法律政策页)

---

## 1. 全局布局

### 旧站结构

| 区域 | 内容 | 来源文件 |
|------|------|----------|
| **Header/Nav** | Logo + 一级导航（Industrial Barcode Reader / Technology / Customer Case / Company Information）+ 产品下拉菜单（3 系列 10 型号）+ 语言切换 + 客户反馈入口 | `_header.md` |
| **Footer** | 品牌 slogan + 产品快速链接（3 系列）+ 社交媒体图标（5 个）+ 隐私/Cookie 政策链接 + ICP 备案号 | `_footer.md` |
| **CTA Bar** | 每页底部：联系提示语 + "Prototype trial / Demo" 按钮 + 热线电话 | 所有页面共有 |

### 新站组件设计

```
src/components/public/
├── Header.tsx              # 响应式导航栏，含产品 Mega Menu
├── Footer.tsx              # 品牌 footer + 产品链接 + 社交图标
├── CtaBanner.tsx           # 全局 CTA 横幅（联系/试用）
└── LanguageSwitcher.tsx    # 中/英/日 语言切换器

src/app/(public)/[locale]/
└── layout.tsx              # 套入 Header + Footer + CtaBanner
```

### 新站路由

```
/(public)/[locale]/         → 所有前台页面的布局
```

---

## 2. 首页

### 旧站章节（`index.md`）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **Hero 轮播** | 产品轮播（RS60 等），全屏背景 | 产品图片 |
| 2 | **稳定 RS 系列 Hero** | RS 系列标题 + 标语（OneClick × Cable Out Design × Ultra Cost-Effective）+ CTA 按钮（Learn more / Try & Contact） | 系列宣传 |
| 3 | **技术优势（5 项）** | 5 个图标卡片：自研算法 / 软件性能 / 硬件设计 / 原创生产 / 本地化服务 + Learn more 按钮 | `/home/se2-icon1~5.png` |
| 4 | **产品展示轮播** | 多系列产品图片横向轮播（7 张），底部显示 RS100 + Learn more | `/home/carousel1~7.png/webp` |
| 5 | **新闻动态（3 条）** | 新闻卡片列表：标题 + 摘要 + 日期 + 查看详情 + Learn more → `/news` | 新闻数据 |
| 6 | **CTA 底栏** | 全局 CTA | — |

### 新站组件

```
src/app/(public)/[locale]/page.tsx          # 首页 Server Component
src/components/public/home/
├── HeroCarousel.tsx                         # Hero 产品轮播
├── SeriesHero.tsx                           # 系列焦点 Hero（RS/R/H 可切换）
├── TechAdvantages.tsx                       # 5 项技术优势图标网格
├── ProductShowcase.tsx                      # 产品横向轮播展示
└── NewsPreview.tsx                          # 新闻预览卡片列表（3 条）
```

### 新站路由

```
/[locale]                   → 首页
```

---

## 3. 产品列表页

### 旧站章节（`goods.md`，通过 `?type=R|RS|H` 切换系列）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **系列 Tab 切换** | R-Series / RS-Series / H-Series 标签按钮 | — |
| 2 | **产品卡片轮播** | 每个系列下的产品型号图片 + 型号名 + Learn more 按钮 | `/goods/g-*.png` |
| 3 | **系列特性列表** | 当前系列的核心技术特性（4 项），标题 + 描述 | 文字数据 |

### 新站组件

```
src/app/(public)/[locale]/products/page.tsx          # 产品列表页
src/components/public/products/
├── SeriesFilter.tsx                                  # 系列筛选 Tab
├── ProductCard.tsx                                   # 单个产品卡片
├── ProductGrid.tsx                                   # 产品卡片网格/轮播
└── SeriesFeatures.tsx                                # 系列技术特性列表
```

### 新站路由

```
/[locale]/products              → 产品列表（默认全系列）
/[locale]/products?series=r     → R 系列筛选
/[locale]/products?series=rs    → RS 系列筛选
/[locale]/products?series=h     → H 系列筛选
```

---

## 4. 产品详情页

### 旧站章节（`goods-r275-a.md` 为典型结构）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **Hero 区域** | 型号名 + 系列名 + 核心标语 + CTA 按钮（Try / Video）+ 产品视频 | `video2.mp4` |
| 2 | **特性滑块（6 页）** | 横向滑动展示产品亮点：每页一张图 + 标题 + 描述 | `slider0~5.webp` |
| 3 | **应用 Demo 视频** | 技术演示视频（如超小码读取、L 形破损读取），每段带标题描述 | `r275a-x1.mp4`, `r275a-x2.mp4` |
| 4 | **应用场景画廊** | 应用图片网格（如圆柱面、撞针刻印、激光码等 7 个场景），每张带标签 | `slider*.webp` |
| 5 | **Tab 导航** | Product Parameters / Download / Q&A / Similar Products 子页签 | 子路由链接 |
| 6 | **CTA 底栏** | 全局 CTA | — |

**变体说明**：
- **R 系列**（R275-A, R270-A, R172-E, R172-S, R90）：完整结构，含视频 + 特性滑块 + 应用场景
- **RS 系列**（RS100, RS200, RS60）：增加 X-Tech 光学系统演示视频、3×3×3 灵活配置
- **H 系列**（H920, H620, H100）：增加 On-axis Aiming、Training 功能演示、手持算法引擎

### 新站组件

```
src/app/(public)/[locale]/products/[model]/page.tsx     # 产品详情页
src/components/public/products/detail/
├── ProductHero.tsx                                      # 产品 Hero（型号 + 视频 + CTA）
├── FeatureSlider.tsx                                    # 特性横向滑块
├── DemoVideos.tsx                                       # 技术演示视频区
├── ApplicationGallery.tsx                               # 应用场景画廊
└── ProductSubNav.tsx                                    # 子页签导航（参数/下载/QA/比较）
```

### 新站路由

```
/[locale]/products/[model]                → 产品详情
```

---

## 5. 产品参数页

### 旧站章节（`goods-r275a-product-params.md`）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **参数规格图** | 一张完整的产品参数规格表图片（包含尺寸、接口、性能参数等） | `r275a_product_details-*.png` |

**说明**：所有产品的参数页结构一致，都是单张规格图。新站应改为结构化数据表格。

### 新站组件

```
src/app/(public)/[locale]/products/[model]/specs/page.tsx   # 产品参数页
src/components/public/products/
├── SpecsTable.tsx                                           # 结构化参数表格
└── DimensionDiagram.tsx                                     # 尺寸图（可选）
```

### 新站路由

```
/[locale]/products/[model]/specs         → 产品参数
```

### 数据源

参数数据应从 Supabase `product_specs` 表读取，而非硬编码图片。旧站参数图片保留为 fallback。

---

## 6. 产品下载页

### 旧站章节（`goods-r275a-download.md`）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **产品操作手册** | 折叠面板：用户操作手册 PDF 下载链接 | PDF 文件 |
| 2 | **产品手册** | 折叠面板：全系列/单系列产品手册 PDF 下载链接 | PDF 文件 |
| 3 | **教学视频-功能类** | 折叠面板：多个教学视频（不同码制读取、多来料读取、通信设置等）下载链接 | 视频文件 |
| 4 | **教学视频-样本类** | 折叠面板：多个样本视频（高反光、激光码、极小码、镭雕码等）下载链接 | 视频文件 |
| 5 | **调试软件** | 折叠面板：XS_Reader_Tools 软件下载 | EXE/安装包 |

**说明**：
- 每个产品的下载项数量不同（R275A 最多约 20 项，R17 约 4 项，有些产品下载页为空）
- 下载链接通过 Vue `@click` 触发，实际 URL 从 file server 获取
- 文件服务器资源清单见 `file-server-inventory.md`（566 个文件，1.3 GB）

### 新站组件

```
src/app/(public)/[locale]/products/[model]/downloads/page.tsx   # 下载页
src/components/public/products/
├── DownloadSection.tsx                                          # 折叠式下载分类区
├── DownloadItem.tsx                                             # 单个下载项（图标 + 标题 + 下载按钮）
└── SoftwareDownload.tsx                                         # 调试软件下载卡片
```

### 新站路由

```
/[locale]/products/[model]/downloads     → 产品下载
```

### 数据源

下载数据应从 Supabase `product_downloads` 表读取，文件托管在 CDN/对象存储。

---

## 7. 产品 Q&A 页

### 旧站章节（`goods-r275a-qa.md`）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **FAQ 手风琴** | 5 个问题，每个问题为折叠面板：问题标题（如"在复杂的环境中有什么高效的使用方法"）+ 展开后显示答案文本 | 文字数据 |

**说明**：旧站所有产品的 Q&A 内容为占位文本（"问题答案文本……填充文本"），非真实 FAQ。问题标题也是重复的。新站需要填充真实内容。

### 新站组件

```
src/app/(public)/[locale]/products/[model]/faq/page.tsx    # FAQ 页
src/components/public/products/
└── FaqAccordion.tsx                                        # FAQ 手风琴组件
```

### 新站路由

```
/[locale]/products/[model]/faq           → 产品 FAQ
```

### 数据源

FAQ 数据从 Supabase `product_faqs` 表读取，需要 PM 提供真实 Q&A 内容。

---

## 8. 产品相似比较页

### 旧站章节（`goods-r275a-similar.md`）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **比较图** | 产品比较图片（对比表格截图） | `rs275_product_similar-*.png` |
| 2 | **CTA** | 联系提示 + Demo 按钮 + 热线 | — |

**说明**：所有产品的 similar 页结构一致，一张比较图 + CTA。新站应改为动态对比表。

### 新站组件

```
src/app/(public)/[locale]/products/[model]/compare/page.tsx   # 产品对比页
src/components/public/products/
└── ProductCompare.tsx                                         # 动态产品对比表
```

### 新站路由

```
/[locale]/products/[model]/compare       → 产品对比
```

---

## 9. 技术页

### 旧站章节（`technical.md`）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **页面标题** | "Full-stack software and hardware self-development, powerful performance" | — |
| 2 | **算法引擎 (Algorithm Engine)** | Machine Vision Algorithm Engine™ 介绍 | — |
| 3 | **超分辨率算法 (Ultra-Resolution)** | 1MP = 3MP 成像效果，支持 1mil 1D / 1.5mil 2D | — |
| 4 | **SPL 技术 (Sub-Pixel Positioning)** | 0.02 Pixel 精度，30% 破损 L 形可读 | — |
| 5 | **对比度增强算法** | 2% 对比度条码稳定读取 | — |
| 6 | **OneClick** | 6 个子功能卡片：自动光源调节 / 自动参数 / 自动算法 / 自动对焦 / 自动码制检测 / 组合光源调优 | `/technical/icons/card-icon0~5.png` |
| 7 | **OneClick 演示** | 操作演示图片轮播（机身按钮 / 软件按钮）+ 性能对比图 | `oneClick1/2.png`, `speed1/2.png` |
| 8 | **X-Tech 光学系统** | 镜头规格 × 光源颜色 × 光源类型（3×3×3 配置）+ 配置选择器 + 组合光源调优说明 | `base.png`, `6mm.png` 等 |
| 9 | **On-axis Aiming** | 手持读码器指哪读哪技术介绍 | — |

### 新站组件

```
src/app/(public)/[locale]/technology/page.tsx        # 技术页
src/components/public/technology/
├── TechHero.tsx                                      # 页面标题 Hero
├── AlgorithmEngine.tsx                               # 算法引擎介绍
├── UltraResolution.tsx                               # 超分辨率算法
├── SplTech.tsx                                       # SPL 定位技术
├── ContrastEnhancement.tsx                           # 对比度增强
├── OneClickFeatures.tsx                              # OneClick 6 项功能卡片
├── OneClickDemo.tsx                                  # OneClick 操作/性能演示
├── XTechSystem.tsx                                   # X-Tech 光学系统配置器
└── OnAxisAiming.tsx                                  # On-axis Aiming 展示
```

### 新站路由

```
/[locale]/technology                → 技术介绍
```

---

## 10. 客户案例页

### 旧站章节（`customercase.md`）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **页面标题** | "Helping enterprises realize digital intelligence upgrading engine unquenchable" | — |
| 2 | **行业 Tab（6 个）** | Automotive / Lithium New Energy / 3C Electronics / Semiconductor / Logistics / Photovoltaic | — |
| 3 | **案例卡片轮播** | 每个行业下多张案例图片 + 标签文字，横向轮播 | `customercase/*.webp/png` |

**说明**：
- 没有独立的案例详情页（旧站 `#/CustomerCase/:id` 和 `#/CustomerSubCase/:id` 均为空）
- 所有案例内容嵌入在列表页轮播中
- 每个行业约 3-8 张案例图片

### 新站组件

```
src/app/(public)/[locale]/cases/page.tsx             # 客户案例页
src/components/public/cases/
├── IndustryTabs.tsx                                  # 行业筛选标签
├── CaseCard.tsx                                      # 案例卡片（图 + 标签）
└── CaseCarousel.tsx                                  # 案例轮播（按行业）
```

### 新站路由

```
/[locale]/cases                     → 客户案例
/[locale]/cases?industry=automotive → 按行业筛选
```

---

## 11. 关于我们

### 旧站章节（`aboutus.md`）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **公司介绍** | XinSuan Tech 简介文字（机器视觉、自研算法、多系列产品） | — |
| 2 | **数据概览（4 项）** | 80+ 员工 / 3000 万+ 研发投入 / 1 亿+ 融资 / 50+ 合作伙伴 | `/aboutUs/icon-svg0~3.svg` |
| 3 | **品牌 Slogan** | "Specializing in industrial machine vision..." | — |
| 4 | **企业历程时间线** | 2019-2024 年：深圳成立 → 首款读码器 → 天使轮 → 手持系列 → Pre-A 轮 → RS 系列 | — |
| 5 | **荣誉资质** | 5 张证书/奖项图片 | `/aboutUs/jx0~4.png` |

### 新站组件

```
src/app/(public)/[locale]/about/page.tsx             # 关于我们
src/components/public/about/
├── CompanyIntro.tsx                                  # 公司介绍文字
├── StatsOverview.tsx                                 # 数据概览卡片（4 项）
├── Timeline.tsx                                      # 企业历程时间线
└── Awards.tsx                                        # 荣誉资质画廊
```

### 新站路由

```
/[locale]/about                     → 关于我们
```

---

## 12. 新闻列表页

### 旧站章节（`news.md`）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **页面标题** | "NEWS" | — |
| 2 | **新闻卡片列表** | 3 篇文章，每篇：标题 + 摘要 + 日期 + "查看详情" 链接 | — |
| 3 | **Learn more 按钮** | 加载更多 | — |

### 新站组件

```
src/app/(public)/[locale]/news/page.tsx              # 新闻列表
src/components/public/news/
├── NewsCard.tsx                                      # 新闻卡片
└── NewsList.tsx                                      # 新闻列表（含分页/加载更多）
```

### 新站路由

```
/[locale]/news                      → 新闻列表
```

---

## 13. 新闻详情页

### 旧站章节（`detail-1.md`, `detail-3.md`, `detail-6.md`, `detail-7.md`）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **文章标题** | 新闻标题（如"VSDC Innovators Awards 2024..."） | — |
| 2 | **元信息** | 作者/编辑/来源 + 发布日期 | — |
| 3 | **正文内容** | 富文本：段落文字 + 内嵌图片 | `detail-*/20240924*.jpeg/png` |
| 4 | **相关新闻** | "相关新闻"链接区域 | — |

**现有 4 篇新闻**：
1. `detail-1` — VSDC Innovators Awards 2024 获奖（2024-06-19）
2. `detail-3` — Pre-A 轮融资报道（2023-07-10）
3. `detail-6` — 天使轮融资报道（2022-07-22）
4. `detail-7` — VCSH 2024 展会报道（2024-07-19）

### 新站组件

```
src/app/(public)/[locale]/news/[slug]/page.tsx       # 新闻详情
src/components/public/news/
├── ArticleHeader.tsx                                 # 文章标题 + 元信息
├── ArticleBody.tsx                                   # 富文本正文
└── RelatedNews.tsx                                   # 相关新闻推荐
```

### 新站路由

```
/[locale]/news/[slug]               → 新闻详情
```

### 数据源

新闻内容从 Supabase `news_articles` 表读取，支持富文本（Markdown 或 JSON）。

---

## 14. 展会页

### 旧站章节（`expo.md`）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **页面标题** | "展会动态" | — |
| 2 | **展会卡片** | 1 条展会信息：标题 + 摘要 + 日期 + Learn more 按钮 | — |

**说明**：内容与新闻详情 `detail-7` 关联（VCSH 2024）。新站可合并到新闻模块，用标签区分。

### 新站设计

展会内容合并到新闻系统，通过 `category: exhibition` 标签区分。

```
/[locale]/news?category=exhibition  → 展会动态筛选
```

---

## 15. 联系我们

### 旧站章节（`contactus.md`）

| # | 章节 | 内容描述 | 资源 |
|---|------|----------|------|
| 1 | **页面标题** | "Contact Us" | — |
| 2 | **联系方式** | 商务咨询邮箱（lvml@xs-trinity.com）/ 招聘邮箱（hrfxy@xs-trinity.com）/ 联系电话 / 微信二维码 / 公众号二维码 | `/aboutUs/wx.png`, `/aboutUs/gzh.png` |
| 3 | **联系表单** | 6 字段：Name / Company / Telephone / Email / Position / City + Commit 按钮 | — |
| 4 | **办公地点（6 处）** | 宁波总部 / 南京 / 杭州 / 苏州 / 深圳 / 重庆，各附地址 | — |

### 新站组件

```
src/app/(public)/[locale]/contact/page.tsx           # 联系我们
src/components/public/contact/
├── ContactInfo.tsx                                   # 联系方式（邮箱/电话/二维码）
├── ContactForm.tsx                                   # 联系表单（Client Component）
└── OfficeLocations.tsx                               # 办公地点列表/地图
```

### 新站路由

```
/[locale]/contact                   → 联系我们
```

---

## 16. 法律政策页

### 旧站章节（`privacy-policy.md`, `cookies-policy.md`）

| 页面 | 内容概要 |
|------|----------|
| **隐私政策** | 政策介绍 + 个人信息收集（访问信息/自愿提供/Cookies/在线调查）+ 使用与披露 + 权利 + 信息安全 + 第三方链接 + 政策更新。发布日期 2024-08-19 |
| **Cookies 政策** | Cookies 定义 + 使用目的（功能性/分析/营销）+ 管理方式 + 第三方 Cookies + 政策变更。发布日期 2024-08-19 |

### 新站组件

```
src/app/(public)/[locale]/legal/privacy/page.tsx     # 隐私政策
src/app/(public)/[locale]/legal/cookies/page.tsx     # Cookies 政策
src/components/public/legal/
└── LegalDocument.tsx                                 # 通用法律文档模板
```

### 新站路由

```
/[locale]/legal/privacy             → 隐私政策
/[locale]/legal/cookies             → Cookies 政策
```

---

## 产品型号清单

| 系列 | 型号 | 旧站路由 | 新站路由 | 子页面状态 |
|------|------|----------|----------|------------|
| **Compact R** | R275-A | `#/goods/R275-A` | `/products/r275a` | 参数 ✅ 下载 ✅ QA ✅(占位) 比较 ✅ |
| | R270-A | `#/goods/R270-A` | `/products/r270a` | 参数 ✅ 下载 ✅ QA ✅(占位) 比较 ✅ |
| | R172-E | `#/goods/R172-E` | `/products/r172e` | 参数 ✅ 下载 ✅ QA ✅(占位) 比较 ✅ |
| | R172-S | `#/goods/R172-S` | `/products/r172s` | 参数 ✅ 下载 ✅ QA ✅(占位) 比较 ✅ |
| | R90 | `#/goods/R90` | `/products/r90` | 参数 ❌ 下载 ❌ QA ❌ 比较 ✅ |
| | R17 (→R172) | `#/goods/R17` | `/products/r172e` | 下载 ✅ QA ✅(占位) 比较 ✅ |
| **RS (双航插)** | RS100 | `#/goods/RS100` | `/products/rs100` | 参数 ✅ 下载 ✅ QA ✅(占位) 比较 ✅ |
| | RS200 | `#/goods/RS200` | `/products/rs200` | 参数 ✅ 下载 ✅ QA ✅(占位) 比较 ✅ |
| | RS60 | `#/goods/RS60` | `/products/rs60` | 参数 ✅ 下载 ✅ QA ✅(占位) 比较 ✅ |
| **H (手持)** | H920 | `#/goods/H920` | `/products/h920` | 参数 ✅ 下载 ✅ QA ✅(占位) 比较 ✅ |
| | H620 | `#/goods/H620` | `/products/h620` | 参数 ✅ 下载 ✅ QA ✅(占位) 比较 ✅ |
| | H100 | `#/goods/H100` | `/products/h100` | 参数 ✅ 下载 ✅ QA ✅(占位) 比较 ✅ |

---

## 旧站 URL → 新站 URL 完整映射

| 旧站 URL | 新站 URL | 备注 |
|-----------|----------|------|
| `#/` | `/zh` | 首页 |
| `#/goods?type=R` | `/zh/products?series=r` | R 系列 |
| `#/goods?type=RS` | `/zh/products?series=rs` | RS 系列 |
| `#/goods?type=H` | `/zh/products?series=h` | H 系列 |
| `#/goods/R275-A` | `/zh/products/r275a` | 产品详情 |
| `#/goods/R275A/product-params` | `/zh/products/r275a/specs` | 产品参数 |
| `#/goods/R275A/download` | `/zh/products/r275a/downloads` | 产品下载 |
| `#/goods/R275A/qa` | `/zh/products/r275a/faq` | 产品 FAQ |
| `#/goods/R275A/similar` | `/zh/products/r275a/compare` | 产品对比 |
| `#/technical` | `/zh/technology` | 技术 |
| `#/CustomerCase` | `/zh/cases` | 客户案例 |
| `#/aboutUs` | `/zh/about` | 关于我们 |
| `#/news` | `/zh/news` | 新闻列表 |
| `#/detail/:id` | `/zh/news/:slug` | 新闻详情 |
| `#/expo` | `/zh/news?category=exhibition` | 展会（合并到新闻） |
| `#/contactUs` | `/zh/contact` | 联系我们 |
| `#/privacy-policy` | `/zh/legal/privacy` | 隐私政策 |
| `#/cookies-policy` | `/zh/legal/cookies` | Cookies 政策 |

---

## Supabase 数据表设计预览

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `products` | 产品基本信息 | id, model, series, name_zh/en/ja, tagline, hero_video_url |
| `product_features` | 产品特性（滑块） | product_id, sort, title_zh/en/ja, description, image_url |
| `product_specs` | 产品参数 | product_id, spec_group, spec_name, spec_value |
| `product_downloads` | 产品下载资源 | product_id, category, title, file_url, file_type |
| `product_faqs` | 产品 FAQ | product_id, sort, question_zh/en/ja, answer_zh/en/ja |
| `product_applications` | 应用场景 | product_id, image_url, label_zh/en/ja |
| `news_articles` | 新闻/展会文章 | id, slug, category, title, summary, body, published_at |
| `customer_cases` | 客户案例 | id, industry, title_zh/en/ja, image_url, description |
| `office_locations` | 办公地点 | id, city_zh/en/ja, district, address, sort |
| `company_milestones` | 企业历程 | year, title_zh/en/ja, description_zh/en/ja |

---

## 组件总览

```
src/components/public/
├── Header.tsx                    # 全局导航
├── Footer.tsx                    # 全局底部
├── CtaBanner.tsx                 # 全局 CTA
├── LanguageSwitcher.tsx          # 语言切换
├── home/
│   ├── HeroCarousel.tsx          # 首页 Hero 轮播
│   ├── SeriesHero.tsx            # 系列焦点
│   ├── TechAdvantages.tsx        # 技术优势
│   ├── ProductShowcase.tsx       # 产品展示轮播
│   └── NewsPreview.tsx           # 新闻预览
├── products/
│   ├── SeriesFilter.tsx          # 系列筛选
│   ├── ProductCard.tsx           # 产品卡片
│   ├── ProductGrid.tsx           # 产品网格
│   ├── SeriesFeatures.tsx        # 系列特性
│   ├── detail/
│   │   ├── ProductHero.tsx       # 产品 Hero
│   │   ├── FeatureSlider.tsx     # 特性滑块
│   │   ├── DemoVideos.tsx        # 演示视频
│   │   ├── ApplicationGallery.tsx # 应用场景
│   │   └── ProductSubNav.tsx     # 子页签导航
│   ├── SpecsTable.tsx            # 参数表格
│   ├── DimensionDiagram.tsx      # 尺寸图
│   ├── DownloadSection.tsx       # 下载分类区
│   ├── DownloadItem.tsx          # 下载项
│   ├── SoftwareDownload.tsx      # 软件下载
│   ├── FaqAccordion.tsx          # FAQ 手风琴
│   └── ProductCompare.tsx        # 产品对比
├── technology/
│   ├── TechHero.tsx              # 技术页 Hero
│   ├── AlgorithmEngine.tsx       # 算法引擎
│   ├── UltraResolution.tsx       # 超分辨率
│   ├── SplTech.tsx               # SPL 技术
│   ├── ContrastEnhancement.tsx   # 对比度增强
│   ├── OneClickFeatures.tsx      # OneClick 功能卡片
│   ├── OneClickDemo.tsx          # OneClick 演示
│   ├── XTechSystem.tsx           # X-Tech 光学系统
│   └── OnAxisAiming.tsx          # On-axis Aiming
├── cases/
│   ├── IndustryTabs.tsx          # 行业标签
│   ├── CaseCard.tsx              # 案例卡片
│   └── CaseCarousel.tsx          # 案例轮播
├── about/
│   ├── CompanyIntro.tsx          # 公司介绍
│   ├── StatsOverview.tsx         # 数据概览
│   ├── Timeline.tsx              # 企业历程
│   └── Awards.tsx                # 荣誉资质
├── news/
│   ├── NewsCard.tsx              # 新闻卡片
│   ├── NewsList.tsx              # 新闻列表
│   ├── ArticleHeader.tsx         # 文章标题
│   ├── ArticleBody.tsx           # 文章正文
│   └── RelatedNews.tsx           # 相关新闻
├── contact/
│   ├── ContactInfo.tsx           # 联系方式
│   ├── ContactForm.tsx           # 联系表单
│   └── OfficeLocations.tsx       # 办公地点
└── legal/
    └── LegalDocument.tsx         # 法律文档模板
```

**共计**：约 45 个组件 + 15 个页面路由
