import { authorize, error, json, readJson } from '../../_lib/http.js';
import { fingerprintQso, insertQsoStatement, normalizeQsoInput } from '../../_lib/qso.js';

export async function onRequestPost(context) {
  const auth = authorize(context.request, context.env);
  if (!auth.ok) return auth.response;
  if (!context.env.DB) return error('D1 数据库尚未绑定为 DB', 503);

  try {
    const body = await readJson(context.request, 2_000_000);
    const records = Array.isArray(body.records) ? body.records : [];
    if (!records.length) return error('没有可导入的记录', 400);
    if (records.length > 100) return error('单批最多导入 100 条记录', 400);

    const now = new Date().toISOString();
    const statements = [];
    const accepted = [];
    const rejected = [];

    for (let index = 0; index < records.length; index += 1) {
      try {
        const qso = normalizeQsoInput(records[index], { myCallsign: context.env.OPERATOR_CALLSIGN || 'BA4THG' });
        const fingerprint = await fingerprintQso(qso);
        const id = crypto.randomUUID();
        const source = String(body.source || 'file_import').slice(0, 40);
        const sourceId = String(records[index].sourceId || fingerprint).slice(0, 160);
        statements.push(insertQsoStatement(context.env.DB, id, qso, fingerprint, 'local', now));
        statements.push(context.env.DB.prepare(`
          INSERT OR IGNORE INTO qso_sources (qso_id, source, source_id, raw_json, first_seen_at, last_seen_at)
          SELECT id, ?, ?, ?, ?, ? FROM qsos WHERE fingerprint = ?
        `).bind(source, sourceId, JSON.stringify(records[index]), now, now, fingerprint));
        accepted.push({ index, fingerprint });
      } catch (exception) {
        rejected.push({ index, error: exception instanceof Error ? exception.message : '记录无效' });
      }
    }

    const results = statements.length ? await context.env.DB.batch(statements) : [];
    let inserted = 0;
    for (let index = 0; index < results.length; index += 2) {
      inserted += Number(results[index]?.meta?.changes || 0);
    }

    await context.env.DB.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, detail_json, created_at)
      VALUES ('import', 'qso_batch', ?, ?, ?)
    `).bind(crypto.randomUUID(), JSON.stringify({ requested: records.length, accepted: accepted.length, inserted, rejected: rejected.length }), now).run();

    return json({
      ok: true,
      requested: records.length,
      accepted: accepted.length,
      inserted,
      skippedAsDuplicate: accepted.length - inserted,
      rejected,
    });
  } catch (exception) {
    return error(exception instanceof Error ? exception.message : '导入失败', 500);
  }
}
