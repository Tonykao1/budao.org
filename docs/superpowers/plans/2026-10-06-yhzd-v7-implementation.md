# 萤火之地 V7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `yhzd.html` 从绝对定位的随机内容场重构为稳定、可读、顶级图文网站式的 editorial narrative 页面，同时保留独立随机图片/文字池、近期历史与真实历史照片。

**Architecture:** 页面改为纵向 `section` 流：静态 Hero + 5 个稳定 editorial scene，随机机制只负责向固定 scene 填充内容，不再生成坐标。把页面样式和随机引擎从现有单文件拆为 `yhzd-editorial.css` 与 `yhzd-editorial.js`；JS 使用可在 Node 与浏览器共同加载的 UMD 工厂，以便对随机/历史算法做单元测试。共享 `style.css`、导航、图片 manifest 与 localStorage 历史接口继续复用。

**Tech Stack:** HTML5、CSS3、原生 JavaScript、Node.js `node:test`、Vercel 静态预览。

**Spec:** `docs/superpowers/specs/2026-10-06-yhzd-v7-design.md`

## Global Constraints

- 页面正式名称统一为「萤火之地」，不得再出现「营火之地」。
- 副句固定为「有些话，\n只有走过的人才会说出来。」
- 核心原则：`一屏一见，一次一物。`
- 随机的是内容，不是构图；图片与文字独立随机，永远不做语义配对。
- 首屏标题区不允许参与者语句、图片、浮动残片或遮挡。
- 任意 scene 不允许图压图、字压图、图压字；主图必须完整显示。
- 正式预览必须使用真实 480/960 WebP；不得再放大 120px 预览资产。
- 桌面端以 1440–1728px 为重点；手机端必须显示真实照片，不得隐藏图片。
- Z 轴只允许 1–2° 极轻透视、极弱暖黑投影和弱视差，不得依赖遮挡制造空间。
- 首版不做分享按钮、轮播箭头、自动轮播、复杂 3D、强横向漫游、点赞评论收藏。
- 在明确验收前不得修改 `main`；所有实现继续在 `feat/yhzd-editorial-v7` 完成。

## Review Focus

- **超长引语：** 长句不得溢出、遮图或撑坏 scene；选择器按 scene 字数上限挑选可完整阅读的文本。
- **图片池不足或方向不匹配：** 仍应返回不重复的可用图片并保持完整比例，不因缺少 portrait/landscape 而空白或重复。
- **localStorage 损坏/禁用：** 历史读取写入失败时页面仍可正常随机渲染，不抛异常。
- **窄桌面/平板/手机：** 980px 以下切为单列，图片仍可见；任何宽度都不得出现横向页面溢出。
- **减少动态效果：** `prefers-reduced-motion` 下关闭非必要淡入/视差，同时内容保持可见和可读。

---

### Task 1: 建立 V7 结构契约与回归测试

