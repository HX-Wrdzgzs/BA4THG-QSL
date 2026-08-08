# BA4THG QSO Archive 部署说明

## 1. 当前组成

- `index.html`：QSL 卡面档案。
- `logbook.html`：公开全时段 QSO 查询。
- `admin.html`：私有录入、修改、导入、浏览器同步和备份。
- `functions/`：Cloudflare Pages Functions API。
- `migrations/`：D1 数据库迁移。
- `图片/`：现有 QSL 静态图片。

公开日志只读取自有 Cloudflare D1，不再由 Worker 回退访问 `api.mzyyun.com`。现有公开 API 只作为管理员浏览器同步近一年公开记录的数据来源。

## 2. 正式域名与上游网站接入

本项目建议正式固定使用：

```text
https://qso.mizuki.top
```

先在 Cloudflare Pages 中把 `qso.mizuki.top` 绑定为项目自定义域名，并确认浏览器实际能从这个 Origin 打开网站。然后在微信小程序：

```text
设置 → 网站接入
```

添加完整 Origin：

```text
https://qso.mizuki.top
```

注意：

- 必须包含 `https://`。
- 不要填写 `/admin.html`、`/logbook.html` 或任何路径。
- API 会根据浏览器自动发送的 `Origin` 识别对应操作员。
- 如果你从 `*.pages.dev` 预览域名打开后台，同步时 Origin 会变成该 `pages.dev` 域名；除非它也已登记，否则上游会返回 403。
- 正式同步建议始终从 `https://qso.mizuki.top/admin.html` 进入。

## 3. 创建 D1

安装或临时运行 Wrangler：

```bash
npx wrangler d1 create ba4thg-qso
```

记录输出中的 `database_id`。将 `wrangler.toml.example` 复制为本地 `wrangler.toml`，替换数据库 ID。

应用迁移：

```bash
npx wrangler d1 migrations apply ba4thg-qso --remote
```

迁移只创建结构，不会删除已有记录。

## 4. Cloudflare Pages 设置

使用 GitHub 仓库创建或更新 Pages 项目：

- Framework preset：None
- Build command：留空
- Build output directory：`.`
- Root directory：仓库根目录

在 Pages 项目的 Settings → Bindings 中添加：

- 类型：D1 database
- Variable name：`DB`
- Database：`ba4thg-qso`

在 Variables and Secrets 中添加：

| 名称 | 类型 | 值 |
|---|---|---|
| `OPERATOR_CALLSIGN` | Text | `BA4THG` |
| `ADMIN_API_TOKEN` | Secret | 至少 32 位随机字符串 |

生成令牌示例：

```bash
openssl rand -hex 32
```

不要把 `ADMIN_API_TOKEN` 写入 GitHub、前端 JavaScript、截图或公开日志。

## 5. 保护管理页面

令牌认证用于 API 的最低门禁。正式部署还建议在 Cloudflare Zero Trust → Access 中保护：

- `/admin.html`
- `/api/admin/*`

只允许你的邮箱或指定身份提供商账号访问。Access 不能替代 API 令牌，两层应同时保留。

## 6. 浏览器同步现有公开 API

新的上游 API 要求请求由已经登记的网站浏览器发起，因此不再使用 GitHub Actions、curl 或 Worker 服务端定时抓取。

同步流程：

```text
管理员浏览器（qso.mizuki.top）
        ↓ 浏览器自动携带 Origin
api.mzyyun.com/public/qso
        ↓ 返回近一年公开记录
admin.js
        ↓ 管理令牌认证
/api/admin/import-upstream
        ↓
Cloudflare D1
```

首次同步：

1. 打开 `https://qso.mizuki.top/admin.html`。
2. 输入 `ADMIN_API_TOKEN`。
3. 点击“连接档案库”。
4. 点击同步按钮。
5. 浏览器按 `limit=50` 自动分页读取上游。
6. 每页数据立即提交本站 `/api/admin/import-upstream` 归档。

同步规则：

- 只读取上游当前允许访问的近一年公开记录。
- 来源记录保存为 `mzyyun_api`。
- 上游相同 `id` 会更新来源映射及由上游管理的数据。
- 如果指纹与本地记录一致，只建立来源关联，不重复创建。
- 上游未返回的历史记录绝不会从 D1 删除。
- 上游返回的 `station` 与 `BA4THG` 不一致时拒绝归档。
- 403 时优先检查浏览器地址栏 Origin 是否与小程序“网站接入”登记值完全一致。

## 7. 历史数据导入

因为上游公开接口只提供近一年记录，几年前的 QSO 需要从其他来源补入 D1。

管理页面支持：

- ADIF：`.adi` / `.adif`
- CSV：首行字段名，推荐使用 API 的 camelCase 字段
- JSON：数组、`records` 数组或本系统导出的 `qsos` 数组
- 网页手动录入

核心字段：

- `myCallsign`
- `theirCallsign`
- `qsoDatetime`
- `frequency`
- `mode`
- `myEquipment`
- `myAntenna`
- `myPower`
- `myQth`
- `theirQth`

普通文件导入单批最多 100 条；浏览器会自动分批。重复指纹不会再次写入。

## 8. 公开日志

`/api/public/qsos` 只查询 D1：

- D1 未绑定：返回 503。
- D1 已绑定但没有记录：正常返回空列表。
- 不再通过 Worker 服务端请求 `api.mzyyun.com`。

因此网站的长期可用性不依赖上游 API 是否在线。

## 9. 备份

建议至少：

- 每次大批量导入前导出 JSON 和 ADIF。
- 每周导出一份 ADIF。
- 每月导出 JSON，并复制到本地 NAS 或其他云盘。
- QSL 图片继续由 GitHub 保存；年度归档时把图片和日志导出一起打包。

D1 是自有在线档案库，但不应成为唯一备份。
