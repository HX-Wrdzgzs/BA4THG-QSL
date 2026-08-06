import { isValidCallsign, normalizeCallsign } from './http.js';

export function normalizeMode(value) {
  const mode = String(value ?? '').trim().toUpperCase();
  return mode || 'UNKNOWN';
}

export function normalizeIsoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('通联时间无效');
  return date.toISOString();
}

export function parseFrequencyHz(input) {
  if (input === null || input === undefined || input === '') return null;
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0) throw new Error('频率无效');
  return Math.round(value < 1_000_000 ? value * 1_000_000 : value);
}

export function inferBand(frequencyHz) {
  if (!frequencyHz) return null;
  const mhz = frequencyHz / 1_000_000;
  const ranges = [
    [1.8, 2.0, '160m'], [3.5, 4.0, '80m'], [5.0, 5.5, '60m'],
    [7.0, 7.3, '40m'], [10.1, 10.15, '30m'], [14.0, 14.35, '20m'],
    [18.068, 18.168, '17m'], [21.0, 21.45, '15m'], [24.89, 24.99, '12m'],
    [28.0, 29.7, '10m'], [50.0, 54.0, '6m'], [144.0, 148.0, '2m'],
    [220.0, 225.0, '1.25m'], [420.0, 450.0, '70cm'], [1240.0, 1300.0, '23cm'],
  ];
  const match = ranges.find(([min, max]) => mhz >= min && mhz <= max);
  return match ? match[2] : null;
}

function nullableText(value, maxLength = 500) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, maxLength) : null;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('功率无效');
  return parsed;
}

function boolInt(value, fallback = 0) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

