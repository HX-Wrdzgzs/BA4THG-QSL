export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', headers.get('cache-control') || 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(message, status = 400, details = undefined) {
  return json({ error: message, ...(details === undefined ? {} : { details }) }, { status });
}

export function parsePositiveInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeCallsign(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidCallsign(value) {
  return /^[A-Z0-9/]{3,16}$/.test(value);
}

function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < max; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

export function authorize(request, env) {
  const expected = String(env.ADMIN_API_TOKEN ?? '');
  if (expected.length < 24) {
    return { ok: false, response: error('服务端尚未配置 ADMIN_API_TOKEN', 503) };
  }

  const header = request.headers.get('authorization') || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!supplied || !constantTimeEqual(supplied, expected)) {
    return { ok: false, response: error('未授权', 401) };
  }

  return { ok: true };
}

export async function readJson(request, maxBytes = 256_000) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new Error('请求体过大');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new Error('请求体过大');
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('JSON 格式无效');
  }
}
