# BA4THG Digital Radio Archive

BA4THG 的 QSL 卡面与全时段 QSO 数字档案。项目不使用前端构建工具，可直接部署到 Cloudflare Pages。

## 页面

- `index.html`：QSL 卡片画廊，页面展示资源全部使用 WebP。
- `logbook.html`：公开 QSO 查询与全时段日志。
- `admin.html`：私有 QSO 录入、编辑、ADIF/CSV/JSON 导入、现有 API 同步、JSON/ADIF 导出。

## 数据架构

```text
微信小程序公开 API ─┐
网页录入 / 文件导入 ─┼─> Pages Functions ─> Cloudflare D1 ─> 公开日志网站
手动同步 / 定时同步 ─┘                         │
                                               └─> JSON / ADIF 离线备份

GitHub 仓库 ─> QSL 静态图片与网站源码
```

D1 是网站自有的长期档案库；`api.mzyyun.com` 仅作为近一年数据的同步来源。同步不会因为上游记录超出一年而删除 D1 历史。

## QSL 卡面

原始 PNG 仅作为仓库内的生成源保存在 `图片/`，不会被 `index.html` 或 `app.js` 引用。页面首屏和画廊加载 `图片/thumbs/` 中的轻量 WebP；用户点击卡片后，再加载 `图片/webp/` 中的完整尺寸 WebP。

新增卡面时：

1. 将导出的 PNG 放入 `图片/`。
2. 在 `scripts/optimize_images.py` 的 `SOURCE_IMAGES` 中登记卡片 ID 与源文件。
3. 在 `app.js` 的 `cardCatalog` 中增加对应记录，并保留 `thumbnail` 与 `image` 字段供脚本更新。
4. 本地运行 `python scripts/optimize_images.py`，或推送到 `main` 让 GitHub Actions 自动生成带内容指纹的缩略图和完整大图 WebP。
5. 可用分类为 `city`、`character`、`rhythm` 和 `back`。

`CRAC.png` 和哈希命名 PNG 的用途尚未确认，暂未加入公开画廊。

## 缓存策略

Cloudflare Pages 通过 `_headers` 对 HTML 和核心资源使用重新验证或短期缓存；`图片/thumbs/` 与 `图片/webp/` 中带内容指纹的 WebP 使用一年期不可变缓存。

## 部署

完整步骤见 [`DEPLOYMENT.md`](./DEPLOYMENT.md)。在绑定 D1 前，公开日志会临时回退到现有公开 API；管理功能会返回未配置提示。

## 安全

- `ADMIN_API_TOKEN` 只能配置为 Cloudflare Secret。
- 不要在前端代码、GitHub Actions 日志或截图中泄露令牌。
- 建议使用 Cloudflare Access 额外保护 `admin.html`、`/api/admin/*` 和 `/api/sync/*`。
- 对外公开前检查 QTH、联系电话、备注和图片 EXIF，避免泄露精确住址。
