# URL 路由审计报告

> 生成日期：2026-03-15
> 旧站地址：https://www.xs-code.com/
> 旧站技术：Vue SPA，hash-based routing（`#/`），无 URL 前缀的多语言切换
> 路由发现方式：导航遍历 + Footer 链接 + Vue Router `getRoutes()` 提取

## 旧站路由结构

### 一级页面（8 个）

| 路由 | 页面名称 | 导航入口 | 备注 |
|------|---------|---------|------|
| `#/` | 首页 | Logo | |
| `#/goods` | 工业读码器（产品列表） | 顶部导航 | |
| `#/technical` | 技术能力 | 顶部导航 | |
| `#/CustomerCase` | 客户案例 | 顶部导航 | 案例内容嵌在列表页轮播中，无独立详情页 |
| `#/aboutUs` | 公司信息 | 顶部导航 | |
| `#/news` | 新闻资讯 | 顶部导航 / 首页"查看更多" | |
| `#/expo` | 展会动态 | 公司信息下拉→展会动态 | |
| `#/contactUs` | 联系我们 | 顶部导航"客户报备" | 含办公地址（宁波/南京/杭州/苏州/深圳/重庆） |

> 注：旧站 `#/contact` 路由仅显示 footer CTA，实际联系页面为 `#/contactUs`。

### 产品分类页（3 个）

| 路由 | 系列名称 | 包含产品 |
|------|---------|---------|
| `#/goods?type=R` | 紧凑型 R 系列 | R275-A, R270-A, R172-E/S, R90 |
| `#/goods?type=RS` | 稳定型 RS 系列 | RS100, RS200, RS60, RS300（无详情页） |
| `#/goods?type=H` | 手持式 H 系列 | H100, H920, H620 |

### 产品详情页（11 个）

| 路由 | 产品型号 | 系列 | 来源 |
|------|---------|------|------|
| `#/goods/R275-A` | R275-A | 紧凑型 R 系列 | 列表+Footer |
| `#/goods/R270-A` | R270-A | 紧凑型 R 系列 | 列表（Footer 已移除） |
| `#/goods/R172-E` | R172-E | 紧凑型 R 系列 | 列表+Footer |
| `#/goods/R172-S` | R172-S | 紧凑型 R 系列 | 列表+Footer |
| `#/goods/R90` | R90 | 紧凑型 R 系列 | Vue Router（新产品，子页面未填充） |
| `#/goods/RS100` | RS100 | 稳定型 RS 系列 | 列表+Footer |
| `#/goods/RS200` | RS200 | 稳定型 RS 系列 | Footer（列表未显示） |
| `#/goods/RS60` | RS60 | 稳定型 RS 系列 | 列表+Footer |
| `#/goods/H100` | H100 | 手持式 H 系列 | 旧列表（当前列表/Footer 未显示） |
| `#/goods/H920` | H920 | 手持式 H 系列 | 列表+Footer |
| `#/goods/H620` | H620 | 手持式 H 系列 | Footer（列表未显示） |

> 注：
> - RS300 在 RS 系列列表中出现但无产品详情页内容（疑似即将上线），不计入。
> - R17 路由映射到 R172 产品（通用款R172读码器），其详情页与 R172-E/S 共享，不单独计入详情页。
> - R90 为新产品，详情页有内容，但 product-params/download/qa 子页面暂无实质内容。

### 产品子页面

#### 产品参数页（10 个）

路由模式：`#/goods/{model}/product-params`

适用型号：R275A, R270A, R172E, R172S, RS100, RS200, RS60, H100, H920, H620

> 注：R90 和 R17 的 product-params 页面无实质内容，暂不收录。

#### 产品下载页（11 个）

路由模式：`#/goods/{model}/download`

适用型号：R275A, R270A, R172E, R172S, R17, RS100, RS200, RS60, H100, H920, H620

> 注：R17/download 有下载按钮（产品操作手册、产品手册、视频、调试软件）。R90/download 无内容。

#### 产品 QA 页（11 个）

路由模式：`#/goods/{model}/qa`

适用型号：R275A, R270A, R172E, R172S, R17, RS100, RS200, RS60, H100, H920, H620

> 注：所有 QA 页面均有 FAQ 内容。R90/qa 无内容，暂不收录。

#### 产品相似比较页（12 个）

路由模式：`#/goods/{model}/similar`

适用型号：R275A, R270A, R172E, R172S, R17, R90, RS100, RS200, RS60, H100, H920, H620

> 注：所有 similar 页面均有"相似产品比较"内容（含对比图片）。

### 法律政策页（2 个）

| 路由 | 页面名称 | 内容量 |
|------|---------|--------|
| `#/privacy-policy` | 隐私政策 | 1300 字完整政策文本 |
| `#/cookies-policy` | Cookies 政策 | 1251 字完整政策文本 |

> 注：旧站 `#/privacy` 和 `#/cookies` 路由仅显示 footer，实际政策页面为 `#/privacy-policy` 和 `#/cookies-policy`。

### 新闻详情页（动态路由，4 篇有效文章）

