# budao.org Security Remediation Report

## 1. Baseline

- **原审计 commit：** `7b157aa6b1084dbee6b30475690c3972046d7f89`
- **实际远端修复基线：** `55af37817bd373ccd360410824816986e5236550`（原审计 commit 因仓库历史重写未存在于远端；修复前已重新核对当前远端代码中的三项漏洞）
- **修复分支：** `security/fix-critical-audit`
- **修复代码 commit：** `bf2394d`；远端入口适配测试 commit：`1564857`
- **修复后 commit：** 以本报告所在分支最终 HEAD 为准
- **修复日期：** 2026-08-01
- **范围：** SECURITY_AUDIT.md 中的 SEC-001、SEC-002、SEC-003。没有修改或删除现有 `routes.json` 业务数据，没有连接生产环境。
- **历史说明：** 原修复分支完整保存在本地 `security/fix-critical-audit-original`；当前同名分支从最新远端 `main` 重建，避免把约 152 MiB 的旧历史强行接到远端或覆盖 `main`。

## 2. Findings Addressed

### SEC-001：匿名发布接口借用服务器 GitHub Token 写入正式内容

- **原风险：** 任意匿名请求可声明公开 owner/slot，由服务器 Token 覆盖 `routes.json` 并直接提交 `main`。
- **根因：** 写入口没有服务端身份认证或角色授权；把客户端 owner 当成授权依据；发布分支默认为 `main`。
- **修改文件：** `api/publish-route-v2.js`, `api/publish.js`, `api/_security/auth.js`, `api/_security/http.js`, `api/auth/*`；`api/publish-route.js` 保留为不执行写操作的迁移响应。
- **修复方式：** 实际 GitHub 写入口 v2 要求有效的 HttpOnly 签名短期会话和服务端 `publisher` 角色；publisher 槽位由受信任的服务端用户配置决定，忽略客户端身份。v1 继续只返回 409 迁移提示且不写 GitHub，旧调试发布入口固定返回 410。仓库、路径和分支均由服务端固定；默认发布分支为 `security/content-publishing`，配置成 `main` 时 fail closed 返回 503。GitHub 错误统一映射为有限错误码，不回传上游响应、请求头或堆栈。
- **测试证据：** 匿名访问实际 v2 发布入口为 401；v1 返回 409 且不执行写入；伪造普通用户签名会话为 401；合法 publisher 只向 `routes.json` 和受控分支 PUT；`main` 配置返回 503；旧入口返回 410。
- **剩余风险：** 当前只安全地产生受控分支提交，没有自动创建 Pull Request。必须先在 GitHub 创建/允许该受控分支、保护 `main` 并建立人工 PR 合并流程。Token scope 和真实分支规则只能在控制台验证。

### SEC-002：客户端明文共享管理员口令和纯前端认证

- **原风险：** 两个管理员邮箱和共享明文口令公开在 `app.js`/`tent-app.js`；浏览器内比较即可打开管理 UI。
- **根因：** 没有服务端身份系统，客户端状态被当成身份。
- **修改文件：** `tent-app.js`, `api/auth/login.js`, `api/auth/session.js`, `api/auth/logout.js`, `api/_security/auth.js`。远端基线不存在 `app.js`，修复过程没有重新引入该旧文件。
- **修复方式：** 删除所有客户端管理员口令和本地凭据比较。登录由服务端读取 `BUDAO_ADMIN_USERS_JSON` 中每位用户独立的 scrypt salt/hash 和固定 slot；服务端用至少 32 字符的 `BUDAO_SESSION_SECRET` 生成一小时 HttpOnly、Secure、SameSite=Strict Cookie。配置缺失或无效时默认拒绝。API 每次重新验证签名、过期时间、issuer、audience、role 和 slot；客户端状态只影响显示，不能授予服务器权限。
- **测试证据：** 客户端资产扫描确认没有原共享口令、GitHub Token 或 Session Secret；无会话、普通角色或客户端伪造状态无法发布；合法服务端配置的 publisher 能登录并发布。
- **剩余风险：** 静态 `tent.html` 页面外壳仍公开可加载，但敏感操作由服务器保护且页面不包含秘密。生产管理员用户哈希必须由 Tony 在安全环境生成并分别配置；不得复用旧口令。当前没有 MFA、账号恢复或集中撤销列表，后续宜迁移到成熟身份提供商。

### SEC-003：写接口缺少统一输入与资源限制

