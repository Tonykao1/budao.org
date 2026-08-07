# budao.org Security Audit

## 1. Executive Summary

- **审计日期：** 2026-07-22
- **当前 commit：** `7b157aa6b1084dbee6b30475690c3972046d7f89`
- **审计范围：** 当前提交的全部 Git 跟踪文件；重点审查客户端、Vercel 风格 Node.js Serverless API、GitHub Contents API 数据写入链路、认证/授权、输入处理、敏感信息、部署配置和供应链。未访问生产数据，未对线上服务发送测试请求。
- **实际技术架构：** 单仓库、无构建步骤的静态 HTML/CSS/原生 JavaScript 前端；`api/*.js` 为 CommonJS/Node.js Serverless Functions（代码形态与 Vercel Functions 相符，但仓库没有 `vercel.json`，部署平台仍需控制台确认）；数据保存在仓库内的 `routes.json`，服务端通过 GitHub Contents API 读写；本地状态使用浏览器 `localStorage`。仓库内没有 Next.js、React、TypeScript、`package.json`、lockfile、数据库 ORM、Supabase/Firebase、数据库迁移、RLS、对象存储、AI、支付、邮件、短信、地图 SDK 或分析 SDK。
- **版本判断：** 仓库没有 Node 版本文件或包清单，Node.js 运行时版本无法由静态仓库确认；Next.js/React/TypeScript 不适用；package manager 不适用。
- **身份认证：** 没有服务端认证或会话。两个“管理员”账号及同一个共享口令硬编码在公开客户端 JavaScript 中；登录只改变前端 UI 内存状态。
- **文件存储：** 路线图片以外部 URL、路径或 `data:image/*` 字符串存入 `routes.json`；未发现独立文件上传服务。
- **总体风险：** **High**。公开的写接口可借用服务器 GitHub Token 直接提交并覆盖两个正式路线槽位；公开客户端同时泄露共享管理员口令。
- **是否建议立即上线：** **不建议**。如这些 API 已部署，应先下线/限制发布接口并轮换共享口令和 GitHub Token。
- **必须先修复：** SEC-001、SEC-002；SEC-003 应在恢复发布能力前一并处理。

## 2. Repository and Attack Surface Map

### 主要目录与入口

| 类别 | 路径 | 作用/敏感性 |
|---|---|---|
| 客户端入口 | `index.html`, `home.html`, `tent.html`, `test.html`, `create.html`, `about.html`, `what.html`, `tongdao.html`, `tongxing.html`, `yhzd.html`, `lsxh.html` | 公开静态页面；`tent.html` 是管理/发布 UI |
| 核心客户端脚本 | `app.js`, `tent-app.js`, `tent-word.js`, `invitation-engine.js`, `invitation-engine-safe.js`, `tongdao-app.js`, `tongdao-data.js` | 登录、路线编辑、发布、内容渲染、本地存储 |
| 服务端入口 | `api/publish-route.js`, `api/publish-route-v2.js`, `api/publish.js`, `api/routes.js`, `api/share-route.js` | GitHub 写入、请求日志、路线读取、SVG 分享图 |
| 数据入口 | `routes.json`, `data/routes.json`, `music/music.json` | 公开内容数据；正式发布链路读写根目录 `routes.json` |
| 管理入口 | `tent.html` + `app.js`/`tent-app.js`; `admin/index.html` | 前者包含实际客户端“登录”和发布；后者当前只是静态背景页 |
| 媒体入口 | 发布请求的 `image`、`qrCode` 字段 | URL/路径/data URI 被写进 JSON；不是独立对象存储上传 |
| AI 接口 | 无 | 未发现模型 SDK、API 或提示词 |
| 第三方服务 | GitHub REST Contents API | API Functions 使用 `GITHUB_TOKEN`/`GH_TOKEN` 读取并提交 `routes.json` |

### 关键调用链与信任边界

