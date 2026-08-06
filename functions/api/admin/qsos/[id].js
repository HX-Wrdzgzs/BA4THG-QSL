import { authorize, error, json, readJson } from '../../../_lib/http.js';
import { fingerprintQso, normalizeQsoInput, rowToPublicItem, updateQsoStatement } from '../../../_lib/qso.js';

function requireDb(env) {
  if (!env.DB) throw new Error('D1 数据库尚未绑定为 DB');
  return env.DB;
}

export async function onRequestGet(context) {
  const auth = authorize(context.request, context.env);
  if (!auth.ok) return auth.response;
  try {
    const row = await requireDb(context.env).prepare('SELECT * FROM qsos WHERE id = ? AND deleted_at IS NULL')
      .bind(context.params.id).first();
    if (!row) return error('记录不存在', 404);
    return json({ item: rowToPublicItem(row) });
  } catch (exception) {
    return error(exception instanceof Error ? exception.message : '读取失败', 500);
  }
}

export async function onRequestPatch(context) {
  const auth = authorize(context.request, context.env);
  if (!auth.ok) return auth.response;
  try {
    const db = requireDb(context.env);
    const body = await readJson(context.request);
    const qso = normalizeQsoInput(body, { myCallsign: context.env.OPERATOR_CALLSIGN || 'BA4THG' });
    const fingerprint = await fingerprintQso(qso);
    const duplicate = await db.prepare('SELECT id FROM qsos WHERE fingerprint = ? AND id != ? AND deleted_at IS NULL')
      .bind(fingerprint, context.params.id).first();
    if (duplicate) return error('修改后会与另一条通联重复', 409, { existingId: duplicate.id });

    const now = new Date().toISOString();
    const result = await updateQsoStatement(db, context.params.id, qso, fingerprint, now).run();
    if (!result.meta?.changes) return error('记录不存在', 404);
    await db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, detail_json, created_at)
      VALUES ('update', 'qso', ?, ?, ?)
    `).bind(context.params.id, JSON.stringify({ source: 'web' }), now).run();
    return json({ ok: true, id: context.params.id });
  } catch (exception) {
    const message = exception instanceof Error ? exception.message : '修改失败';
    return error(message, message.includes('无效') || message.includes('格式') ? 400 : 500);
  }
}

export async function onRequestDelete(context) {
  const auth = authorize(context.request, context.env);
  if (!auth.ok) return auth.response;
  try {
    const db = requireDb(context.env);
    const now = new Date().toISOString();
    const result = await db.prepare('UPDATE qsos SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
      .bind(now, now, context.params.id).run();
    if (!result.meta?.changes) return error('记录不存在', 404);
    await db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, detail_json, created_at)
      VALUES ('delete', 'qso', ?, '{}', ?)
    `).bind(context.params.id, now).run();
    return json({ ok: true });
  } catch (exception) {
    return error(exception instanceof Error ? exception.message : '删除失败', 500);
  }
}