- **原风险：** 无认证、Content-Type/总体大小/字段长度/schema/速率限制；匿名请求可反复制造 GitHub commits 和资源消耗。
- **根因：** 直接信任任意 JSON 并传入 normalize/commit 流程。
- **修改文件：** `api/_security/http.js`, `api/_security/route-schema.js`, `api/_security/rate-limit.js`, `api/publish-route-v2.js`, `tent-app.js`。
- **修复方式：** 统一要求 POST 和 `application/json`；请求体最大 48 KiB、对象深度最多 3、最多 30 个字段。显式 allowlist 和每字段长度限制，未知/敏感/mass-assignment 字段一律拒绝；owner、slot、role、userId、repository、branch、path、Token、审批和审计字段均不能由客户端提交。图片只允许 HTTPS 或安全相对路径；data URI 新发布被禁用。按用户+IP 每分钟最多 10 次发布，登录按 IP 每 15 分钟最多 5 次。已有内容相同则不再 PUT，保持幂等。
- **测试证据：** 覆盖超大请求 413、错误 Content-Type 415、超长 title 400、branch/repository/path/owner 等未知敏感字段 400、第 11 次发布 429、相同内容第二次提交不产生 PUT。
- **剩余风险：** 当前限流是单 Serverless 实例内存桶；多实例生产环境必须叠加 Vercel Firewall/持久化 KV 或外部限流服务，才能形成全局强限制。新内嵌图片发布暂时关闭，已有 data URI 不删除且文本更新时由服务端保留；后续应迁移至受控对象存储。

## 3. Authentication and Authorization Changes

1. 客户端提交邮箱和密码到同源 `/api/auth/login`；不再保存管理员密码或认证标记。
2. 登录接口只读取服务端 `BUDAO_ADMIN_USERS_JSON`，验证独立 scrypt hash；配置不得进入客户端。
3. 成功后返回签名 HttpOnly Cookie；响应只包含当前用户自己的 slot，不返回角色表、哈希或管理员名单。
4. 写 API 从验证后的 Session claim 取得 user ID、publisher role 和 slot；客户端 `currentUserEmail`、DOM/CSS、localStorage、owner 或 slot 均不是授权依据。
5. POST 登录、退出和发布必须同源，减少 Cookie CSRF 风险；会话同时设置 SameSite=Strict。
6. 未登录/无效会话统一 401；已认证但无 publisher 权限的 token 也不会通过严格 claim 校验。输入违规为 400/413/415，限流为 429，安全配置缺失为 503。
7. `BUDAO_SESSION_SECRET` 少于 32 字符、用户配置无效、GitHub Token 缺失或目标为 `main` 时均默认拒绝。

## 4. GitHub Publishing Flow Changes

- 客户端不能提交 owner、slot、repository、branch、path、commit target 或 GitHub Token。
- 服务端仓库仍固定为部署配置/受控默认值，文件固定为 `routes.json`。
- 发布分支只读 `GITHUB_PUBLISH_BRANCH`，默认 `security/content-publishing`；值为 `main` 时写操作完全禁用。
- GitHub Token 只在 `api/*.js` 服务端代码读取；客户端构建检查禁止出现 Token/Session Secret 名称和硬编码密码。
- 相同路线内容返回 `idempotent: true` 且不产生第二次 PUT。
- 本阶段没有实现自动 PR 创建，避免在缺少可靠 GitHub App/Token scope 和分支规则验证时扩大权限。安全流程是受控分支提交后，由 Tony 审核并手动创建/合并 PR。

## 5. Input Validation and Rate Limiting

- **方法：** POST only；其他方法 405。
- **媒体类型：** `application/json` only；否则 415。
- **大小：** 序列化/原始请求最大 48 KiB；否则 413。部署平台还应设置更外层的请求限制。
- **复杂度：** 顶层必须是普通对象；最大嵌套深度 3；最多 30 个字段；数组和对象字段不在 schema 内，因此被拒绝。
- **Schema：** 只接受路线内容 allowlist；所有字段必须是字符串并满足独立最大长度；未知字段拒绝。
- **图片：** HTTPS 或安全相对路径；禁止 `http:`, `data:`, `blob:` 和其他 scheme。旧数据不删除。
- **身份字段：** owner/slot/role/isAdmin/userId/ownerId/createdBy/approvalState 等服务端决定字段全部拒绝。
- **GitHub 字段：** repository/repo/branch/path/filePath/githubToken/token/commitTarget 全部拒绝。
- **限流：** 登录 IP 维度 5/15 分钟；发布 user ID + IP 维度 10/分钟。生产需部署级共享限流作为第二层。
- **日志与错误：** 新认证/发布代码不记录请求体、Cookie、Authorization header 或 Token；响应不含内部堆栈或 GitHub 上游内容。

## 6. Tests and Commands Run

| 命令 | 最终结果 | 说明 |
|---|---|---|
| `npm run lint` | PASS | 对两个发布入口、三个 auth endpoint和实际客户端 `tent-app.js` 执行 Node syntax check |
| `npm run typecheck` | PASS | 仓库没有 TypeScript；运行安全 schema 模块加载/接口适配检查，1/1 通过 |
| `npm run test` | PASS | Node test runner，9/9 通过 |
| `npm run build` | PASS | 静态站没有构建工具；客户端安全构建检查通过，无服务端 secret 名称或硬编码密码 |
| `git diff --check` | PASS | 无空白/补丁格式错误 |