1. `tent.html` 加载公开的 `tent-app.js`（另有高度重复的 `app.js`）。
2. `tent-app.js:32-35` 在浏览器内保存管理员邮箱和口令；`tent-app.js:270-288` 只在浏览器中比较凭据并设置 `currentUserEmail`。
3. `tent-app.js:1075-1076` 把浏览器状态中的 `owner`/`slot` 放入请求体；`tent-app.js:981-987` 直接 POST 到 `/api/publish-route`，没有会话 Cookie 或 Authorization header。
4. `api/publish-route.js:12-51` 接收匿名请求，并仅根据请求体中的公开邮箱字符串决定“所有者”。
5. `api/publish-route.js:169-210` 使用服务器环境中的 GitHub Token 向 GitHub Contents API 发 PUT，提交到默认 `main` 分支。
6. `api/routes.js` 匿名读取固定路线；`test.html:703-715` 获取数据，`test.html:748-810` 对大部分文本做 HTML 转义后渲染。

主要信任边界是：不可信浏览器输入 → Serverless Function → 高权限 GitHub Token → GitHub 仓库 `main`；当前在第一和第二个边界间没有真实身份认证。

## 3. Findings Summary

| ID | Severity | Confidence | Status | Title | Location |
|----|----------|------------|--------|-------|----------|
| SEC-001 | High | High | Confirmed | 匿名发布接口可利用服务器 GitHub Token 覆盖正式路线并向 main 提交 | `api/publish-route.js:12-118`, `api/publish-route-v2.js:12-122` |
| SEC-002 | High | High | Confirmed | 管理员共享明文口令被编译进公开客户端且认证完全在前端 | `app.js:31-34,269-287`, `tent-app.js:32-35,270-288` |
| SEC-003 | Medium | High | Confirmed | 写接口缺少速率、请求大小和字段长度限制，可消耗 GitHub API/部署资源并膨胀提交历史 | `api/publish-route.js:30-46,217-271`, `api/publish-route-v2.js:30-46,221-309` |
| SEC-004 | Low | Medium | Likely | 仓库未配置 CSP、防嵌入和其他安全响应头 | 全仓库；无 `vercel.json`/headers 配置 |
| SEC-005 | Low | High | Confirmed | 调试 API 将完整匿名请求体写入服务端日志并原样回显 | `api/publish.js:1-27` |

## 4. Detailed Findings

### SEC-001：匿名发布接口可利用服务器 GitHub Token 覆盖正式路线并向 main 提交

- **Severity:** High
- **Confidence:** High
- **Status:** Confirmed
- **CWE:** CWE-306 (Missing Authentication for Critical Function), CWE-862 (Missing Authorization)
- **OWASP Category:** A01:2021 Broken Access Control; A07:2021 Identification and Authentication Failures
- **Affected files:** `api/publish-route.js:12-118,169-215,217-305`; `api/publish-route-v2.js:12-122,173-218,221-349`; `app.js:922-953`; `tent-app.js:978-1010`
- **Affected roles:** 匿名访客、IMS 管理员、BACBC 管理员、仓库维护者。
- **Preconditions:** 部署环境配置了能写目标仓库内容的 `GITHUB_TOKEN` 或 `GH_TOKEN`，且任一发布函数可从互联网访问。
- **Evidence:** Handler 只检查 HTTP method 和服务器端 `token` 是否存在（`api/publish-route.js:20-28`），从匿名请求体读取路线（`:30-46`）。所谓 owner 验证只是把客户端可控字符串与两个公开邮箱比较（`:274-305`），没有验证请求者身份。随后固定槽位在 `:83-103` 被替换，并在 `:169-183` 通过 GitHub PUT 提交；Authorization 使用服务器 Token（`:200-210`）。CORS 还允许任意来源（`:424-427`；v1 对应文件末尾同类代码）。
- **Attack scenario:** 攻击者无需登录，向 `/api/publish-route` 或 `/api/publish-route-v2` POST 一个带 `title`、`owner: "IMS@budao.org"`（或 BACBC）和相应 `slot` 的 JSON。服务端接受公开 owner 值，替换该固定槽位，使用自身 Token 创建 `Publish Route: ...` commit。攻击者可反复覆盖活动内容。
- **Impact:** 正式路线内容被未授权修改；两个合法发布者的内容可被替换；主分支和部署可被持续触发；恶意外链/追踪图片可被植入公开页面。写入路径目前固定为 `routes.json`，因此未证明可任意改写其他仓库文件或执行代码，故未定为 Critical。
- **Existing mitigations:** method 限制、固定仓库/分支/文件路径、两个固定槽位、owner 字符串白名单、GitHub SHA 冲突检查。它们限制修改范围，但均不能证明调用者是对应 owner，也不能阻止匿名利用。
- **Recommended fix:** 立即禁用公网写入口或在边缘层临时封锁。实现服务端身份认证（不可使用客户端共享秘密），由已验证身份在服务端映射角色/槽位；完全忽略客户端的 owner、slot、branch 等授权字段。对发布操作实施 CSRF/Origin 防护（如使用 Cookie）、审计记录、速率限制，并让 GitHub Token 只拥有目标仓库/内容的最小权限；优先经受保护分支/受控数据服务而非直接写 `main`。
- **Verification steps:** 在隔离的测试仓库和测试 Token 上，以无 Cookie/无 Authorization 请求调用两个 endpoint；确认当前能产生 commit。修复后重复请求应为 401/403；已认证 IMS 对 BACBC 槽位也应为 403。不得在生产仓库验证。
- **Regression test recommendation:** 集成测试覆盖匿名、伪造 owner、跨槽位、过期会话、合法各角色、并发 SHA 冲突；断言未授权场景不调用 GitHub PUT。

