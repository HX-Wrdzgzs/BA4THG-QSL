"use strict";

const UPSTREAM_API = 'https://api.mzyyun.com/public/qso';
const OPERATOR_CALLSIGN = 'BA4THG';

const tokenInput = document.querySelector('[data-token]');
const connectButton = document.querySelector('[data-connect]');
const connection = document.querySelector('[data-connection]');
const form = document.querySelector('[data-entry-form]');
const resetButton = document.querySelector('[data-reset-form]');
const submitLabel = document.querySelector('[data-submit-label]');
const operation = document.querySelector('[data-operation]');
const adminList = document.querySelector('[data-admin-list]');
const adminError = document.querySelector('[data-admin-error]');
const refreshButton = document.querySelector('[data-refresh]');
const importFile = document.querySelector('[data-import-file]');
const importButton = document.querySelector('[data-import]');
const importState = document.querySelector('[data-import-state]');
const syncButton = document.querySelector('[data-sync]');
const syncState = document.querySelector('[data-sync-state]');
const exportButtons = [...document.querySelectorAll('[data-export]')];

let records = [];

function getToken() {
  return tokenInput.value.trim();
}

function setState(node, message, type = '') {
  node.textContent = message;
  node.classList.toggle('is-success', type === 'success');
  node.classList.toggle('is-error', type === 'error');
}

async function api(path, init = {}) {
  const token = getToken();
  if (!token) throw new Error('请先输入管理令牌');
  const headers = new Headers(init.headers || {});
  headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...init, headers });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(data?.error || data || `请求失败：${response.status}`);
  return { response, data };
}

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function resetForm() {
  form.reset();
  form.elements.id.value = '';
  form.elements.myCallsign.value = OPERATOR_CALLSIGN;
  form.elements.mode.value = 'FM';
  form.elements.qsoDatetime.value = localDateTimeValue();
  form.elements.isPublic.checked = true;
  submitLabel.textContent = '保存记录';
  setState(operation, '');
}

function formPayload() {
  const data = new FormData(form);
  return {
    myCallsign: String(data.get('myCallsign') || '').trim().toUpperCase(),
    theirCallsign: String(data.get('theirCallsign') || '').trim().toUpperCase(),
    qsoDatetime: new Date(String(data.get('qsoDatetime'))).toISOString(),
    frequency: data.get('frequency') || null,
    mode: String(data.get('mode') || '').trim().toUpperCase(),
    myPower: data.get('myPower') || null,
    myEquipment: data.get('myEquipment') || null,
    myAntenna: data.get('myAntenna') || null,
    myQth: data.get('myQth') || null,
    theirQth: data.get('theirQth') || null,
    rstSent: data.get('rstSent') || null,
    rstReceived: data.get('rstReceived') || null,
    notes: data.get('notes') || null,
    qslSent: data.get('qslSent') === 'on',
    qslReceived: data.get('qslReceived') === 'on',
    isPublic: data.get('isPublic') === 'on',
  };
}