export function normalizeQsoInput(input, defaults = {}) {
  const myCallsign = normalizeCallsign(input.myCallsign ?? input.my_callsign ?? defaults.myCallsign ?? 'BA4THG');
  const theirCallsign = normalizeCallsign(input.theirCallsign ?? input.their_callsign);
  if (!isValidCallsign(myCallsign)) throw new Error('本台呼号格式无效');
  if (!isValidCallsign(theirCallsign)) throw new Error('对方呼号格式无效');

  const qsoDatetimeUtc = normalizeIsoDate(input.qsoDatetime ?? input.qsoDatetimeUtc ?? input.qso_datetime_utc);
  const frequencyHz = parseFrequencyHz(input.frequencyHz ?? input.frequency_hz ?? input.frequency ?? input.frequency_display);
  const frequencyDisplay = frequencyHz ? (frequencyHz / 1_000_000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : null;
  const mode = normalizeMode(input.mode);

  return {
    myCallsign,
    theirCallsign,
    qsoDatetimeUtc,
    frequencyHz,
    frequencyDisplay,
    band: nullableText(input.band, 16) ?? inferBand(frequencyHz),
    mode,
    rstSent: nullableText(input.rstSent ?? input.rst_sent, 16),
    rstReceived: nullableText(input.rstReceived ?? input.rst_received, 16),
    myQth: nullableText(input.myQth ?? input.my_qth, 160),
    theirQth: nullableText(input.theirQth ?? input.their_qth, 160),
    myGrid: nullableText(input.myGrid ?? input.my_grid ?? input.grid, 16),
    theirGrid: nullableText(input.theirGrid ?? input.their_grid, 16),
    myEquipment: nullableText(input.myEquipment ?? input.my_equipment, 200),
    theirEquipment: nullableText(input.theirEquipment ?? input.their_equipment, 200),
    myAntenna: nullableText(input.myAntenna ?? input.my_antenna, 200),
    theirAntenna: nullableText(input.theirAntenna ?? input.their_antenna, 200),
    myPowerW: nullableNumber(input.myPowerW ?? input.my_power_w ?? input.myPower),
    theirPowerW: nullableNumber(input.theirPowerW ?? input.their_power_w ?? input.theirPower),
    notes: nullableText(input.notes, 2000),
    weather: nullableText(input.weather, 120),
    theirWeather: nullableText(input.theirWeather ?? input.their_weather, 120),
    qslSent: boolInt(input.qslSent ?? input.qsl_sent),
    qslSentAt: (input.qslSentAt ?? input.qsl_sent_at) ? normalizeIsoDate(input.qslSentAt ?? input.qsl_sent_at) : null,
    qslReceived: boolInt(input.qslReceived ?? input.qsl_received),
    qslReceivedAt: (input.qslReceivedAt ?? input.qsl_received_at) ? normalizeIsoDate(input.qslReceivedAt ?? input.qsl_received_at) : null,
    isPublic: boolInt(input.isPublic ?? input.is_public, 1),
  };
}

export async function fingerprintQso(qso) {
  const canonical = [
    qso.myCallsign,
    qso.theirCallsign,
    qso.qsoDatetimeUtc,
    qso.frequencyHz ?? '',
    qso.mode,
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function rowToPublicItem(row) {
  return {
    id: row.id,
    myCallsign: row.my_callsign,
    theirCallsign: row.their_callsign,
    qsoDatetime: row.qso_datetime_utc,
    frequency: row.frequency_display,
    frequencyHz: row.frequency_hz,
    band: row.band,
    mode: row.mode,
    rstSent: row.rst_sent,
    rstReceived: row.rst_received,
    grid: row.my_grid,
    myGrid: row.my_grid,
    theirGrid: row.their_grid,
    myQth: row.my_qth,
    theirQth: row.their_qth,
    myEquipment: row.my_equipment,
    theirEquipment: row.their_equipment,
    myAntenna: row.my_antenna,
    theirAntenna: row.their_antenna,
    myPower: row.my_power_w === null ? null : String(row.my_power_w),
    theirPower: row.their_power_w === null ? null : String(row.their_power_w),
    notes: row.notes,
    weather: row.weather,
    theirWeather: row.their_weather,
    qslSent: Boolean(row.qsl_sent),
    qslSentAt: row.qsl_sent_at,
    qslReceived: Boolean(row.qsl_received),
    qslReceivedAt: row.qsl_received_at,
    source: row.managed_by,
    isPublic: Boolean(row.is_public),
  };
}

export function insertQsoStatement(db, id, qso, fingerprint, managedBy, now) {
  return db.prepare(`
    INSERT OR IGNORE INTO qsos (
      id, my_callsign, their_callsign, qso_datetime_utc,
      frequency_hz, frequency_display, band, mode,
      rst_sent, rst_received, my_qth, their_qth, my_grid, their_grid,
      my_equipment, their_equipment, my_antenna, their_antenna,
      my_power_w, their_power_w, notes, weather, their_weather,
      qsl_sent, qsl_sent_at, qsl_received, qsl_received_at,
      is_public, managed_by, fingerprint, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).bind(
    id, qso.myCallsign, qso.theirCallsign, qso.qsoDatetimeUtc,
    qso.frequencyHz, qso.frequencyDisplay, qso.band, qso.mode,
    qso.rstSent, qso.rstReceived, qso.myQth, qso.theirQth, qso.myGrid, qso.theirGrid,
    qso.myEquipment, qso.theirEquipment, qso.myAntenna, qso.theirAntenna,
    qso.myPowerW, qso.theirPowerW, qso.notes, qso.weather, qso.theirWeather,
    qso.qslSent, qso.qslSentAt, qso.qslReceived, qso.qslReceivedAt,
    qso.isPublic, managedBy, fingerprint, now, now,
  );
}

export function updateQsoStatement(db, id, qso, fingerprint, now) {
  return db.prepare(`
    UPDATE qsos SET
      my_callsign = ?, their_callsign = ?, qso_datetime_utc = ?,
      frequency_hz = ?, frequency_display = ?, band = ?, mode = ?,
      rst_sent = ?, rst_received = ?, my_qth = ?, their_qth = ?, my_grid = ?, their_grid = ?,
      my_equipment = ?, their_equipment = ?, my_antenna = ?, their_antenna = ?,
      my_power_w = ?, their_power_w = ?, notes = ?, weather = ?, their_weather = ?,
      qsl_sent = ?, qsl_sent_at = ?, qsl_received = ?, qsl_received_at = ?,
      is_public = ?, fingerprint = ?, updated_at = ?
    WHERE id = ? AND deleted_at IS NULL
  `).bind(
    qso.myCallsign, qso.theirCallsign, qso.qsoDatetimeUtc,
    qso.frequencyHz, qso.frequencyDisplay, qso.band, qso.mode,
    qso.rstSent, qso.rstReceived, qso.myQth, qso.theirQth, qso.myGrid, qso.theirGrid,
    qso.myEquipment, qso.theirEquipment, qso.myAntenna, qso.theirAntenna,
    qso.myPowerW, qso.theirPowerW, qso.notes, qso.weather, qso.theirWeather,
    qso.qslSent, qso.qslSentAt, qso.qslReceived, qso.qslReceivedAt,
    qso.isPublic, fingerprint, now, id,
  );
}
