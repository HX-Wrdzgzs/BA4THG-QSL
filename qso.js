"use strict";

const form = document.querySelector('[data-query-form]');
const list = document.querySelector('[data-qso-list]');
const loading = document.querySelector('[data-loading]');
const errorBox = document.querySelector('[data-error]');
const empty = document.querySelector('[data-empty]');
const pagination = document.querySelector('[data-pagination]');
const prevButton = document.querySelector('[data-prev]');
const nextButton = document.querySelector('[data-next]');
const pageLabel = document.querySelector('[data-page-label]');
const resultMeta = document.querySelector('[data-result-meta]');
const sourceBanner = document.querySelector('[data-source-banner]');
const summary = document.querySelector('[data-summary]');

const state = { page: 1, total: 0, limit: 20, loading: false };

function text(value, fallback = '—') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return text(iso);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

function addDetail(dl, label, value) {
  const wrapper = document.createElement('div');
  wrapper.append(element('dt', '', label), element('dd', '', text(value)));
  dl.append(wrapper);
}

function createRecord(item) {
  const article = element('article', 'qso-record');
  const primary = element('div', 'record-primary');
  primary.append(
    element('strong', '', text(item.theirCallsign)),
    element('time', '', formatTime(item.qsoDatetime)),
    element('span', '', `${text(item.frequency)} MHz · ${text(item.mode)} · ${text(item.band)}`),
  );

  const details = element('dl', 'record-details');
  addDetail(details, '设备', item.myEquipment);
  addDetail(details, '天线', item.myAntenna);
  addDetail(details, '功率', item.myPower ? `${item.myPower} W` : null);
  addDetail(details, '本台 QTH', item.myQth);
  addDetail(details, '对方 QTH', item.theirQth);
  addDetail(details, 'RST', item.rstSent || item.rstReceived ? `${text(item.rstSent)} / ${text(item.rstReceived)}` : null);

  const flags = element('div', 'record-flags');
  flags.append(element('span', `flag${item.qslSent ? ' is-positive' : ''}`, item.qslSent ? 'QSL 已寄' : 'QSL 未寄'));
  flags.append(element('span', `flag${item.qslReceived ? ' is-positive' : ''}`, item.qslReceived ? 'QSL 已收' : 'QSL 未收'));

  article.append(primary, details, flags);
  if (item.notes) article.append(element('p', 'record-note', item.notes));
  return article;
}

function currentParams() {
  const data = new FormData(form);
  return {
    callsign: String(data.get('callsign') || '').trim().toUpperCase(),
    role: String(data.get('role') || 'operator'),
    year: String(data.get('year') || '').trim(),
    mode: String(data.get('mode') || '').trim(),
    band: String(data.get('band') || '').trim(),
  };
}

function updateUrl(params) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries({ ...params, page: state.page })) {
    if (value) url.searchParams.set(key, String(value));
    else url.searchParams.delete(key);
  }
  history.replaceState(null, '', url);
}

function loadFormFromUrl() {
  const url = new URL(window.location.href);
  for (const name of ['callsign', 'role', 'year', 'mode', 'band']) {
    const value = url.searchParams.get(name);
    if (value !== null && form.elements[name]) form.elements[name].value = value;
  }
  state.page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
}

function renderSummary(data) {
  const values = data.summary || {};
  document.querySelector('[data-summary-qso]').textContent = text(values.qsoCount ?? data.total, '0');
  document.querySelector('[data-summary-contact]').textContent = text(values.contactCount);
  document.querySelector('[data-summary-sent]').textContent = text(values.qslSentCount);
  document.querySelector('[data-summary-received]').textContent = text(values.qslReceivedCount);
  summary.hidden = false;
}

function renderPagination() {
  const pageCount = Math.max(1, Math.ceil(state.total / state.limit));
  pageLabel.textContent = `第 ${state.page} / ${pageCount} 页`;
  prevButton.disabled = state.page <= 1 || state.loading;
  nextButton.disabled = state.page >= pageCount || state.loading;
  pagination.hidden = state.total <= state.limit;
}

async function fetchLogbook() {
  if (state.loading) return;
  state.loading = true;
  loading.hidden = false;
  errorBox.hidden = true;
  empty.hidden = true;
  sourceBanner.hidden = true;
  list.replaceChildren();
  renderPagination();

  const params = currentParams();
  updateUrl(params);
  const query = new URLSearchParams({
    callsign: params.callsign,
    role: params.role,
    page: String(state.page),
    limit: String(state.limit),
  });
  if (params.year) query.set('year', params.year);
  if (params.mode) query.set('mode', params.mode);
  if (params.band) query.set('band', params.band);

  try {
    const response = await fetch(`./api/public/qsos?${query}`, { headers: { accept: 'application/json' } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '查询失败');

    state.total = Number(data.total || 0);
    state.limit = Number(data.limit || state.limit);
    resultMeta.textContent = `共 ${state.total} 条公开记录 · ${params.role === 'operator' ? '本台呼号' : '对方呼号'} ${params.callsign}`;
    renderSummary(data);

    if (data.warning) {
      sourceBanner.textContent = data.warning;
      sourceBanner.hidden = false;
    }

    const fragment = document.createDocumentFragment();
    for (const item of data.items || []) fragment.append(createRecord(item));
    list.append(fragment);
    empty.hidden = state.total > 0;
  } catch (exception) {
    errorBox.textContent = exception instanceof Error ? exception.message : '查询失败';
    errorBox.hidden = false;
    resultMeta.textContent = '查询失败。';
    state.total = 0;
  } finally {
    state.loading = false;
    loading.hidden = true;
    renderPagination();
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  state.page = 1;
  fetchLogbook();
});

prevButton.addEventListener('click', () => {
  if (state.page <= 1) return;
  state.page -= 1;
  fetchLogbook();
  document.querySelector('.result-section').scrollIntoView({ behavior: 'smooth' });
});

nextButton.addEventListener('click', () => {
  if (state.page * state.limit >= state.total) return;
  state.page += 1;
  fetchLogbook();
  document.querySelector('.result-section').scrollIntoView({ behavior: 'smooth' });
});

loadFormFromUrl();
fetchLogbook();