### SEC-002：管理员共享明文口令被编译进公开客户端且认证完全在前端

- **Severity:** High
- **Confidence:** High
- **Status:** Confirmed
- **CWE:** CWE-798 (Use of Hard-coded Credentials), CWE-602 (Client-Side Enforcement of Server-Side Security)
- **OWASP Category:** A07:2021 Identification and Authentication Failures; A01:2021 Broken Access Control
- **Affected files:** `app.js:31-34,269-287`; `tent-app.js:32-35,270-288`; `tent.html:43-58`
- **Affected roles:** IMS、BACBC、匿名访客。
- **Preconditions:** 攻击者能读取公开站点 JavaScript 或仓库内容。
- **Evidence:** 两个邮箱和相同口令以明文对象形式存在于 `app.js:31-34` 与 `tent-app.js:32-35`（报告中不重复完整口令；掩码：`B********!`）。提交表单时只在浏览器用 `find` 比较（`app.js:269-287`, `tent-app.js:270-288`），成功后仅设置内存变量/展示 UI；没有服务器会话、Cookie、JWT 或身份提供商。
- **Attack scenario:** 任何访问者查看 JavaScript 即可获得两账户共享口令并打开管理 UI；即使 UI 被隐藏，也可直接构造 SEC-001 的请求。若该口令在其他系统复用，影响可能进一步扩大，需要人工核查。
- **Impact:** 管理员身份无法可信区分、口令无法保密、审计归属失真；攻击者获得完整发布 UI。与 SEC-001 共同导致实际内容篡改。
- **Existing mitigations:** 页面有密码输入框和错误提示，但比较逻辑及秘密均在不可信客户端，不能提供安全边界。
- **Recommended fix:** 立即轮换该口令，并检查是否在邮箱、Vercel、GitHub 或其他系统复用。删除客户端凭据；采用成熟的服务端身份提供商/一次性邮件链接/强密码哈希与 MFA，由服务器建立短期安全会话。每次敏感操作单独执行服务端角色和资源授权。
- **Verification steps:** 检查部署后的 JS bundle/源文件不再含邮箱-口令表；登录成功后应获得 HttpOnly、Secure、合适 SameSite 的短期会话 Cookie；退出和撤销后旧会话必须失效。
- **Regression test recommendation:** 自动扫描构建产物中的凭据模式；端到端测试登录、失败锁定/节流、退出、过期、角色隔离及直接 API 访问。

