# BUDAO 第六套《远方·召唤》｜设计规范 V1

**阶段：设计研发、独立预览；尚未通过视觉审核，尚未上线正式海报系统。**

## 对标方法

取法 Tourism Australia 国家级目的地广告：完整真实风景、明确口号、直接邀请与低密度信息。只借鉴视觉语言，不下载或复刻任何官方宣传图、商标或其他版权素材。

参考：
- Tourism Australia: There's Still Nothing Like Australia — https://www.tourism.australia.com/en/resources/campaign-resources/past-campaigns/theres-still-nothing-like-australia.html
- Tourism Australia: Come and Say G'day — https://www.tourism.australia.com/en/resources/campaign-resources/come-and-say-gday.html

## 母版冻结前的 V1 具体规范

| 项目 | V1 设计 |
|---|---|
| 输出比例 | 1080×1530px 竖版 PNG |
| 背景 | 每条路线对应的真实照片覆盖整张画布，center-crop 和受控水平/垂直焦点，非生成摄影 |
| 第一视觉 | 用户可编辑口号；初始「去远方。」；字体大、粗、紧凑，无自动生成文案 |
| 第二视觉 | 当前路线真实标题，口号下方；不是附加虚构副标题 |
| 日期信息 | 底部左侧，大日期和明确年/月/日、周几及集合时间 |
| 路线基础信息 | 地区、集合地点、距离、难度、时间、爬升，有就如实显示；没有则不捏造 |
| 报名二维码 | 底部右侧绑定本路线 QR 原图；不重绘内容、不替换；原图白边保留，外补 6px 白色留边；默认 198×198px，最近邻采样 |
| 图片取色逻辑 | 从照片左上、左中两块有效像素采样亮度和局部明暗变化，用确定性规则选择口号位置与明/暗色；仅施加柔和局部亮度渐变 |
| 口号设置 | 自动取色、强制白字或墨字；自动/上方/中部位置；可手工修改不超过14字符的短口号 |
| 取景编辑 | 水平焦点、垂直焦点、亮度滑块；可选本机照片，仅当前浏览器预览、不改变活动原图 |
| 技术方式 | HTML5 Canvas + `BudaoPosterRuntime.normalized()` + 真实 `/api/routes`；无 AI 调用 |
| 正式发布 | 禁止：用户视觉审核通过之前，必须保持独立实验和 draft PR |

### QR 安全边界

- QR 数据从 `record.qr` 读取；当记录提供 `qrSha` 时校验原始 Git blob SHA-1；错误或二维码缺失则禁止导出。
- 只将原始 QR 图像按相同纵横比绘入 198×198px 区域，关闭图像平滑；不覆盖和改写图像上的任意像素。
- 原始 QR 图自身的静区全部保留；外部额外 6px 白色背景框不侵入二维码。

### 本轮研发 QA（不等于用户视觉审核）

2026-11-11：Chromium/Playwright 实际访问独立实验页：
- 「静之湖暖冬半日营」与「温榆秘境」：HTTP 200，真实摄影绘制、活动资料与对应 QR 加载成功，1080×1530 PNG 文件签名有效，浏览器无 JS 异常。
- 「未来智谷少年行」缺原始 QR：有效拦截导出。
- 手机视口 390px：页面无横向溢出。
- 用户修改口号、明暗、位置和照片取景：预览重绘可用。
- 超长不可清晰排版的集合地点：安全拒绝导出而非静默截断。
- 未做实体手机实扫验收；V1 需要用户审美审核和最终设备扫码确认。

**实验页面**：`experiments/diy-template-06-distant-call-v1.html`。
