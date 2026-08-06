import { authorize, error } from '../../_lib/http.js';

function adifValue(name, value, type = '') {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value);
  return `<${name}:${text.length}${type ? `:${type}` : ''}>${text}`;
}

function formatAdifDate(iso) {
  const date = new Date(iso);
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function formatAdifTime(iso) {
  const date = new Date(iso);
  return date.toISOString().slice(11, 19).replaceAll(':', '');
}

function rowToAdif(row) {
  const fields = [
    adifValue('CALL', row.their_callsign),
    adifValue('STATION_CALLSIGN', row.my_callsign),
    adifValue('QSO_DATE', formatAdifDate(row.qso_datetime_utc), 'D'),
    adifValue('TIME_ON', formatAdifTime(row.qso_datetime_utc), 'T'),
    adifValue('FREQ', row.frequency_display),
    adifValue('BAND', row.band),
    adifValue('MODE', row.mode),
    adifValue('RST_SENT', row.rst_sent),
    adifValue('RST_RCVD', row.rst_received),
    adifValue('MY_QTH', row.my_qth),
    adifValue('QTH', row.their_qth),
    adifValue('MY_GRIDSQUARE', row.my_grid),
    adifValue('GRIDSQUARE', row.their_grid),
    adifValue('MY_RIG', row.my_equipment),
    adifValue('MY_ANTENNA', row.my_antenna),
    adifValue('TX_PWR', row.my_power_w),
    adifValue('COMMENT', row.notes),
    adifValue('QSL_SENT', row.qsl_sent ? 'Y' : 'N'),
    adifValue('QSL_RCVD', row.qsl_received ? 'Y' : 'N'),
  ].filter(Boolean);
  return `${fields.join(' ')} <EOR>`;
}

export async function onRequestGet(context) {
  const auth = authorize(context.request, context.env);
  if (!auth.ok) return auth.response;
  if (!context.env.DB) return error('D1 数据库尚未绑定为 DB', 503);

  try {
    const url = new URL(context.request.url);
    const format = String(url.searchParams.get('format') || 'json').toLowerCase();
    const result = await context.env.DB.prepare('SELECT * FROM qsos WHERE deleted_at IS NULL ORDER BY qso_datetime_utc ASC').all();
    const rows = result.results || [];
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'adif' || format === 'adi') {
      const header = '<ADIF_VER:5>3.1.4 <PROGRAMID:18>BA4THG-QSO-ARCHIVE <EOH>';
      const body = rows.map(rowToAdif).join('\n');
      return new Response(`${header}\n${body}\n`, {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'content-disposition': `attachment; filename="ba4thg-qso-${stamp}.adi"`,
          'cache-control': 'no-store',
        },
      });
    }

    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, qsos: rows }, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="ba4thg-qso-${stamp}.json"`,
        'cache-control': 'no-store',
      },
    });
  } catch (exception) {
    return error(exception instanceof Error ? exception.message : '导出失败', 500);
  }
}