### SEC-003：写接口缺少速率、请求大小和字段长度限制

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **CWE:** CWE-400 (Uncontrolled Resource Consumption), CWE-770 (Allocation of Resources Without Limits)
- **OWASP Category:** A04:2021 Insecure Design
- **Affected files:** `api/publish-route.js:30-46,105-110,217-271`; `api/publish-route-v2.js:30-46,109-114,221-309`
- **Affected roles:** 匿名访客、仓库维护者、所有站点用户。
- **Preconditions:** 写接口上线且服务器 Token 有写权限；实际平台请求体上限允许请求通过。
- **Evidence:** 应用只要求对象存在且有 `title`（v1 `:30-41`），没有 schema、类型、字符长度、总请求体或频率限制。v1 接受任意长度的 `data:image/`（`:258-268`）。v2 仅对普通 image 设 240,000 字符、QR 设 700,000 字符限制（`:266-309`），其他文本字段和总体请求仍无限制。每个不同请求都会 JSON 序列化并创建 Git commit（v1 `:105-110`；v2 `:109-114`）。
- **Attack scenario:** 匿名攻击者持续提交变化的超长标题/描述/二维码 data URI。每次请求触发 GitHub GET+PUT、提交和可能的重新部署，消耗 Serverless 时间、GitHub API 配额并永久膨胀 Git 历史；并发请求还可制造大量 409 重试压力。
- **Impact:** 发布功能或站点数据更新不可用、配额/构建资源消耗、仓库体积增长和运营成本。平台自身可能限制单请求大小，但无法阻止大量上限以内请求。
- **Existing mitigations:** GitHub SHA 可阻止部分并发覆盖；v2 对两个 data URI 字段有局部长度限制；未知的 Vercel/CDN 限制可能降低单请求影响。均不解决匿名频率和总量问题。
- **Recommended fix:** 与 SEC-001 一起要求认证；在边缘和应用两层按用户/IP 限流；定义严格 schema、字段类型/枚举/最大长度、图片 MIME 白名单和总解码大小；限制每日发布次数；对重复内容保持幂等；对 GitHub/网络调用设置超时和熔断。
- **Verification steps:** 在隔离环境测试边界值、超限 JSON、超长 data URI、快速重复和并发请求；确认在调用 GitHub 前返回 400/413/429。
- **Regression test recommendation:** schema 单元测试和 429/413 集成测试；断言超限请求不会产生 commit。

### SEC-004：仓库未配置 CSP、防嵌入和其他安全响应头

- **Severity:** Low
- **Confidence:** Medium
- **Status:** Likely
- **CWE:** CWE-1021 (Improper Restriction of Rendered UI Layers or Frames), CWE-693 (Protection Mechanism Failure)
- **OWASP Category:** A05:2021 Security Misconfiguration
- **Affected files:** 全仓库；缺少 `vercel.json`、Next config、服务器 headers 配置。
- **Affected roles:** 管理 UI 用户、普通访客。
- **Preconditions:** 部署/CDN 控制台没有额外注入安全响应头；攻击者能诱导用户访问嵌入站点的恶意页面。
- **Evidence:** 仓库中没有 CSP、`frame-ancestors`/`X-Frame-Options`、HSTS、`X-Content-Type-Options`、`Referrer-Policy` 或 `Permissions-Policy` 的部署配置。页面大量使用内联 script/style，因此严格 CSP 需要改造。实际线上响应头无法由仓库确认。
- **Attack scenario:** 若平台未补充 headers，攻击者可 iframe 嵌入管理 UI 进行点击劫持；缺少 CSP 也减少对未来注入缺陷的纵深防御。
- **Impact:** 主要是纵深防御缺失；当前没有确认可绕过浏览器同源策略直接读取数据。
- **Existing mitigations:** 浏览器同源策略；部分用户内容渲染路径使用 `escapeHtml`/`escapeAttribute`。
- **Recommended fix:** 在部署层添加 CSP（至少 `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`，并根据实际外部媒体逐项允许）、HSTS、`nosniff`、严格 referrer policy 和适当 permissions policy。逐步移除内联脚本以使用 nonce/hash CSP。
- **Verification steps:** 查看生产/Preview 的实际响应头并用浏览器验证 iframe 被拒绝；若控制台已有同等配置，将状态改为 Not Applicable。
- **Regression test recommendation:** 部署后响应头自动测试和 CSP violation 监控。

