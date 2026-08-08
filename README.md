# BA4THG QSL Card Archive

这是 BA4THG 的独立 QSL 卡片展示仓库。项目不使用前端构建框架，可直接部署到 Cloudflare Pages。

## 页面与资源

- `index.html`：QSL 卡片画廊。
- `app.js` / `styles.css`：画廊交互与样式。
- `图片/`：原始 PNG 生成源。
- `图片/thumbs/`：带内容指纹的 WebP 缩略图。
- `图片/webp/`：带内容指纹的完整尺寸 WebP。
- `scripts/optimize_images.py`：图片转换与页面引用更新脚本。

## 新增卡面

1. 将导出的 PNG 放入 `图片/`。
2. 在 `scripts/optimize_images.py` 的 `SOURCE_IMAGES` 中登记卡片 ID 与源文件。
3. 在 `app.js` 的 `cardCatalog` 中增加对应记录。
4. 本地运行 `python scripts/optimize_images.py`，或推送到 `main` 让 GitHub Actions 自动生成 WebP 并更新引用。
5. 可用分类为 `city`、`character`、`rhythm` 和 `back`。

## 图片策略

网页展示不直接加载原始 PNG。首屏与画廊使用 `图片/thumbs/` 中的 WebP 缩略图；点击卡片后再加载 `图片/webp/` 中的完整尺寸 WebP。

`CRAC.png` 和哈希命名 PNG 的用途尚未确认，暂未加入公开画廊。

## 缓存策略

Cloudflare Pages 通过 `_headers` 对 HTML、JavaScript 和 CSS 使用重新验证或短期缓存；带内容指纹的 WebP 使用一年期不可变缓存。

本仓库只负责 QSL 卡片展示，不承载 QSO 数据库、录入后台或通联日志服务。
