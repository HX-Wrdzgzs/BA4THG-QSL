import { authorize, error, json, parsePositiveInt, readJson } from '../../_lib/http.js';
import { fingerprintQso, insertQsoStatement, normalizeQsoInput, rowToPublicItem } from '../../_lib/qso.js';

function requireDb(env) {
  if (!env.DB) throw new Error('D1 数据库尚未绑定为 DB');
  return env.DB;
}

export async function onRequestGet(context) {
  const auth = authorize(context.request, context.env);
  if (!auth.ok) return auth.response;

  try {
    const db = requireDb(context.env);
    const url = new URL(context.request.url);
    const page = parsePositiveInt(url.searchParams.get('page'), 1, 1, 100000);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 50, 1, 100);
    const offset = (page - 1) * limit;
    const total = await db.prepare('SELECT COUNT(*) AS total FROM qsos WHERE deleted_at IS NULL').first();
    const rows = await db.prepare(`
      SELECT * FROM qsos WHERE deleted_at IS NULL
      ORDER BY qso_datetime_utc DESC, id DESC LIMIT ? OFFSET ?
    `).bind(limit, offset).all();
    return json({ page, limit, total: Number(total?.total || 0), items: (rows.results || []).map(rowToPublicItem) });
  } catch (exception) {
    return error(exception instanceof Error ? exception.message : '读取失败', 500);
  }
}

export async function onRequestPost(context) {
  const auth = authorize(context.request, context.env);
  if (!auth.ok) return auth.response;

  try {
    const db = requireDb(context.env);
    const body = await readJson(context.request);
    const qso = normalizeQsoInput(body, { myCallsign: context.env.OPERATOR_CALLSIGN || 'BA4THG' });
    const fingerprint = await fingerprintQso(qso);
    const existing = await db.prepare('SELECT id FROM qsos WHERE fingerprint = ? AND deleted_at IS NULL').bind(fingerprint).first();
    if (existing) return error('疑似重复通联记录', 409, { existingId: existing.id });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.batch([
      insertQsoStatement(db, id, qso, fingerprint, 'local', now),
      db.prepare(`
        INSERT INTO qso_sources (qso_id, source, source_id, raw_json, first_seen_at, last_seen_at)
        VALUES (?, 'web', ?, ?, ?, ?)
      `).bind(id, id, JSON.stringify(body), now, now),
      db.prepare(`
        INSERT INTO audit_logs (action, entity_type, entity_id, detail_json, created_at)
        VALUES ('create', 'qso', ?, ?, ?)
      `).bind(id, JSON.stringify({ source: 'web' }), now),
    ]);

    return json({ ok: true, id }, { status: 201 });
  } catch (exception) {
    const message = exception instanceof Error ? exception.message : '录入失败';
    return error(message, message.includes('无效') || message.includes('格式') ? 400 : 500);
  }
}