测试覆盖：匿名实际写入口、无写能力的 v1 迁移入口、禁用旧入口、普通角色/伪造客户端状态、敏感未知字段、任意 main/repository/path/owner、超大请求、错误 Content-Type、超长字段、合法管理员、受控分支和固定路径、重复提交幂等、`main` fail closed、速率 429、客户端 secret 扫描、Token 不进入成功响应。

如实记录：重建分支后第一次完整验证在 lint 阶段失败，因为移植脚本仍引用远端已不存在的 `app.js`；修正文件清单后，第二次测试为 3/9，通过项之外的 6 项因测试仍调用无写能力的 v1 迁移入口而得到 409。将回归测试改为针对实际 v2 写入口后，最终 lint、typecheck、9/9 test 和 build 全部通过。原仓库没有 `package.json` 或这些任务；上述最小脚本是本次新增。

## 7. Manual Console Actions Required

### GitHub（Tony 手动完成）

1. **已完成：** 旧 classic GitHub Token 已撤销；仍需确认没有其他部署继续使用旧凭据。
2. **已完成：** 已创建仅限 `budao.org`、Contents read/write、Metadata read-only 的 fine-grained Token；上线前仍需复核其有效期和无多余权限。
3. 建立/允许服务端使用 `security/content-publishing` 受控分支；不要授予直接写 `main` 的流程。
4. **已完成：** `main` ruleset 已启用必须 PR、禁止删除和 force push、无 bypass；上线前确认规则仍为 Active，并按需要增加状态检查。
5. 检查 Audit Log、Git 提交历史和异常 `Publish Route:` commits；必要时回滚恶意内容，但不要删除合法业务数据。
6. **已完成：** Secret Scanning 当前无未解决告警，Secret Protection 与 Push Protection 已开启；部署前再次复核。
7. 确认新 Token 无 Administration、Actions、Secrets、其他仓库或组织级多余权限。

### Vercel/部署平台（Tony 手动完成）

1. **已完成一半：** 旧 `GITHUB_TOKEN` 环境变量已删除；暂不要把新 Token 加入 Production。Preview 动态验证方案确认后再添加适用范围受限的凭据，且不得在工单、聊天或源码中复制其值。
2. 配置 `GITHUB_PUBLISH_BRANCH=security/content-publishing`；绝不能设置为 `main`。
3. 仅在确需发布的 Production 环境配置 GitHub Token；确认 Preview 不误用生产凭据。测试 Preview 应使用隔离测试仓库/Token，或完全不配置使其 fail closed。
4. 安全生成至少 32 字节随机 `BUDAO_SESSION_SECRET`；配置每位管理员独立的 `BUDAO_ADMIN_USERS_JSON` scrypt hash。不得使用审计中已泄露的旧共享口令，不得复用密码。
5. 检查函数日志中是否存在历史 Token、Cookie、完整请求体、邮箱或私密内容；按保留和事件响应政策处理。
6. 在 Vercel Firewall/共享 KV/外部限流层实现全局登录和发布限制；应用内存限流只能作为实例内第一层。
7. 确认部署后的请求体限制、安全响应头、同源/Host 行为和 Cookie Secure/SameSite；在 Preview 完成动态回归。
8. 在受控分支发布后采用人工 PR 审核进入 `main`，不要开启自动合并或生产自动发布，直到审核完成。

## 8. Residual Risks

1. 没有自动创建 PR；需人工从受控内容分支创建并审核 PR。
2. 应用内存限流不是跨实例全局限流，生产必须配置部署层/持久化限流。
3. 最小本地身份系统没有 MFA、集中撤销、密码重置或身份提供商审计；短期可用，长期应迁移到单一成熟 IdP。
4. 静态管理页面外壳可公开加载；真实权限只在 API。需在 Preview 验证所有未来管理 API 都复用同一服务端边界。
5. data URI 新图片发布已禁用；旧图片保留。受控文件存储、真实 MIME 检测和上传配额尚未实现。
6. GitHub/Vercel 的 Token scope、环境隔离、分支规则、日志、WAF、响应头和线上路由仍需人工验证。
7. 未对生产或 Preview 发起请求，未进行真实 GitHub commit/PR 动态验证；测试使用完全虚构的本地凭据和 mock GitHub API。
8. 没有第三方依赖和 TypeScript，因此测试/静态语法检查不能代替未来引入构建系统后的完整 SCA/typecheck。

## 9. Deployment Recommendation

**DEPLOY TO PREVIEW ONLY**

原因：SEC-001/002/003 的代码级安全边界和回归测试已完成，但在受控生产发布前必须先轮换 Token、保护 `main`、配置独立管理员哈希与 Session Secret、增加跨实例限流，并在隔离 Preview 验证真实 Vercel/GitHub 行为。Preview 不得连接生产仓库或使用生产 Token。