**Files:**
- Create: `test/yhzd-editorial.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: 现有 `yhzd.html`、`images/yhzd/manifest.json`。
- Produces: V7 的静态结构契约与 `npm test` 入口；后续任务必须保持这些断言通过。

- [ ] **Step 1: 写失败的结构测试**

在 `test/yhzd-editorial.test.js` 中读取 `yhzd.html`，至少断言：

```js
assert.match(html, /<title>萤火之地 \| 步道<\/title>/);
assert.match(html, /class="yhzd-hero"/);
assert.match(html, /class="editorial-scene editorial-scene--primary"/);
assert.equal((html.match(/class="editorial-scene/g) || []).length, 5);
assert.doesNotMatch(html, /memory-world|image-slot-|message-\d|memory-viewport/);
assert.doesNotMatch(html, /营火之地/);
assert.match(html, /yhzd-editorial\.css/);
assert.match(html, /yhzd-editorial\.js/);
```

再断言 Hero 内只包含 `路上星火`、`萤火之地` 与固定副句，不包含动态内容容器；断言移动端样式不得出现 `.editorial-media{display:none}` 或等价隐藏规则。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/yhzd-editorial.test.js`

Expected: FAIL，至少因为当前页面仍包含「营火之地」与 `memory-world/image-slot-*`。

- [ ] **Step 3: 把新测试加入总测试脚本**

修改 `package.json` 的 `test` 脚本，在现有文件列表末尾加入 `test/yhzd-editorial.test.js`，不改变其他测试顺序。

- [ ] **Step 4: 运行现有站点壳测试确保基线仍绿**

Run: `node --test --test-concurrency=1 test/site-shell.test.js`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add test/yhzd-editorial.test.js package.json
git commit -m "test(yhzd): define V7 editorial structure contract"
```

---

### Task 2: 重构为稳定的 editorial 页面骨架

**Files:**
- Modify: `yhzd.html`
- Create: `yhzd-editorial.css`
- Test: `test/yhzd-editorial.test.js`

**Interfaces:**
- Consumes: Task 1 的结构契约、共享 `style.css` 与现有导航链接。
- Produces: 固定 DOM 骨架：`.yhzd-hero`、5 个 `.editorial-scene`，每个 scene 提供一个 `.editorial-media` 与一个 `.editorial-quote` 槽；`data-scene` 值固定为 `primary|reverse|interlude|standard-a|standard-b`。

- [ ] **Step 1: 扩展失败测试，钉死可读性骨架**

新增断言：

```js
assert.match(html, /<h1>萤火之地<\/h1>/);
assert.match(html, /有些话，<br>只有走过的人才会说出来。/);
assert.equal((html.match(/class="editorial-media"/g) || []).length, 5);
assert.equal((html.match(/class="editorial-quote"/g) || []).length, 5);
assert.match(html, /data-scene="primary"/);
assert.match(html, /data-scene="reverse"/);
```

并读取 `yhzd-editorial.css`，断言存在：

```js
assert.match(css, /\.yhzd-hero\s*\{/);
assert.match(css, /\.editorial-scene\s*\{/);
assert.match(css, /\.editorial-media img\s*\{[^}]*height:\s*auto/s);
assert.match(css, /@media\s*\(max-width:\s*980px\)/);
assert.doesNotMatch(css, /object-fit:\s*cover/);
```

- [ ] **Step 2: 运行测试确认新断言失败**

Run: `node --test test/yhzd-editorial.test.js`

Expected: FAIL，因为 V7 markup/CSS 尚不存在。

- [ ] **Step 3: 重写 `yhzd.html` 为纵向语义结构**

保留标准 `<nav>` 与 `style.css`；新增 `yhzd-editorial.css`。Hero 只包含：

- `<a class="spark-link" href="lsxh.html">✦ 路上星火</a>`
- `<h1>萤火之地</h1>`
- 固定副句

Hero 后创建 5 个固定 scene；所有随机内容节点仅出现在 scene 内，不在 Hero 内。删除现有 `.memory-viewport`、`.memory-world`、`.images-layer`、`.messages-layer`、拖拽横向漫游结构和绝对坐标 slot。

- [ ] **Step 4: 创建 `yhzd-editorial.css`，实现已批准的版式比例**

桌面关键值：

- 页面内容宽度：`width:min(92vw,1440px)`
- Hero 高度：`min-height:clamp(430px,52vh,620px)`，标题区居中且静止
- 主 scene：`grid-template-columns:minmax(0,1.65fr) minmax(280px,.75fr)`
- scene 间距：`clamp(140px,16vh,240px)`
- 主图始终 `width:100%; height:auto;`，禁止 `object-fit:cover`
- 主引语：`font-size:clamp(30px,2.4vw,42px); line-height:1.6`
- 普通引语：`font-size:clamp(22px,1.7vw,30px)`
- 图片圆角：6px；投影只使用极弱暖黑 shadow
- `reverse` scene 反转列顺序；其余 scene 通过最大宽度与留白差形成节奏，不做绝对定位
- 980px 以下全部单列：Hero → 图 → 引语；图片保持可见，宽度约 88–92vw
- `prefers-reduced-motion` 下禁用淡入/视差相关 transition/transform

- [ ] **Step 5: 运行结构测试与站点壳测试**

Run: `node --test --test-concurrency=1 test/yhzd-editorial.test.js test/site-shell.test.js`

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add yhzd.html yhzd-editorial.css test/yhzd-editorial.test.js
git commit -m "feat(yhzd): rebuild page as editorial narrative"
```

---

### Task 3: 建立独立随机内容引擎并保持固定构图

**Files:**
- Create: `yhzd-editorial.js`
- Modify: `yhzd.html`
- Modify: `test/yhzd-editorial.test.js`

**Interfaces:**
- Consumes: `images/yhzd/manifest.json` 与现有文字池；历史 key 继续使用 `budao:yhzd:imageHistory:v2`、`budao:yhzd:messageHistory:v2`。
- Produces: UMD API：
  - `selectFresh(items, count, recentIds, idOf, excludeIds) -> Array`
  - `selectMessages(messages, caps, recentMessages) -> string[]`
  - `selectImages(images, scenePrefs, recentIds) -> object[]`
  - `safeReadHistory(storage, key) -> string[]`
  - `safeRemember(storage, key, id, limit = 24) -> void`
  - `initEditorialPage(document, window) -> Promise<void>`

- [ ] **Step 1: 写失败的随机与历史单元测试**

在 `test/yhzd-editorial.test.js` 中 `require('../yhzd-editorial.js')`，覆盖：

```js
// fresh 优先且本次不重复
assert.deepEqual(selectFresh(items, 3, ['a'], x => x.id).map(x => x.id), ['b','c','d']);

// scene 偏好不足时回退到其他方向，但仍不重复
assert.equal(new Set(selectImages(pool, ['landscape','portrait','landscape'], []).map(x => x.id)).size, 3);

// 文本按容量完整选择，不截断
assert.ok(selectMessages(messages, [14,28,44], []).every((m,i) => m.length <= [14,28,44][i]));

// 损坏 localStorage 数据返回 [] 且不抛错
assert.deepEqual(safeReadHistory(brokenStorage, 'x'), []);
```

同时测试 `safeRemember` 去重、保留最近 24 项。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/yhzd-editorial.test.js`

Expected: FAIL with `Cannot find module '../yhzd-editorial.js'` 或导出函数不存在。

- [ ] **Step 3: 实现 `yhzd-editorial.js` 的纯选择函数**

使用 UMD 包装，使 Node `require()` 返回上述 API，浏览器中挂载 `window.YHZDEditorial`。选择算法必须：

- 先排除本次已占用 id
- 再优先未出现在近期历史中的内容
- 同一次页面装载不重复
- 图片方向偏好仅做排序偏好，不得导致空槽
- 文字只能选择 `length <= cap` 的完整句子；如某 cap 无可用文本，则选择最短可用完整句，不截断字符串

- [ ] **Step 4: 实现 `initEditorialPage(document, window)`**

初始化时：

- fetch `/images/yhzd/manifest.json`
- 固定抽取 5 张图片填入 5 个 `.editorial-media`
- 固定抽取 5 条独立文字填入 5 个 `.editorial-quote`
- 图片与文字分别随机，绝不建立索引或语义配对关系
- scene 偏好固定：`['landscape','landscape','portrait','landscape','landscape']`，偏好不足时安全回退
- 主图 `loading="eager"`、`fetchpriority="high"`，优先 960；其余 `loading="lazy"`
- 所有图使用 `srcset` 的 480/960 版本和 `height:auto`
- 使用 IntersectionObserver：内容进入视野达到 42% 时才调用 `safeRemember`
- IntersectionObserver 不可用时不记录历史，但页面仍正常显示

- [ ] **Step 5: 在 `yhzd.html` 底部加载并启动新引擎**

添加：

```html
<script src="/yhzd-editorial.js"></script>
<script>YHZDEditorial.initEditorialPage(document, window);</script>
```

删除旧的随机坐标、pointer drag、edge renew、旧 scene 更新代码。

- [ ] **Step 6: 运行单元与结构测试**

Run: `node --test --test-concurrency=1 test/yhzd-editorial.test.js test/site-shell.test.js`

Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add yhzd-editorial.js yhzd.html test/yhzd-editorial.test.js
git commit -m "feat(yhzd): randomize content inside fixed editorial scenes"
```

---

### Task 4: 替换低清预览资产为真实 480/960 WebP

**Files:**
- Modify: `images/yhzd/manifest.json`
- Replace: `images/yhzd/firefly-*-480.webp`
- Create: `images/yhzd/firefly-*-960.webp`
- Modify: `test/yhzd-editorial.test.js`

**Interfaces:**
- Consumes: 本地已经生成的 13 组真实 480/960 WebP。
- Produces: manifest `preview:false`；每条图片记录同时包含 `480` 与 `960` derivative，并保持原有 `id/orientation/width/height`。

- [ ] **Step 1: 写失败的资产质量测试**

读取 manifest，断言：

```js
assert.equal(manifest.preview, false);
assert.ok(manifest.images.length >= 13);
for (const image of manifest.images) {
  assert.equal(image['480'].width, 480);
  assert.equal(image['960'].width, 960);
  assert.ok(fs.existsSync(path.join(root, image['480'].src)));
  assert.ok(fs.existsSync(path.join(root, image['960'].src)));
}
```

对 portrait 只要求 width 为 derivative 目标宽度，height 按原比例大于 width；landscape 同样保持比例。另检查所有 WebP 文件首部为 RIFF/WEBP，防止误传文本或空文件。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/yhzd-editorial.test.js`

Expected: FAIL，因为当前 manifest 仍为 `preview:true` 且 derivative 只有 120px 实际预览记录，没有 960 项。

- [ ] **Step 3: 上传真实 480/960 WebP 并更新 manifest**

从现有本地构建目录使用 13 组真实衍生图：

- 480：页面普通/移动加载
- 960：主图与高密度屏幕加载

manifest 设为：

```json
{"version":1,"preview":false,"images":[...]}
```

每项保留原 `id` 与 `orientation`，补齐 `480`/`960` 的 `src/width/height`。

- [ ] **Step 4: 运行资产与页面测试**

Run: `node --test --test-concurrency=1 test/yhzd-editorial.test.js test/site-shell.test.js`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add images/yhzd/manifest.json images/yhzd/*.webp test/yhzd-editorial.test.js
git commit -m "feat(yhzd): replace preview thumbnails with responsive photo assets"
```

---

### Task 5: 响应式、无障碍与整体验收

**Files:**
- Modify: `yhzd-editorial.css`
- Modify: `yhzd-editorial.js`
- Modify: `test/yhzd-editorial.test.js`

**Interfaces:**
- Consumes: Task 2–4 完成后的页面、样式、随机引擎与高清资产。
- Produces: 满足桌面/平板/手机、减少动态效果、加载优先级和基本可访问性的 V7 候选版本。

- [ ] **Step 1: 增加边界条件测试**

补充静态/单元断言：

- CSS 在 `max-width:980px` 下把 `.editorial-scene` 改为单列，同时不隐藏 `.editorial-media`
- CSS 存在 `@media (prefers-reduced-motion: reduce)`
- HTML Hero 的 `<h1>` 唯一且为「萤火之地」
- `selectImages` 在只有 3 张同方向图片时仍可给 3 个不同 scene 返回唯一图片
- `selectMessages` 面对超长句池时不截断字符串
- `safeReadHistory/safeRemember` 面对抛错 storage 不传播异常

- [ ] **Step 2: 运行测试确认边界覆盖**

Run: `node --test test/yhzd-editorial.test.js`

Expected: PASS；如任何新边界断言失败，先修实现再继续。

- [ ] **Step 3: 运行完整仓库测试与构建检查**

Run: `npm test`

Expected: PASS。

Run: `npm run build`

Expected: PASS。

- [ ] **Step 4: 部署 Vercel Preview 并做人工视觉检查**

部署 `feat/yhzd-editorial-v7` 预览，不触碰 production alias。检查至少：

- 桌面 1536×960：Hero 先于内容；第一幕主图完整；主引语完整；无重叠
- 1440px 宽：主图仍在 spec 的约 55–62vw 视觉区间内
- 手机窄屏：Hero → 主图 → 引语 → 下一幕，照片不隐藏、不横向溢出
- 连续刷新 4 次：内容变化，但构图保持同一视觉秩序
- 图片加载清晰，不再出现 120px 放大模糊
- 纵向阅读中“还有很多”的感觉来自后续 scene，而不是首屏拥挤

- [ ] **Step 5: 如人工检查只发现尺寸/间距问题，限定在 CSS token 内微调**

只允许调整 `--page-width`、scene gap、quote font-size、hero min-height、grid columns、shadow 强度等视觉 token；不得重新引入绝对定位、多图重叠、随机坐标或强横向漫游。

- [ ] **Step 6: 最终验证**

Run: `npm test && npm run build`

Expected: both PASS。

确认 Git diff 只包含 V7 页面、V7 样式/脚本、V7 测试、图片资产和已批准的设计/计划文档。

- [ ] **Step 7: Commit**

```bash
git add yhzd.html yhzd-editorial.css yhzd-editorial.js test/yhzd-editorial.test.js package.json images/yhzd docs/superpowers
git commit -m "feat(yhzd): complete V7 editorial memory experience"
```

---

## Plan Self-Review Result

- **Spec coverage:** 设计规格 1–16 节均映射到 Task 1–5；未发现遗漏。
- **Step scan:** 每一步均为单一可验证动作；实现步骤只固定接口和视觉数值，没有写出完整程序正文。
- **Type/interface consistency:** Task 3 定义的 UMD API 与 Task 5 边界测试使用同一函数名；历史 key 固定沿用 v2。
- **Review Focus coverage:** 超长引语、方向不足、损坏 storage、响应式、reduced-motion 均在 Task 3/5 有测试或人工检查。
- **Scope:** 仅重构 `萤火之地` 单页与对应资产/测试，不改主站其他模块，不新增未批准功能。