### SEC-005：调试 API 将完整匿名请求体写入日志并回显

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed
- **CWE:** CWE-532 (Insertion of Sensitive Information into Log File)
- **OWASP Category:** A09:2021 Security Logging and Monitoring Failures
- **Affected files:** `api/publish.js:1-27`
- **Affected roles:** 任何向端点提交内容的用户、日志访问者。
- **Preconditions:** `/api/publish` 被部署并可访问；请求中包含个人或敏感信息。
- **Evidence:** endpoint 允许任意来源 POST（`:3-16`），把未经 schema 验证的整个 `req.body` 在 `:19-21` 传给 `console.log`，并在 `:23-27` 原样回显。
- **Attack scenario:** 用户或自动化误把邮箱、电话、私密路线信息或 Token 发到该看似发布的 endpoint，完整内容进入平台日志；攻击者也可注入换行制造误导性日志。
- **Impact:** 敏感内容被日志系统保留和扩大访问范围；日志污染。没有证据表明该端点本身写数据库或 GitHub。
- **Existing mitigations:** 只接受 POST；没有鉴权、脱敏、长度限制或字段白名单。
- **Recommended fix:** 若仅为开发桩，生产删除/禁用；否则实施认证和 schema，只记录请求 ID、结果、主体 ID 等最小元数据，统一脱敏并限制日志保留期。
- **Verification steps:** 在隔离部署确认 endpoint 是否存在，并检查日志目的地/保留策略；不要向生产发送真实敏感值。
- **Regression test recommendation:** 测试日志中不出现请求体、凭据或个人信息；生产路由清单测试确保调试端点不可用。

## 5. GitHub-backed Data Security Review

本项目未使用 Supabase 或传统数据库，因此 RLS/SQL policy 不适用。实际持久化系统为 Git 仓库文件和 GitHub Contents API。

| 数据对象 | 读取控制 | 创建/更新控制 | 删除控制 | 风险 |
|---|---|---|---|---|
| 根目录 `routes.json` | 静态公开；`api/routes.js:8-28` 匿名 GET，只返回 IMS/BACBC 两槽 | `publish-route*.js` 匿名 POST；请求者只需声明公开 owner/slot；服务器 Token 写 `main` | 没有独立 DELETE；提交缺少某槽或替换内容可造成逻辑删除/覆盖 | SEC-001、SEC-003；无用户级隔离 |
| `data/routes.json` | 静态公开 | 仓库内未发现 API 写入 | 未发现 | 可能是旧/备用数据，需确认是否仍被业务使用 |
| `music/music.json` | 静态公开 | 仓库内未发现 API 写入 | 未发现 | 未发现敏感字段 |
| 浏览器 `localStorage` (`budao.tent.*`) | 同源脚本可读 | 客户端用户可任意修改 | 客户端可删除 | 只能作为草稿/缓存，不能作为认证或授权依据 |

GitHub Token 仅在服务端环境变量读取，没有发现 Token 字面量进入客户端；但它被匿名接口作为 confused deputy 使用。需要在 GitHub 控制台验证 Token 类型、scope、过期时间、仓库范围、分支保护及审计日志。

## 6. Authentication and Authorization Matrix

以下矩阵描述**当前代码实际权限**，不是期望权限。

| 功能 | 匿名访客 | 声称 IMS | 声称 BACBC | 仓库维护者 | 服务端校验 |
|---|---:|---:|---:|---:|---|
| 查看公开页面/路线 | 允许 | 允许 | 允许 | 允许 | 无需认证 |
| 打开管理 UI | 可通过读取公开口令进入 | 允许 | 允许 | 允许 | 无；仅客户端比较 |
| 更新 IMS 路线 | **允许直接 POST** | 允许 | **允许伪造 owner 后操作** | 允许 | 仅检查请求体字符串 |
| 更新 BACBC 路线 | **允许直接 POST** | **允许伪造 owner 后操作** | 允许 | 允许 | 仅检查请求体字符串 |
| 向 `main` 创建路线 commit | 通过匿名 API 间接允许 | 允许 | 允许 | 允许 | 只检查服务器 Token 存在 |
| 读取 GitHub 私有内容（若仓库私有） | API 仅返回固定路线 | 同左 | 同左 | 依 GitHub 权限 | Token 在服务端；输出过滤到两槽 |

不存在注册、密码重置、邮箱验证、OAuth、session、Cookie、JWT、刷新、退出失效或 CSRF 实现。不存在可验证的管理员/带领人/参与者角色模型；仅有两个可伪造的 owner 字符串。

