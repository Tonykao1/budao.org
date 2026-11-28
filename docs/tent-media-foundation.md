# 帐篷媒体管理系统 · Phase 1 foundation
Status: development only. No production migration or public release.
## Architecture
Reuse getAuthenticatedPublisher and isSteward, same-origin checks and server-side ownership, not client flags. Desktop Tent and mobile Tent share one API. Preserve existing campfire archive IDs, quotes, hero selection and watermark paths. Route covers are not documentary images.
## Storage boundary
The repository is public: never upload draft bytes or originals to it. Existing upload-route-image is unsuitable for unpublished media. Configure a private object store with short-lived authenticated upload/download, server-side image decoding and re-encoding, metadata stripping, hash verification, quota and retention. No public URL until approved. Do not reuse the public GitHub route image upload. 
## Lifecycle
Draft → submitted → approved → publishing → published. Steward may return submitted albums or withdraw. Album and asset approval are separate; explicit consent required, especially for minors. Owner and reviewer identity are derived from session. All mutations use transactional revision checks and audit entries. Published edits require a new reviewed revision; preserve stable photo IDs. 
## Release adapter
Generate watermarked display copy per existing campfire editorial guide; retain authorized master only in private storage. Atomically publish sanitized approved assets and archive metadata (including publishedOn), preserve legacy quotes and IDs; update whats-new via existing archive feed. Verify public assets and deployment before marking published. Withdrawal must remove public references and copies, check CDN and public Git history implications; disclose that already downloaded copies cannot be recalled. Prefer revocable public storage rather than Git history for new personal imagery.
## Acceptance gates
Unauthenticated 401; other owner denied; non-steward review denied; origin checks; no draft public access; upload size/type/decode limits; dedup; revision conflicts; audit; 12-function Vercel budget; desktop/mobile actual account; old archive and hero/lightscreen regressions; release and withdrawal recovery. No production migration until storage and release adapters are implemented and validated.
## Current scope
Additive SQL and isolated policy module only. No endpoint, UI, storage credentials, migration invocation or deployment in this phase. 

## 2026-11-28 · TM-01 至 TM-05 开发分支进度

上文 Current scope 记录初始提交。后续实现使用 PostgreSQL 私有二进制对象表，复用帐篷 Cookie 和既有 Vercel 函数。桌面帐篷、移动帐篷均可进入 /tent-media.html。

| 阶段 | 已实现 | 验收方式 |
| --- | --- | --- |
| TM-01 | 媒体库使用独立 TENT_MEDIA_DATABASE_URL。私有母版及带水印展示副本与相册元数据在同一事务中落库。公开接口仅返回已发布且获准的展示副本。 | SQL 迁移、草稿访问拒绝、撤回后图片地址返回 404 |
| TM-02 | JPG、PNG、WebP 单帧解码，2 MiB 输入、2400 万像素上限，校验 SHA-256，转向和重编码去除元数据，按营火脚印生成水印。每册最多 24 张，媒体字节总上限 128 MiB。 | 实图上传、去 EXIF、哈希不符、重复上传、版本冲突 |
| TM-03 | 建册、逐张授权上传、删除草稿照片、提交、逐张审核、退回、批准相册、发布及撤回。变更记录账号、动作和修订号。 | 测试会话、390px 和 1280px Chromium 操作、独立 PostgreSQL 并发写入 |
| TM-04 | 公开相册动态并入营火档案；旧档案及主视觉仍按既有规则加载。 | 旧档案 24 册、188 张影像校验；浏览器按新相册链接定位 |
| TM-05 | 首页从同一发布状态读取相册、生成单张缩略图和相册链接。 | 浏览器发布后检查新事卡片；撤回后重新读取公开源 |

发布在单个数据库事务中切换可见性，面向访客的图片请求实时检查状态。已下载的副本无法召回。上传时保留经过重编码的私有母版，客户端原文件不落库。当前操作台逐张上传；撤回保留私有档案和审计记录。存储上限只计媒体字节，不含数据库索引、WAL 和备份。

### 验收记录与预览配置

- npm test 420/420，npm run build 223/223，lint、typecheck 通过。浏览器使用合成测试图和签名测试会话。原有生产迁移脚本在本地构建中按环境跳过。
- PostgreSQL 并发专项测试用 TENT_MEDIA_TEST_DATABASE_URL 建立一次性测试 schema，测试完成后清理。PR 工作流使用独立 PostgreSQL 服务。测试地址仅可指向测试实例。
- 预览运行需指定仅服务器可访问的隔离媒体数据库连接，数据库表不得向匿名角色或公共数据 API 开放。按顺序在该库执行 foundation 和 objects 两个 SQL 文件，并将 TENT_MEDIA_DATABASE_URL 绑定到该开发分支的 Preview 环境。构建过程不会自动执行媒体迁移。
- 生产和预览共用名为 DATABASE_URL 的既有环境配置，媒体代码不读取该变量。托管预览的真实账号验收、持续保留期限和生产容量尚待确认。部署记录以 PR 对应提交的 Vercel Preview 状态为准。
