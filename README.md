# BA4THG QSL Card Archive

这是一个无需构建工具的静态 QSL 卡片展示页，直接读取 `图片/` 目录中的成品 PNG，不公开 `PSD/` 工程文件。

## 本地预览

直接双击 `index.html` 即可查看。为了避免浏览器对本地文件的限制，也可以在本目录启动任意静态文件服务器。

## 新增卡面

1. 将导出的 PNG 放入 `图片/`。
2. 打开 `app.js`，在 `cardCatalog` 中新增一条记录。
3. `thumbnail` 可指向较小的预览图，`image` 应指向完整大图。
4. 可用分类为 `city`、`character`、`rhythm` 和 `back`。

当前页面将 `-small` 文件仅作为缩略图使用，因此不会重复计入卡面总数。`CRAC.png` 和哈希命名 PNG 的用途尚未确认，暂未加入公开画廊。