## 7. API and Server Entry Point Inventory

| 入口 | Method | 认证 | 授权/所有权 | 输入校验 | 数据/副作用 | 结论 |
|---|---|---|---|---|---|---|
| `api/publish-route.js` | POST, OPTIONS | 无 | 客户端 owner 白名单，不验证主体 | 仅要求 title；无长度/总量限制 | GitHub GET+PUT `routes.json` | SEC-001/003 |
| `api/publish-route-v2.js` | POST, OPTIONS | 无 | 同上；slot 也可由请求控制/推导 | title + 局部 data URI 长度限制 | GitHub GET+PUT `routes.json` | SEC-001/003 |
| `api/publish.js` | POST, OPTIONS | 无 | 无 | 无 schema/长度限制 | 记录并回显请求体 | SEC-005 |
| `api/routes.js` | GET, OPTIONS | 无（公开内容） | 只返回固定 IMS/BACBC 槽 | 无用户参数 | GitHub GET；错误时返回空数组 | 未确认漏洞；公开性需业务确认 |
| `api/share-route.js` | GET | 无（公开分享图） | 无 | `routeId` 转字符串；找不到时回退首条 | GitHub GET；输出 XML 已转义 | 未确认 XSS；应限制 routeId 长度并设置 `nosniff` |

未发现 Server Actions、Webhook、Edge Functions、RPC、后台任务、导出接口、真正的 multipart 文件上传或删除接口。所有 GitHub URL 的 owner/repo/branch/path 来自服务端环境/常量，未发现客户端可控 SSRF 或路径遍历。分享 SVG 对路线字段使用 `escapeXml`（`api/share-route.js:46-108`）。公开页面的主要路线卡片对文本/属性使用转义（如 `test.html:766-807`），本次未确认可利用 XSS。

## 8. Secrets and Environment Review

- Git 跟踪树中没有 `.env`、`.env.local` 或环境示例文件。
- 未发现真实 GitHub Token、OpenAI Key、Supabase service role key、数据库连接串或私钥字面量。
- 发现公开共享管理员口令，位置为 `app.js:31-34`、`tent-app.js:32-35`；仅以掩码 `B********!` 表示，详见 SEC-002。
- 服务端从 `GITHUB_TOKEN`/`GH_TOKEN` 读取高权限凭据（`api/publish-route.js:1-4`, `api/publish-route-v2.js:1-4`, `api/routes.js:1-4`, `api/share-route.js:1-4`）。未发现它直接进入响应或客户端 bundle，但匿名写代理造成权限滥用。
- `BUDAO_PUBLIC_URL` 只用于构造分享链接，不是秘密；`GITHUB_OWNER/REPO/BRANCH` 为配置而非秘密。
- 当前提交内容扫描未发现其他高置信密钥。Git 历史中可见共享口令曾出现在多个提交；没有完整扫描 Git 对象中所有密钥格式，建议使用专用 secret scanner 对全历史和已删除分支再核查。
- 需在 Vercel/部署控制台验证环境变量是否错误暴露到 Preview、是否包含过宽 Token，以及日志中是否已有敏感请求体。

## 9. Dependency and CI/CD Review

- 仓库没有 `package.json`、npm/yarn/pnpm/bun lockfile或第三方 Node 依赖声明，因此无法进行常规 SCA/CVE 版本审计；Serverless 代码依赖运行时内置 `fetch`/`Buffer`。
- 没有 install/postinstall/prepare 脚本。
- 没有 `.github/workflows`，因此不存在仓库内 GitHub Actions action pinning、workflow permissions 或 PR secrets 配置可审查。
- 没有 Dockerfile、`vercel.json`、Node 版本文件、部署脚本或 IaC。运行时版本、部署命令、Preview/Production 环境变量隔离和安全响应头必须在部署控制台验证。
- 使用 GitHub Contents API `2022-11-28`，固定 API host 和仓库默认值；未发现 dependency confusion/拼写相似包风险。
- 风险集中在部署 Token 权限和直接写 `main`：应使用 fine-grained Token/GitHub App、仅目标仓库 Contents 最小权限、短期凭据，并启用分支保护和审计告警。

## 10. Security Hardening Recommendations

