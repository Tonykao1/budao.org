# 营火之地图片工作流

日常只做两步：

1. 把原始照片放进 `assets-src/yhzd/`。
2. 运行 `python3 scripts/build-yhzd-images.py`。

脚本会自动校正手机照片方向、去除公开版本的 EXIF/GPS、保持原始构图（只缩放、不裁切），并生成 480px / 960px 两档 WebP 与 `images/yhzd/manifest.json`。

首次运行如果提示缺少 Pillow，只需执行一次：

```bash
python3 -m pip install Pillow
```

原始照片目录 `assets-src/yhzd/` 保持在 Git 之外；网站只部署自动生成的公开版本。

## 页面规则

- 图片池与文字池完全独立，不建立配对、说明或共同 ID。
- 桌面版 V1 固定 6 个图片空间位置，每次刷新从图片池重新随机抽取且单次不重复。
- 图片只按横图 / 竖图适配位置；默认保留摄影者原始宽高比，不使用 `object-fit: cover` 强制裁切。
- 图片无标题、日期、地点、期次、caption、点赞或相册式浏览入口。
- 480px 为基础版本；960px 存在时由浏览器通过 `srcset` 自动选择。
- 图片加载失败时不影响营火之地原有文字体验。