function displayTime(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

function createRecord(item) {
  const article = document.createElement('article');
  article.className = 'qso-record';
  const primary = document.createElement('div');
  primary.className = 'record-primary';
  const call = document.createElement('strong');
  call.textContent = item.theirCallsign;
  const time = document.createElement('time');
  time.textContent = displayTime(item.qsoDatetime);
  const meta = document.createElement('span');
  meta.textContent = `${item.frequency || '—'} MHz · ${item.mode || '—'} · ${item.myPower ? `${item.myPower} W` : '功率未填'}`;
  primary.append(call, time, meta);

  const details = document.createElement('dl');
  details.className = 'record-details';
  for (const [label, value] of [
    ['设备', item.myEquipment], ['天线', item.myAntenna], ['本台 QTH', item.myQth],
    ['对方 QTH', item.theirQth], ['RST', `${item.rstSent || '—'} / ${item.rstReceived || '—'}`], ['来源', item.source],
  ]) {
    const group = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value || '—';
    group.append(dt, dd);
    details.append(group);
  }

  const actions = document.createElement('div');
  actions.className = 'record-actions';
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.textContent = '编辑';
  edit.addEventListener('click', () => editRecord(item));
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'danger';
  remove.textContent = '移入回收站';
  remove.addEventListener('click', () => deleteRecord(item));
  actions.append(edit, remove);
  article.append(primary, details, actions);
  return article;
}

function editRecord(item) {
  form.elements.id.value = item.id;
  form.elements.myCallsign.value = item.myCallsign || OPERATOR_CALLSIGN;
  form.elements.theirCallsign.value = item.theirCallsign || '';
  form.elements.qsoDatetime.value = localDateTimeValue(new Date(item.qsoDatetime));
  form.elements.frequency.value = item.frequency || '';
  form.elements.mode.value = item.mode || 'FM';
  form.elements.myPower.value = item.myPower || '';
  form.elements.myEquipment.value = item.myEquipment || '';
  form.elements.myAntenna.value = item.myAntenna || '';
  form.elements.myQth.value = item.myQth || '';
  form.elements.theirQth.value = item.theirQth || '';
  form.elements.rstSent.value = item.rstSent || '';
  form.elements.rstReceived.value = item.rstReceived || '';
  form.elements.notes.value = item.notes || '';
  form.elements.qslSent.checked = Boolean(item.qslSent);
  form.elements.qslReceived.checked = Boolean(item.qslReceived);
  form.elements.isPublic.checked = item.isPublic !== false;
  submitLabel.textContent = '保存修改';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteRecord(item) {
  if (!window.confirm(`确认将 ${item.theirCallsign} 的这条通联移入回收站？`)) return;
  try {
    await api(`./api/admin/qsos/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    setState(operation, '记录已移入回收站。', 'success');
    await loadRecords();
  } catch (exception) {
    setState(operation, exception.message, 'error');
  }
}

async function loadRecords() {
  adminError.hidden = true;
  try {
    const { data } = await api('./api/admin/qsos?limit=50');
    records = data.items || [];
    const fragment = document.createDocumentFragment();
    for (const item of records) fragment.append(createRecord(item));
    adminList.replaceChildren(fragment);
    connection.textContent = `已连接 · ${data.total} 条记录`;
    connection.classList.add('is-connected');
    sessionStorage.setItem('ba4thg-admin-token', getToken());
  } catch (exception) {
    adminError.textContent = exception.message;
    adminError.hidden = false;
    connection.textContent = '连接失败';
    connection.classList.remove('is-connected');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitLabel.disabled = true;
  try {
    const id = form.elements.id.value;
    const payload = formPayload();
    await api(id ? `./api/admin/qsos/${encodeURIComponent(id)}` : './api/admin/qsos', {
      method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload),
    });
    setState(operation, id ? '修改已保存。' : '通联记录已保存。', 'success');
    resetForm();
    await loadRecords();
  } catch (exception) {
    setState(operation, exception.message, 'error');
  } finally {
    submitLabel.disabled = false;
  }
});

function parseAdif(text) {
  const recordsOut = [];
  const rawRecords = text.split(/<EOR\s*>/i);
  for (const raw of rawRecords) {
    const fields = {};
    const regex = /<([A-Z0-9_]+):(\d+)(?::[^>]*)?>([^<]*)/gi;
    let match;
    while ((match = regex.exec(raw)) !== null) fields[match[1].toUpperCase()] = match[3].slice(0, Number(match[2]));
    if (!fields.CALL || !fields.QSO_DATE) continue;
    const time = (fields.TIME_ON || '000000').padEnd(6, '0').slice(0, 6);
    const date = fields.QSO_DATE;
    const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`;
    recordsOut.push({
      sourceId: fields.APP_QSO_ID || fields.QSO_DATE + time + fields.CALL,
      myCallsign: fields.STATION_CALLSIGN || fields.OPERATOR || OPERATOR_CALLSIGN,
      theirCallsign: fields.CALL,
      qsoDatetime: iso,
      frequency: fields.FREQ || null,
      band: fields.BAND || null,
      mode: fields.MODE || fields.SUBMODE || 'UNKNOWN',
      rstSent: fields.RST_SENT || null,
      rstReceived: fields.RST_RCVD || null,
      myQth: fields.MY_QTH || null,
      theirQth: fields.QTH || null,
      myGrid: fields.MY_GRIDSQUARE || null,
      theirGrid: fields.GRIDSQUARE || null,
      myEquipment: fields.MY_RIG || null,
      myAntenna: fields.MY_ANTENNA || null,
      myPower: fields.TX_PWR || null,
      notes: fields.COMMENT || fields.NOTES || null,
      qslSent: fields.QSL_SENT === 'Y',
      qslReceived: fields.QSL_RCVD === 'Y',
      isPublic: true,
    });
  }
  return recordsOut;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field); field = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((value) => value.trim());
  return rows.slice(1).map((values, index) => {
    const item = { sourceId: `csv-${index + 1}` };
    headers.forEach((header, column) => { item[header] = values[column]?.trim() || null; });
    return item;
  });
}

async function parseImportFile(file) {
  const text = await file.text();
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.adi') || lower.endsWith('.adif')) return { source: 'adif_import', records: parseAdif(text) };
  if (lower.endsWith('.csv')) return { source: 'csv_import', records: parseCsv(text) };
  const parsed = JSON.parse(text);
  const recordsFromJson = Array.isArray(parsed) ? parsed : (parsed.qsos || parsed.records || []);
  return { source: 'json_import', records: recordsFromJson };
}

async function importRecords() {
  const file = importFile.files?.[0];
  if (!file) return setState(importState, '请选择导入文件。', 'error');
  importButton.disabled = true;
  try {
    const parsed = await parseImportFile(file);
    if (!parsed.records.length) throw new Error('文件中没有识别到通联记录');
    let inserted = 0, skipped = 0, rejected = 0;
    for (let start = 0; start < parsed.records.length; start += 100) {
      setState(importState, `正在导入 ${start + 1}–${Math.min(start + 100, parsed.records.length)} / ${parsed.records.length}…`);
      const chunk = parsed.records.slice(start, start + 100);
      const { data } = await api('./api/admin/import', {
        method: 'POST', body: JSON.stringify({ source: parsed.source, records: chunk }),
      });
      inserted += Number(data.inserted || 0);
      skipped += Number(data.skippedAsDuplicate || 0);
      rejected += Number(data.rejected?.length || 0);
    }
    setState(importState, `导入完成：新增 ${inserted}，重复跳过 ${skipped}，无效 ${rejected}。`, 'success');
    await loadRecords();
  } catch (exception) {
    setState(importState, exception.message, 'error');
  } finally {
    importButton.disabled = false;
  }
}

async function exportArchive(format) {
  try {
    const token = getToken();
    if (!token) throw new Error('请先输入管理令牌');
    const response = await fetch(`./api/admin/export?format=${encodeURIComponent(format)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `导出失败：${response.status}`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const name = disposition.match(/filename="([^"]+)"/)?.[1] || `ba4thg-qso.${format === 'adif' ? 'adi' : 'json'}`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (exception) {
    setState(operation, exception.message, 'error');
  }
}

async function fetchUpstreamPage(page) {
  const url = new URL(UPSTREAM_API);
  url.searchParams.set('callsign', OPERATOR_CALLSIGN);
  url.searchParams.set('role', 'operator');
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', '50');

  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    headers: { accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(`上游 API 拒绝当前 Origin：${location.origin}。请先在小程序“设置 → 网站接入”添加这个完整 Origin。`);
    }
    throw new Error(data.error || `上游 API 返回 ${response.status}`);
  }

  if (data.station && String(data.station).trim().toUpperCase() !== OPERATOR_CALLSIGN) {
    throw new Error(`当前网站绑定到台站 ${data.station}，不是 ${OPERATOR_CALLSIGN}`);
  }
  return data;
}

async function archiveUpstreamPage(data) {
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { fetched: 0, inserted: 0, updated: 0, linkedToExisting: 0, rejected: 0 };
  }
  const result = await api('./api/admin/import-upstream', {
    method: 'POST',
    body: JSON.stringify({ station: data.station || OPERATOR_CALLSIGN, items: data.items }),
  });
  return result.data;
}

async function syncFromUpstream() {
  if (!getToken()) throw new Error('请先输入管理令牌');

  const first = await fetchUpstreamPage(1);
  const total = Number(first.total || 0);
  const pageCount = Math.max(1, Math.ceil(total / 50));
  let fetched = 0;
  let inserted = 0;
  let updated = 0;
  let linked = 0;
  let rejected = 0;

  for (let page = 1; page <= pageCount; page += 1) {
    setState(syncState, `浏览器正在读取上游 ${page} / ${pageCount} 页；当前 Origin：${location.origin}`);
    const data = page === 1 ? first : await fetchUpstreamPage(page);
    const result = await archiveUpstreamPage(data);
    fetched += Number(result.fetched || 0);
    inserted += Number(result.inserted || 0);
    updated += Number(result.updated || 0);
    linked += Number(result.linkedToExisting || 0);
    rejected += Number(result.rejected || 0);
  }

  return { total, fetched, inserted, updated, linked, rejected };
}

connectButton.addEventListener('click', loadRecords);
refreshButton.addEventListener('click', loadRecords);
resetButton.addEventListener('click', resetForm);
importButton.addEventListener('click', importRecords);
syncButton.addEventListener('click', async () => {
  syncButton.disabled = true;
  try {
    setState(syncState, `准备通过当前网站 Origin（${location.origin}）读取近一年公开记录……`);
    const data = await syncFromUpstream();
    setState(
      syncState,
      `同步完成：上游共 ${data.total} 条，本次归档 ${data.fetched} 条；新增 ${data.inserted}，更新 ${data.updated}，关联已有 ${data.linked}，无效 ${data.rejected}。`,
      'success',
    );
    await loadRecords();
  } catch (exception) {
    setState(syncState, exception.message, 'error');
  } finally {
    syncButton.disabled = false;
  }
});
exportButtons.forEach((button) => button.addEventListener('click', () => exportArchive(button.dataset.export)));

tokenInput.value = sessionStorage.getItem('ba4thg-admin-token') || '';
resetForm();
if (tokenInput.value) loadRecords();