路由模式：`#/detail/{id}`

| 路由 | 标题 | 日期 |
|------|------|------|
| `#/detail/1` | VSDC Innovators Awards 2024 创新奖揭晓！新算技术获行业权威认可 | 2024-06-19 |
| `#/detail/3` | 专注先进工业传感器，「宁波新算」完成Pre-A轮融资 | 2023-07-10 |
| `#/detail/6` | 「新算科技」获数千万元天使轮融资，由红杉中国种子基金独家投资 | 2022-07-22 |
| `#/detail/7` | 新算技术首度亮相 VCSH 2024，读码器全产品助力工业自动化 | 展会动态 |

### Vue Router 中注册但无实质内容的路由

| 路由 | 说明 |
|------|------|
| `#/contact` | 仅 footer CTA，实际联系页为 `#/contactUs` |
| `#/privacy` | 仅 footer，实际为 `#/privacy-policy` |
| `#/cookies` | 仅 footer，实际为 `#/cookies-policy` |
| `#/report` | 显示首页内容，无独立页面 |
| `#/sys` | 后台登录页（数据管理系统），不需要迁移 |
| `#/CustomerCase/:case` | 动态路由已注册，但所有 ID 均无内容 |
| `#/CustomerSubCase/:case` | 动态路由已注册，但所有 ID 均无内容 |
| `#/goods/R90/product-params` | 新产品，子页面未填充 |
| `#/goods/R90/download` | 新产品，子页面未填充 |
| `#/goods/R90/qa` | 新产品，子页面未填充 |
| `#/goods/RS300` | 列表中出现但无详情页内容 |

## 路由总计

| 类别 | 数量 |
|------|------|
| 一级页面 | 8 |
| 产品分类页 | 3 |
| 产品详情页 | 11 |
| 产品参数页 | 10 |
| 产品下载页 | 11 |
| 产品 QA 页 | 11 |
| 产品相似比较页 | 12 |
| 法律政策页 | 2 |
| 新闻详情页 | 4 |
| **总计** | **72** |

## 多语言

- 旧站支持：中文 / English（下拉切换，URL 不变）
- 新站计划：中文 / English / 日文（URL 前缀路由：`/zh`、`/en`、`/ja`）

## 新站 URL 映射方案

| 旧站路由 | 新站路由（中文示例） |
|----------|-------------------|
| `#/` | `/zh` |
| `#/goods` | `/zh/products` |
| `#/goods?type=R` | `/zh/products?series=r` |
| `#/goods?type=RS` | `/zh/products?series=rs` |
| `#/goods?type=H` | `/zh/products?series=h` |
| `#/goods/{model}` (详情) | `/zh/products/{model}` |
| `#/goods/{model}/product-params` | `/zh/products/{model}/specs` |
| `#/goods/{model}/download` | `/zh/products/{model}/downloads` |
| `#/goods/{model}/qa` | `/zh/products/{model}/faq` |
| `#/goods/{model}/similar` | `/zh/products/{model}/compare` |
| `#/technical` | `/zh/technology` |
| `#/CustomerCase` | `/zh/cases` |
| `#/aboutUs` | `/zh/about` |
| `#/news` | `/zh/news` |
| `#/expo` | `/zh/news?tab=expo` |
| `#/detail/{id}` | `/zh/news/{slug}` |
| `#/contactUs` | `/zh/contact` |
| `#/privacy-policy` | `/zh/privacy` |
| `#/cookies-policy` | `/zh/cookies` |

## 验证结果

- [x] 导航栏所有链接已覆盖（工业读码器、技术能力、客户案例、公司信息、客户报备）
- [x] 导航栏下拉子菜单已覆盖（紧凑型R系列、稳定型RS系列、手持式H系列）
- [x] 公司信息子导航已覆盖（关于新算、新闻资讯、展会动态、联系我们）
- [x] Footer 所有链接已覆盖（隐私政策、Cookies政策）
- [x] Footer 产品链接已覆盖（R275-A, R172-E/S, RS100, RS200, RS60, H920, H620）
- [x] 产品详情页及所有子页面已覆盖（详情/参数/下载/QA/相似比较）
- [x] 新闻列表页已覆盖（含"查看更多"按钮展开验证，共 3 篇）
- [x] 展会动态页已覆盖（含"查看更多"按钮展开验证，共 1 篇）
- [x] 新闻详情页已覆盖（4 篇有效文章，通过遍历 ID 1-30 去重确认）
- [x] Vue Router 路由表已完整提取并逐一验证
- [x] 修正错误路由：contact→contactUs, privacy→privacy-policy, cookies→cookies-policy
- [x] 新产品 R90 已收录（详情页+similar 有内容，其余子页面待填充）
- [x] R17 路由已收录（映射到 R172，download/qa/similar 有内容）
- [ ] sitemap.xml 不存在（SPA 无 sitemap）
- [x] RS300 已确认无产品详情页内容，暂不收录
- [x] CustomerCase/CustomerSubCase 动态详情路由已确认无内容
- [x] 总计 72 个有效路由，确认无遗漏
