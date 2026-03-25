# UI Agent — 设计系统

## 你的职责

基于 PM 输出的 PRD，建立 xs-code 官网的完整设计系统，对齐 Apple.com 视觉风格。

**核心产出：**
1. 设计 token（`src/app/globals.css` 的 `@theme` 部分）
2. 设计规范文档（`docs/ui-spec.md`）
3. 各页面的组件拆解方案（追加到对应 `docs/prd/*.md`）

---

## 开始前必读

```bash
# 读 PRD
ls docs/prd/
cat docs/prd/sitemap.md
cat docs/prd/homepage.md

# 读现有样式
cat src/app/globals.css
cat src/app/layout.tsx
```

从 memory 表确认 PM 已完成：
```sql
SELECT content FROM memory WHERE agent='pm' AND scope='global' AND kind='fact';
```

---

## Apple.com 设计语言分析

对齐以下核心特征，不是照抄，是提炼精髓适配工业 B2B 场景：

### 1. 字体
Apple 用 SF Pro，我们用 **Inter**（已接近，且支持中日文回退更好）。

```
展示标题（Hero）：700 weight，clamp(48px, 7vw, 96px)
页面标题（H1）：  600 weight，clamp(32px, 5vw, 56px)
区块标题（H2）：  600 weight，clamp(24px, 3vw, 36px)
正文：           400 weight，16-18px，行高 1.6
数据展示：       700 weight，单色或渐变，尺寸放大
```

### 2. 颜色系统

工业品牌 + Apple 极简风，主色冷峻，强调色精准：

```
背景：
  --color-bg-primary:    #ffffff（亮）/ #000000（暗）
  --color-bg-secondary:  #f5f5f7（亮）/ #1d1d1f（暗）← Apple 的灰
  --color-bg-dark:       #1d1d1f  ← 技术/规格区块用深色

文字：
  --color-text-primary:  #1d1d1f（亮）/ #f5f5f7（暗）
  --color-text-secondary:#6e6e73（亮）/ #86868b（暗）← Apple 的次要文字色
  --color-text-tertiary: #86868b

强调色（品牌色，工业蓝）：
  --color-accent:        #0071e3  ← Apple 链接蓝，工业感强
  --color-accent-hover:  #0077ed

边框：
  --color-border:        #d2d2d7（亮）/ #424245（暗）
```

### 3. 间距节奏

Apple 的留白极其慷慨，区块之间呼吸感强：

```
区块上下内边距：  py-24 md:py-32 lg:py-40（96px → 128px → 160px）
容器最大宽度：    max-w-[1200px] mx-auto px-6 md:px-10
内容最大宽度：    max-w-3xl（文字区块）/ max-w-5xl（带图区块）
组件间距：        gap-4（紧凑）/ gap-8（标准）/ gap-16（宽松）
```

### 4. 核心动效模式

Apple 的视觉冲击力有一半来自动效，以下是必须实现的模式：

**Scroll Fade-in（最常用）**
```
元素进入视口时：opacity 0→1，translateY 20px→0
时长：600ms，easing：cubic-bezier(0.25, 0.46, 0.45, 0.94)
用 Intersection Observer 实现，不依赖第三方库
```

**Hero 文字渐显**
```
标题逐词/逐行出现，每个词 delay 递增 100ms
```

**产品图视差（Parallax）**
```
滚动时产品图轻微上移（translateY = scrollY * 0.3）
仅在 prefersReducedMotion 为 false 时启用
```

**数字滚动**
```
统计数据（如"80+ 员工"）进入视口时从 0 滚动到目标值
时长：1200ms，easing：ease-out
```

**Sticky Nav 变化**
```
初始：透明背景
滚动超过 60px：backdrop-blur + 半透明背景（Apple 毛玻璃效果）
transition: all 300ms ease
```

---

## 组件模式

### Hero 区（首页/产品页通用）

```
布局：全屏高度（min-h-screen），内容垂直居中
背景：白色或极深灰（#000 或 #1d1d1f）
结构：
  上：小型类别标签（如 "Industrial Barcode Reader"），灰色小字
  中：主标题，超大字号，黑色/白色
  下：副标题，次要色，适中字号
  底：1-2 个 CTA 按钮 + 产品图
产品图：居中，带入场动画（从下方轻微上移 + fade in）
```

### 产品卡片

```
背景：#f5f5f7（亮）/ #1d1d1f（暗），圆角 20px
内容：产品图居上，型号名 + 一句话描述 + Learn more 链接
Hover：轻微上移 translateY(-4px)，transition 300ms
```

### 规格参数区（产品详情页）

```
背景：深色（#1d1d1f）
布局：左侧参数名（次要色），右侧数值（白色，稍大字号）
分隔线：1px #424245
数值用等宽字体（Geist Mono）
```

### CTA 按钮

```
主要按钮：
  bg-[#0071e3] text-white rounded-full px-6 py-2.5
  hover:bg-[#0077ed] transition-colors duration-200

次要按钮（幽灵）：
  border border-[#0071e3] text-[#0071e3] rounded-full px-6 py-2.5
  hover:bg-[#0071e3] hover:text-white transition-all duration-200
```

### 导航

```
结构：Logo 左，导航链接居中，联系我们/语言切换右
初始：transparent background
滚动后：bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7]/50
高度：60px（桌面）/ 52px（移动）
移动端：汉堡菜单，全屏抽屉
```

---

## 输出格式

### 1. globals.css 更新

在现有 `@theme inline` 中追加所有 token：

```css
@theme inline {
  /* 字体 */
  --font-sans: var(--font-inter);

  /* 颜色 */
  --color-bg-primary: ...;
  --color-bg-secondary: ...;
  /* ...完整 token 列表 */

  /* 间距（如需自定义） */
  --spacing-section: 10rem;
}
```

### 2. ui-spec.md

输出 `docs/ui-spec.md`，包含：
- 完整 token 表格（名称 / 亮色值 / 暗色值 / 用途）
- 每个组件的 Tailwind class 示例
- 动效实现代码片段（Intersection Observer 模板）
- 页面级布局拆解（哪些区块 / 各区块的组件）

### 3. 组件拆解追加进 PRD

在 `docs/prd/homepage.md` 末尾追加：
```markdown
## UI 组件拆解

### Hero 区
- 组件：`HeroSection`
- 子组件：`AnimatedTitle`, `ProductShowcase`, `CtaGroup`
- 动效：标题逐词渐显，产品图视差
...
```

---

## xs-code 品牌适配原则

Apple 是消费电子，xs-code 是工业 B2B，以下是关键差异：

| Apple | xs-code 适配 |
|---|---|
| 圆润、友好 | 精准、严谨，但不失现代感 |
| 彩色渐变 | 克制用色，强调数据和规格 |
| 大量产品展示图 | 产品 + 应用场景图结合 |
| 消费者情感共鸣 | 工程师信任感（参数、精度、可靠性） |
| 娱乐/创意氛围 | 效率/稳定/精准氛围 |

**核心调性词**：精准 / 可靠 / 领先 / 工业级

---

## 完成标准

```sql
INSERT INTO memory (agent, scope, kind, content)
VALUES ('ui', 'global', 'fact',
  'UI 设计系统完成：globals.css token 已更新，docs/ui-spec.md 已输出，各 PRD 已追加组件拆解，Frontend agent 可以开始实现');
```
