import { authorize, error, json, normalizeCallsign, readJson } from '../../_lib/http.js';
import { fingerprintQso, insertQsoStatement, normalizeQsoInput } from '../../_lib/qso.js';

function mapUpstreamItem(item) {
  return {
    myCallsign: item.myCallsign,
    theirCallsign: item.theirCallsign,
    qsoDatetime: item.qsoDatetime,
    frequency: item.frequency,
    mode: item.mode,
    rstSent: item.rstSent,
    rstReceived: item.rstReceived,
    myGrid: item.grid,
    myQth: item.myQth,
    theirQth: item.theirQth,
    myEquipment: item.myEquipment,
    theirEquipment: item.theirEquipment,
    myAntenna: item.myAntenna,
    theirAntenna: item.theirAntenna,
    myPower: item.myPower,
    theirPower: item.theirPower,
    notes: item.notes,
    weather: item.weather,
    theirWeather: item.theirWeather,
    qslSent: item.qslSent,
    qslSentAt: item.qslSentAt,
    qslReceived: item.qslReceived,
    qslReceivedAt: item.qslReceivedAt,
    isPublic: true,
  };
}

export async function onRequestPost(context) {
  const auth = authorize(context.request, context.env);
  if (!auth.ok) return auth.response;
  if (!context.env.DB) return error('D1 数据库尚未绑定为 DB', 503);

  const db = context.env.DB;
  const operatorCallsign = normalizeCallsign(context.env.OPERATOR_CALLSIGN || 'BA4THG');
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  try {
    const body = await readJson(context.request, 1_000_000);
    const items = Array.isArray(body.items) ? body.items : [];
    const station = normalizeCallsign(body.station || operatorCallsign);

    if (station && station !== operatorCallsign) {
      return error(`上游返回台站 ${station}，与本站 ${operatorCallsign} 不一致`, 409);
    }
    if (!items.length) return json({ ok: true, fetched: 0, inserted: 0, updated: 0, linkedToExisting: 0 });
    if (items.length > 50) return error('单批最多接收 50 条上游记录', 400);

    await db.prepare(`
      INSERT INTO sync_runs (id, source, status, started_at)
      VALUES (?, 'mzyyun_api_browser', 'running', ?)
    `).bind(runId, startedAt).run();

    let inserted = 0;
    let updated = 0;
    let linked = 0;
    let rejected = 0;
    const now = new Date().toISOString();

    for (const item of items) {
      try {
        const sourceId = String(item?.id ?? '').trim();
        if (!sourceId) throw new Error('上游记录缺少 id');
        const itemCallsign = normalizeCallsign(item?.myCallsign || operatorCallsign);
        if (itemCallsign !== operatorCallsign) throw new Error('上游记录本台呼号不匹配');

        const qso = normalizeQsoInput(mapUpstreamItem(item), { myCallsign: operatorCallsign });
        const fingerprint = await fingerprintQso(qso);
        const sourceLink = await db.prepare(`
          SELECT q.id, q.managed_by
          FROM qso_sources s JOIN qsos q ON q.id = s.qso_id
          WHERE s.source = 'mzyyun_api' AND s.source_id = ?
        `).bind(sourceId).first();

        if (sourceLink) {
          await db.prepare(`
            UPDATE qso_sources SET raw_json = ?, last_seen_at = ?
            WHERE source = 'mzyyun_api' AND source_id = ?
          `).bind(JSON.stringify(item), now, sourceId).run();

          if (sourceLink.managed_by === 'external') {
            await db.prepare(`
              UPDATE qsos SET
                my_callsign=?, their_callsign=?, qso_datetime_utc=?, frequency_hz=?, frequency_display=?,
                band=?, mode=?, rst_sent=?, rst_received=?, my_qth=?, their_qth=?, my_grid=?, their_grid=?,
                my_equipment=?, their_equipment=?, my_antenna=?, their_antenna=?, my_power_w=?, their_power_w=?,
                notes=?, weather=?, their_weather=?, qsl_sent=?, qsl_sent_at=?, qsl_received=?, qsl_received_at=?,
                is_public=1, fingerprint=?, updated_at=?
              WHERE id=?
            `).bind(
              qso.myCallsign, qso.theirCallsign, qso.qsoDatetimeUtc, qso.frequencyHz, qso.frequencyDisplay,
              qso.band, qso.mode, qso.rstSent, qso.rstReceived, qso.myQth, qso.theirQth, qso.myGrid, qso.theirGrid,
              qso.myEquipment, qso.theirEquipment, qso.myAntenna, qso.theirAntenna, qso.myPowerW, qso.theirPowerW,
              qso.notes, qso.weather, qso.theirWeather, qso.qslSent, qso.qslSentAt, qso.qslReceived, qso.qslReceivedAt,
              fingerprint, now, sourceLink.id,
            ).run();
            updated += 1;
          } else {
            linked += 1;
          }
          continue;
        }

        const canonical = await db.prepare('SELECT id FROM qsos WHERE fingerprint = ? AND deleted_at IS NULL')
          .bind(fingerprint)
          .first();
        let qsoId = canonical?.id;

        if (!qsoId) {
          qsoId = crypto.randomUUID();
          const result = await insertQsoStatement(db, qsoId, qso, fingerprint, 'external', now).run();
          inserted += Number(result.meta?.changes || 0);
        } else {
          linked += 1;
        }

        await db.prepare(`
          INSERT OR IGNORE INTO qso_sources (qso_id, source, source_id, raw_json, first_seen_at, last_seen_at)
          VALUES (?, 'mzyyun_api', ?, ?, ?, ?)
        `).bind(qsoId, sourceId, JSON.stringify(item), now, now).run();
      } catch {
        rejected += 1;
      }
    }

    await db.prepare(`
      UPDATE sync_runs
      SET status='success', finished_at=?, fetched_count=?, inserted_count=?, updated_count=?
      WHERE id=?
    `).bind(new Date().toISOString(), items.length, inserted, updated, runId).run();

    return json({
      ok: true,
      runId,
      fetched: items.length,
      inserted,
      updated,
      linkedToExisting: linked,
      rejected,
    });
  } catch (exception) {
    const message = exception instanceof Error ? exception.message : '同步入库失败';
    await db.prepare(`
      INSERT OR REPLACE INTO sync_runs
      (id, source, status, started_at, finished_at, error_message)
      VALUES (?, 'mzyyun_api_browser', 'failed', ?, ?, ?)
    `).bind(runId, startedAt, new Date().toISOString(), message.slice(0, 1000)).run().catch(() => {});
    return error(message, 500);
  }
}
