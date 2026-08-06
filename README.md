# BA4THG QSL Card Archive

这是一个无需前端构建工具的静态 QSL 卡片展示页。原始 PNG 保存在 `图片/`，页面首屏和画廊只加载经过压缩的 WebP 缩略图；用户点击卡片后，浏览器才请求对应的原始大图。

## 本地预览

直接双击 `index.html` 即可查看。为了避免浏览器对本地文件的限制，也可以在本目录启动任意静态文件服务器。

## 新增卡面

1. 将导出的 PNG 放入 `图片/`。
2. 打开 `app.js`，在 `cardCatalog` 中新增一条记录，并让 `image` 指向原始 PNG。
3. 推送到 `main` 后，GitHub Actions 会自动生成带内容指纹的 WebP 缩略图并更新页面引用。
4. 可用分类为 `city`、`character`、`rhythm` 和 `back`。

## 缓存策略

Cloudflare Pages 通过 `_headers` 对 HTML、JavaScript 和 CSS 使用重新验证策略；带内容指纹的 WebP 使用长期不可变缓存。原始 PNG 采用较短缓存，并且只在大图预览时加载。

`CRAC.png` 和哈希命名 PNG 的用途尚未确认，暂未加入公开画廊。
