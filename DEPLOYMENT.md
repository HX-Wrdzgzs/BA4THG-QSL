# BA4THG QSO Archive 部署说明

## 1. 当前组成

- `index.html`：原 QSL 卡面档案。
- `logbook.html`：公开全时段 QSO 查询。
- `admin.html`：私有录入、修改、导入、同步和备份。
- `functions/`：Cloudflare Pages Functions API。
- `migrations/`：D1 数据库迁移。
- `图片/`：现有 QSL 静态图片。

公开页面会优先读取 D1。若 Pages 尚未绑定 D1，`/api/public/qsos` 会临时回退到 `api.mzyyun.com/public/qso`，因此只能看到上游允许查询的近一年公开记录。管理、导入、导出和同步功能必须绑定 D1 后才能使用。

## 2. 创建 D1

安装或临时运行 Wrangler：

```bash
npx wrangler d1 create ba4thg-qso
```

记录输出中的 `database_id`。将 `wrangler.toml.example` 复制为本地的 `wrangler.toml`，替换数据库 ID。不要把包含错误 ID 或私密信息的临时配置提交到仓库。

应用迁移：

```bash
npx wrangler d1 migrations apply ba4thg-qso --remote
```

迁移只创建结构，不会删除现有记录。

## 3. Cloudflare Pages 设置

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
| `UPSTREAM_API_BASE` | Text | `https://api.mzyyun.com` |
| `ADMIN_API_TOKEN` | Secret | 至少 32 位随机字符串 |

生成令牌示例：

```bash
openssl rand -hex 32
```

不要把 `ADMIN_API_TOKEN` 写入 GitHub、前端 JavaScript、截图或公开日志。

## 4. 保护管理页面

令牌认证用于 API 的最低门禁。正式部署还应在 Cloudflare Zero Trust → Access 中保护：

- `/admin.html`
- `/api/admin/*`
- `/api/sync/*`

只允许你的邮箱或指定身份提供商账号访问。Access 不能替代 API 令牌；两层应同时保留。

## 5. 首次同步

打开 `/admin.html`，输入 `ADMIN_API_TOKEN`，点击“连接档案库”，然后点击“立即同步”。

同步规则：

- 仅新增或更新 `mzyyun_api` 来源记录。
- 相同指纹会关联到已有本地记录，不重复创建。
- 上游未返回的记录不会删除。
- 因上游只开放近一年，几年前的记录需要通过 ADIF、CSV、JSON 或网页手动补录。

## 6. GitHub Actions 每日同步

在仓库 Settings → Secrets and variables → Actions 中添加：

- `QSO_SYNC_URL`：Pages 正式站点 Origin，例如 `https://qso.example.com`
- `QSO_ADMIN_TOKEN`：与 Cloudflare Secret 相同的管理令牌

工作流默认每天北京时间 03:20 左右运行，也可在 Actions 中手动执行。

## 7. 历史数据导入

管理页面支持：

- ADIF：`.adi` / `.adif`
- CSV：首行字段名，推荐使用 API 的 camelCase 字段
- JSON：数组、`records` 数组或本系统导出的 `qsos` 数组

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

单批 API 最多 100 条，浏览器会自动分批。重复指纹不会再次写入。

## 8. 备份

建议至少：

- 每次大批量导入前导出 JSON 和 ADIF。
- 每周导出一份 ADIF。
- 每月导出 JSON，并复制到本地 NAS 或其他云盘。
- QSL 图片继续由 GitHub 保存；年度归档时把图片和日志导出一起打包。

D1 是自有在线档案库，但不应成为唯一备份。