以下为非漏洞性质或纵深防御建议：

1. 建立统一的服务端 schema 校验，拒绝未知字段，并对日期、时区、枚举和 URL 使用明确 allowlist。
2. 外部图片仅允许 HTTPS 和可信媒体域；禁止 `blob:` 持久化，解析并验证 data URI 的实际 MIME/解码大小。对外部图片的用户 IP 泄露和追踪风险给出说明或采用受控代理。
3. 所有网络调用设置明确超时；对 GitHub 失败区分 4xx/5xx 并加入可观测性，不把内部错误返回给客户端。
4. 将管理站与公开站隔离域名/路由；为管理入口启用 MFA、重新认证和安全审计日志。
5. 添加 `Cache-Control: no-store` 给未来的会话/管理 API；公开路线 API 可以缓存，但要避免把含个人信息的数据加入公共缓存。
6. 对日志设置字段白名单、脱敏、访问控制和最短保留期；不要记录 Token、完整请求体、邮箱/电话或私密内容。
7. 建立 secret scanning、SAST、依赖清单（若将来引入包）和部署前安全回归测试。
8. 清理/确认重复实现 `app.js` vs `tent-app.js`、`publish-route.js` vs `publish-route-v2.js` 的实际生产路由，避免旧的不安全版本仍可达。

## 11. Prioritized Remediation Plan

### 立即修复

1. 临时下线或在部署层封锁 `publish-route`, `publish-route-v2`, `publish` 三个匿名写/日志 endpoint。
2. 轮换公开共享口令；检查跨系统复用。
3. 轮换 GitHub Token，检查 2026-07-01 起相关 `Publish Route:` 提交和 API 审计日志；缩小 Token scope。

### 上线前修复

1. 实现服务端身份认证、短期安全会话、服务端角色/槽位映射及逐操作授权。
2. 为写 API 加 schema、大小/长度、速率/配额、幂等和超时控制。
3. 删除客户端口令与生产调试 API；为关键授权场景添加自动测试。
4. 确认部署层安全响应头、Preview/Production 隔离及分支保护。

### 下一版本修复

1. 将图片迁移到受控存储，校验实际文件类型、大小、所有权和生命周期。
2. 完善隐私分类、日志脱敏/保留和内容发布审计。
3. 合并重复/旧 endpoint，并显式记录唯一生产入口。

### 长期加固

1. 优先使用短期 GitHub App Token 或更合适的数据服务，避免公网请求直接驱动主分支。
2. 建立 CSP nonce/hash、持续 secret scanning、SAST、部署配置即代码和定期权限复核。
3. 制定账号撤销、事件响应、Token 轮换、备份/恢复及恶意内容回滚流程。

## 12. Audit Limitations

- 本报告是 commit `7b157aa6b1084dbee6b30475690c3972046d7f89` 的静态审计；没有对线上域名、API 或生产数据执行请求。
- 当前任务目录本身不是 Git 仓库；审计对象是可访问工作区中远程明确为 `https://github.com/Tonykao1/budao.org.git` 的仓库。审计时该工作树在新增本报告前为干净状态，分支为 `main`。
- 无法验证 Vercel/其他平台的实际项目绑定、Node 版本、函数路由映射、请求体上限、WAF/限流、环境变量、Preview 隔离、部署日志和响应头。
- 无法验证 GitHub Secrets/Token 实际值、Token scope、分支保护、仓库规则、审计日志、泄露告警和已删除远程 refs。
- 仓库不使用 Supabase；因此没有 Supabase 控制台/RLS 可验证。若另有未入库数据库或服务，需提供控制台/架构清单。
- 无法确认两个共享口令是否在邮箱、GitHub、Vercel或其他第三方复用。
- 无法从静态仓库确认 DNS、CDN、WAF、TLS/HSTS、缓存以及生产 CORS 的最终响应行为。
- 没有运行动态渗透、DAST、浏览器 CSP 测试、并发/容量测试或真实 GitHub 写入验证；利用场景依据完整静态调用链确认。
- 未使用专用工具对所有历史 Git 对象和远程已删除分支做取证式 secret 扫描；当前树和相关提交搜索未发现除公开共享口令外的真实凭据。
