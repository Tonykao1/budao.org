# 道｜数据结构与生命周期 V1

## 1. 一道的身份

- `id`: 系统内部不可变 ID。
- `daoCode`: 人可读、唯一且冻结的道号。格式原则：`BD + 日期 + 经文编号`，不使用点号。
- `devotionalDate`: 灵修日期。
- `publishedAt`: 正式发布时间（UTC ISO 8601）。
- `publicationTimezone`: 发布时所在 IANA 时区。
- `publicationLocale`: 发布时使用的语言/地区代码。
- `publisherName`: 发布者姓名。

## 2. 经文结构

道号可用于经文定位和搜索，但系统同时保存结构化经文，以支持整卷、章节、区间、统计与交叉检索。

- `scripture.bookCode`
- `scripture.bookName`
- `scripture.chapterStart`
- `scripture.verseStart`
- `scripture.chapterEnd`
- `scripture.verseEnd`
- `scripture.referenceDisplay`
- `scripture.text`
- `scripture.translation`

## 3. 内容结构

- `theme`
- `cardIntro`
- `questions[7]`
  - `order`
  - `role`: `OPEN | EXPERIENCE | ENCOUNTER | HEART | SCRIPTURE_THRESHOLD | CONFRONTATION | GOSPEL_RESPONSE`
  - `text`
- `story`
  - `type`
  - `title`
  - `source`
  - `summary`
- `highlights`
- `response`
- `prayer`
- `tags`
  - `themes[]`
  - `seasons[]`
  - `terrains[]`

## 4. 生命周期

主状态：

`DRAFT -> PENDING_REVIEW -> REJECTED | APPROVED -> PUBLISHED`

规则：

1. 草稿可修改。
2. 提交后进入系统预检与超级管理员查验。
3. 查验失败保留原稿与意见，可回到草稿修订后重提。
4. 查验通过并正式发布后，道被冻结；不得修改。
5. 发布后的任何内容修改必须形成一道新的记录、新日期与新道号。

派生状态独立保存：

- `tongdao.available`: 是否进入同道可调用集。
- `card.status`: `PENDING | GENERATED | FAILED`。
- `card.url`: 生成后的道卡资源地址。
- `media[]`: 本道后续关联的讲道、分享、音频、视频或直播回放链接。

## 5. 同道调用

同道不复制“道”的正文，而通过 `daoId` / `daoCode` 引用已经查验并发布的道。

默认调用：

- 经文
- 主题
- 七问
- 七问角色/阶段

故事、要点、回应、祷告保留在完整道记录中，可供带领人查看，但不默认塞入同道现场模板。

当前取集方式可保持随机；数据量增长后，可按主题、经文、季节、地形或它们的组合筛选。

## 6. 道卡派生

道卡从已经发布且冻结的“道”派生，不成为第二份可编辑正文。

卡面字段：

- 大龙票
- 步道图形 Logo（克制使用）
- 主题
- 经文出处
- 经文全文：根据版面长度决定是否展示
- Q5 / Q6 / Q7
- `cardIntro`
- 道号
- 发布日期邮戳
- 发布者姓名
- `budao.org`
- 指向本道永久页面的二维码

邮戳根据 `publicationTimezone` 与 `publicationLocale` 渲染当地日期、文字与地域表达。

二维码应指向稳定的本道永久页，而不是直接指向某个第三方音视频地址；音视频作为本道页面的后续关联资源。
