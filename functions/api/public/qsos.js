import { error, isValidCallsign, json, normalizeCallsign, parsePositiveInt } from '../../_lib/http.js';
import { rowToPublicItem } from '../../_lib/qso.js';

const UPSTREAM_DEFAULT = 'https://api.mzyyun.com';

function buildWhere(url, operatorCallsign) {
  const role = url.searchParams.get('role') === 'contact' ? 'contact' : 'operator';
  const callsign = normalizeCallsign(url.searchParams.get('callsign') || operatorCallsign);
  if (!isValidCallsign(callsign)) throw new Error('呼号格式无效');

  const where = ['is_public = 1', 'deleted_at IS NULL'];
  const bindings = [];
  where.push(role === 'contact' ? 'their_callsign = ?' : 'my_callsign = ?');
  bindings.push(callsign);

  const year = url.searchParams.get('year');
  if (year && /^\d{4}$/.test(year)) {
    where.push("strftime('%Y', qso_datetime_utc) = ?");
    bindings.push(year);
  }

  const mode = String(url.searchParams.get('mode') || '').trim().toUpperCase();
  if (mode) {
    where.push('mode = ?');
    bindings.push(mode.slice(0, 24));
  }

  const band = String(url.searchParams.get('band') || '').trim();
  if (band) {
    where.push('band = ?');
    bindings.push(band.slice(0, 16));
  }

  return { role, callsign, where, bindings, year, mode, band };
}

async function queryD1(db, url, operatorCallsign) {
  const page = parsePositiveInt(url.searchParams.get('page'), 1, 1, 100000);
  const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 1, 50);
  const offset = (page - 1) * limit;
  const filters = buildWhere(url, operatorCallsign);
  const whereSql = filters.where.join(' AND ');

  const totalRow = await db.prepare(`SELECT COUNT(*) AS total FROM qsos WHERE ${whereSql}`)
    .bind(...filters.bindings)
    .first();

  const result = await db.prepare(`
    SELECT * FROM qsos
    WHERE ${whereSql}
    ORDER BY qso_datetime_utc DESC, id DESC
    LIMIT ? OFFSET ?
  `).bind(...filters.bindings, limit, offset).all();

  const summary = await db.prepare(`
    SELECT
      COUNT(*) AS qso_count,
      COUNT(DISTINCT CASE WHEN ? = 'contact' THEN my_callsign ELSE their_callsign END) AS contact_count,
      SUM(CASE WHEN qsl_sent = 1 THEN 1 ELSE 0 END) AS qsl_sent_count,
      SUM(CASE WHEN qsl_received = 1 THEN 1 ELSE 0 END) AS qsl_received_count,
      MIN(qso_datetime_utc) AS first_qso,
      MAX(qso_datetime_utc) AS latest_qso
    FROM qsos WHERE ${whereSql}
  `).bind(filters.role, ...filters.bindings).first();

  return {
    callsign: filters.callsign,
    role: filters.role,
    page,
    limit,
    total: Number(totalRow?.total || 0),
    items: (result.results || []).map(rowToPublicItem),
    summary: {
      qsoCount: Number(summary?.qso_count || 0),
      contactCount: Number(summary?.contact_count || 0),
      qslSentCount: Number(summary?.qsl_sent_count || 0),
      qslReceivedCount: Number(summary?.qsl_received_count || 0),
      firstQso: summary?.first_qso || null,
      latestQso: summary?.latest_qso || null,
    },
    filters: { year: filters.year || null, mode: filters.mode || null, band: filters.band || null },
    source: 'd1',
    archiveCoverage: 'all-time',
  };
}

async function queryUpstream(url, operatorCallsign, env) {
  const page = parsePositiveInt(url.searchParams.get('page'), 1, 1, 100000);
  const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 1, 50);
  const role = url.searchParams.get('role') === 'contact' ? 'contact' : 'operator';
  const callsign = normalizeCallsign(url.searchParams.get('callsign') || operatorCallsign);
  if (!isValidCallsign(callsign)) throw new Error('呼号格式无效');

  const upstream = new URL('/public/qso', String(env.UPSTREAM_API_BASE || UPSTREAM_DEFAULT));
  upstream.searchParams.set('callsign', callsign);
  upstream.searchParams.set('role', role);
  upstream.searchParams.set('page', String(page));
  upstream.searchParams.set('limit', String(limit));

  const response = await fetch(upstream, { headers: { accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `上游接口返回 ${response.status}`);

  return {
    ...data,
    summary: {
      qsoCount: Number(data.total || 0),
      contactCount: null,
      qslSentCount: null,
      qslReceivedCount: null,
      firstQso: null,
      latestQso: data.items?.[0]?.qsoDatetime || null,
    },
    source: 'upstream_fallback',
    archiveCoverage: 'last-year-only',
    warning: 'D1 尚未绑定或尚无归档数据，当前临时显示上游 API 的近一年公开记录。',
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const operatorCallsign = normalizeCallsign(context.env.OPERATOR_CALLSIGN || 'BA4THG');

  try {
    if (context.env.DB) {
      const result = await queryD1(context.env.DB, url, operatorCallsign);
      if (result.total > 0 || url.searchParams.has('year') || url.searchParams.has('mode') || url.searchParams.has('band')) {
        return json(result, { headers: { 'cache-control': 'public, max-age=60, s-maxage=300' } });
      }
    }

    const fallback = await queryUpstream(url, operatorCallsign, context.env);
    return json(fallback, { headers: { 'cache-control': 'public, max-age=30, s-maxage=120' } });
  } catch (exception) {
    const message = exception instanceof Error ? exception.message : '查询失败';
    const status = message.includes('呼号') ? 400 : 502;
    return error(message, status);
  }
}
