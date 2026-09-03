(() => {
  const APP_KEY = 'my-money-v2-state';
  const CONFIG_KEY = 'my-money-v2-config';
  const NAV = [
    ['home', '⌂', 'HOME'],
    ['flow', '↔', 'FLOW'],
    ['income', '＋', 'INCOME'],
    ['seed', '◎', 'SEED'],
    ['more', '•••', 'MORE']
  ];

  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const uid = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const clone = value => JSON.parse(JSON.stringify(value));
  const today = () => new Date().toISOString().slice(0, 10);
  const thisMonth = () => today().slice(0, 7);
  const monthOffset = (month, delta) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const monthRange = (start, count) => Array.from({ length: count }, (_, i) => monthOffset(start, i));
  const num = v => Number(v || 0);
  const safe = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

  const fmt = (value, cur = 'JPY') => {
    const n = num(value);
    if (cur === 'JPY') return `¥${Math.round(n).toLocaleString('ja-JP')}`;
    if (cur === 'KRW') return `₩${Math.round(n).toLocaleString('ko-KR')}`;
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const demoState = () => ({
    meta: { source: 'demo', syncedAt: null },
    settings: { startMonth: '2026-09' },
    flow: {
      '2026-09': {
        JPY: { start: 120000, main: 280000, side: 25000, otherIn: 0, card: 150000, fixed: 80000, otherOut: 20000, settlement: 120000, fxIn: 0, fxOut: 0, adjust: 0 },
        KRW: { start: 300000, main: 0, side: 800000, otherIn: 0, card: 0, fixed: 40000, otherOut: 0, settlement: 0, fxIn: 0, fxOut: 0, adjust: 0 },
        USD: { start: 25, main: 0, side: 60, otherIn: 0, card: 0, fixed: 0, otherOut: 0, settlement: 0, fxIn: 0, fxOut: 0, adjust: 0 }
      }
    },
    ledger: [],
    salaries: [
      {
        id: 'salary-demo-1', payMonth: '2026-09', workMonth: '2026-08', payDate: '2026-09-25', type: '급여', status: '예정', templateId: 'salary-default',
        items: [
          { kind: '지급', name: '기본급', amount: 330000, order: 1 },
          { kind: '지급', name: '교통비', amount: 13760, order: 2 },
          { kind: '공제', name: '건강보험', amount: 14000, order: 10 },
          { kind: '공제', name: '후생연금', amount: 26000, order: 11 },
          { kind: '공제', name: '고용보험', amount: 1800, order: 12 },
          { kind: '공제', name: '소득세', amount: 6200, order: 13 },
          { kind: '공제', name: '주민세', amount: 8000, order: 14 }
        ]
      }
    ],
    templates: [
      { id: 'salary-default', area: 'MAIN', name: '기본 급여', currency: 'JPY', type: '급여', items: [
        { kind: '지급', name: '기본급', amount: 330000, order: 1 },
        { kind: '지급', name: '교통비', amount: 13760, order: 2 },
        { kind: '공제', name: '건강보험', amount: 0, order: 10 },
        { kind: '공제', name: '후생연금', amount: 0, order: 11 },
        { kind: '공제', name: '고용보험', amount: 0, order: 12 },
        { kind: '공제', name: '소득세', amount: 0, order: 13 },
        { kind: '공제', name: '주민세', amount: 0, order: 14 }
      ] }
    ],
    projects: [
      { id: 'flitto-chart2code', name: 'Chart2Code', platform: 'Flitto', model: '복합', currency: 'KRW', unitPay: 3000, failPay: 1000, hourlyPay: 0, deductionRate: 0.033, active: true, note: '건당 + 세션시간' },
      { id: 'pointail', name: 'Pointail', platform: 'Pointail', model: '단발', currency: 'JPY', unitPay: 0, failPay: 0, hourlyPay: 0, deductionRate: 0.033, active: true, note: '자유 입력' },
      { id: 'oneforma', name: 'OneForma', platform: 'OneForma', model: '단발', currency: 'USD', unitPay: 0, failPay: 0, hourlyPay: 0, deductionRate: 0, active: true, note: '자유 입력' }
    ],
    sessions: [],
    payouts: [],
    fx: [
      { id: 'fx-demo-2026-09', month: '2026-09', krwPer100Jpy: 950, jpyPerUsd: 145, note: 'DEMO' }
    ],
    settlements: [
      { id: 'demo-settle', title: '샘플 정산', currency: 'JPY', current: 300000, planned: 100000, active: true }
    ],
    seed: {
      planStart: '2027-01', targetCurrency: 'KRW', longGoal: 20000000, annualGoal: 0,
      rows: monthRange('2026-09', 28).map(m => ({ month: m, target: 0, actual: 0, note: '' }))
    }
  });

  let state = loadLocal() || demoState();
  let config = loadConfig();
  let currentScreen = 'home';
  let incomeTab = 'main';
  let selectedMonth = state.settings?.startMonth || thisMonth();
  let syncBusy = false;

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(APP_KEY) || 'null'); } catch { return null; }
  }
  function saveLocal() {
    localStorage.setItem(APP_KEY, JSON.stringify(state));
  }
  function loadConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); } catch { return {}; }
  }
  function saveConfig() { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }

  const apiReady = () => Boolean(config.apiUrl && config.apiToken);
  async function api(action, payload = {}) {
    if (!apiReady()) throw new Error('API 연결이 설정되지 않았습니다.');
    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: config.apiToken, payload })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'API 오류');
    return json.data;
  }

  async function sync() {
    if (!apiReady() || syncBusy) {
      if (!apiReady()) toast('MORE에서 Google Sheets API를 연결하면 실제 데이터로 전환됩니다.');
      return;
    }
    syncBusy = true;
    renderHeader();
    try {
      const data = await api('bootstrap');
      state = normalizeBootstrap(data);
      state.meta = { source: 'google-sheets', syncedAt: new Date().toISOString() };
      saveLocal();
      selectedMonth = availableMonths().includes(selectedMonth) ? selectedMonth : (state.settings.startMonth || availableMonths()[0]);
      toast('Google Sheets와 동기화했습니다.');
    } catch (e) {
      toast(`동기화 실패: ${e.message}`);
    } finally {
      syncBusy = false;
      renderAll();
    }
  }

  function normalizeBootstrap(data) {
    const d = clone(data || {});
    d.settings ||= { startMonth: '2026-09' };
    d.flow ||= {};
    d.ledger ||= [];
    d.salaries ||= [];
    d.templates ||= [];
    d.projects ||= [];
    d.sessions ||= [];
    d.payouts ||= [];
    d.fx ||= [];
    d.settlements ||= [];
    d.seed ||= { planStart: '2027-01', targetCurrency: 'KRW', longGoal: 0, annualGoal: 0, rows: [] };
    d.seed.rows ||= [];
    return d;
  }

  function availableMonths() {
    const set = new Set([
      ...(Object.keys(state.flow || {})),
      ...(state.seed?.rows || []).map(r => r.month),
      state.settings?.startMonth,
      thisMonth()
    ].filter(Boolean));
    const sorted = [...set].sort();
    if (!sorted.length) return monthRange(thisMonth(), 12);
    const start = sorted[0];
    const end = sorted.at(-1);
    let arr = [], m = start, guard = 0;
    while (m <= end && guard++ < 120) { arr.push(m); m = monthOffset(m, 1); }
    return arr;
  }

  function fxFor(month = selectedMonth) {
    const list = [...(state.fx || [])].filter(r => r.month <= month).sort((a,b) => a.month.localeCompare(b.month));
    return list.at(-1) || { krwPer100Jpy: 0, jpyPerUsd: 0 };
  }
  function jpyEquivalent(value, currency, month = selectedMonth) {
    const r = fxFor(month);
    if (currency === 'JPY') return num(value);
    if (currency === 'KRW' && num(r.krwPer100Jpy)) return num(value) / num(r.krwPer100Jpy) * 100;
    if (currency === 'USD' && num(r.jpyPerUsd)) return num(value) * num(r.jpyPerUsd);
    return null;
  }
  function eqText(value, currency, month = selectedMonth) {
    if (currency === 'JPY') return '';
    const j = jpyEquivalent(value, currency, month);
    return j == null ? '환율 미등록' : `≈ ${fmt(j, 'JPY')} · 등록환율 기준`;
  }

  function flowRow(currency, month = selectedMonth) {
    const r = state.flow?.[month]?.[currency] || {};
    const start = num(r.start), main = num(r.main), side = num(r.side), otherIn = num(r.otherIn), card = num(r.card), fixed = num(r.fixed), otherOut = num(r.otherOut), settlement = num(r.settlement), fxIn = num(r.fxIn), fxOut = num(r.fxOut), adjust = num(r.adjust);
    return { start, main, side, otherIn, card, fixed, otherOut, settlement, fxIn, fxOut, adjust, end: start + main + side + otherIn - card - fixed - otherOut - settlement + fxIn - fxOut + adjust };
  }

  function salaryTotals(s) {
    const earn = (s.items || []).filter(i => i.kind === '지급').reduce((a,b) => a + num(b.amount), 0);
    const ded = (s.items || []).filter(i => i.kind === '공제').reduce((a,b) => a + num(b.amount), 0);
    return { earn, ded, net: earn - ded };
  }

  function sessionIncome(project, session) {
    const hours = num(session.minutes) / 60;
    const unitGross = num(session.pass) * num(project.unitPay) + num(session.fail) * num(project.failPay);
    const hourGross = project.model === '시급' ? hours * num(project.hourlyPay) : 0;
    const gross = project.model === '시급' ? hourGross : unitGross;
    const deduction = gross * num(project.deductionRate);
    return { gross, deduction, net: gross - deduction };
  }

  function workSummary(project, month = selectedMonth) {
    const sessions = (state.sessions || []).filter(s => s.projectId === project.id && String(s.date).startsWith(month));
    let mins = 0, gross = 0, net = 0, count = 0;
    sessions.forEach(s => {
      const x = sessionIncome(project, s); mins += num(s.minutes); gross += x.gross; net += x.net; count += num(s.pass) + num(s.fail) + num(s.hold) + num(s.excluded);
    });
    const payouts = (state.payouts || []).filter(p => p.projectId === project.id && String(p.workMonth || '').startsWith(month));
    const oneOff = payouts.reduce((a,b) => a + num(b.expected || b.actual), 0);
    if (!sessions.length) net += oneOff;
    return { sessions: sessions.length, mins, gross, net, count, hourly: mins ? net / (mins / 60) : 0 };
  }

  function navHtml() {
    return NAV.map(([id, icon, label]) => `<button class="nav-button ${currentScreen === id ? 'active' : ''}" data-go="${id}"><span>${icon}</span>${label}</button>`).join('');
  }
  function renderNav() {
    $('#mobileNav').innerHTML = navHtml();
    $('#desktopNav').innerHTML = navHtml();
  }
  function renderHeader() {
    const select = $('#monthSelect');
    const months = availableMonths();
    select.innerHTML = months.map(m => `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>${m}</option>`).join('');
    $('#syncButton').textContent = syncBusy ? '…' : (state.meta?.source === 'google-sheets' ? '✓' : '↻');
    $('#syncButton').title = state.meta?.source === 'google-sheets' ? 'Google Sheets 연결됨' : '로컬/데모 모드';
  }
  function renderAll() {
    renderHeader(); renderNav(); renderHome(); renderFlow(); renderIncome(); renderSeed(); renderMore(); bindCommon();
  }

  function currencyCard(currency, style = '') {
    const r = flowRow(currency);
    return `<article class="card ${style}">
      <div class="card-title"><div><p class="eyebrow">${currency}</p><h3>${currency === 'JPY' ? '일본 운용금' : currency === 'KRW' ? '한국 자금' : '달러 자금'}</h3></div><span class="tag">${selectedMonth}</span></div>
      <div class="amount">${fmt(r.end, currency)}</div>
      <div class="fx-note">${eqText(r.end, currency) || '기준통화'}</div>
      <div class="kpi-grid">
        <div class="kpi"><small>시작</small><strong>${fmt(r.start, currency)}</strong></div>
        <div class="kpi"><small>본업</small><strong>${fmt(r.main, currency)}</strong></div>
        <div class="kpi"><small>부업</small><strong>${fmt(r.side, currency)}</strong></div>
        <div class="kpi"><small>총 유출</small><strong>${fmt(r.card+r.fixed+r.otherOut+r.settlement+r.fxOut, currency)}</strong></div>
      </div>
    </article>`;
  }

  function renderHome() {
    const activeSettlement = (state.settlements || []).find(s => s.active);
    const projects = (state.projects || []).filter(p => p.active !== false);
    const side = projects.map(p => ({ p, s: workSummary(p) })).filter(x => x.s.net || x.s.sessions).sort((a,b) => b.s.net - a.s.net).slice(0,3);
    const seedActual = (state.seed?.rows || []).reduce((a,b) => a + num(b.actual), 0);
    const seedGoal = num(state.seed?.longGoal);
    $('#screen-home').innerHTML = `
      <p class="eyebrow">CONTROL BOARD</p><h1 class="page-title">지금 돈의 흐름</h1>
      <p class="page-copy">회계장부보다 먼저 보는 화면. 세 통화의 월말 FLOW와 지금 해야 할 액션만 크게 봅니다.</p>
      <div class="grid currency-grid">${currencyCard('JPY','dark')}${currencyCard('KRW','lime')}${currencyCard('USD','')}</div>
      <div class="section-head"><div><h2>이번 달 액션</h2><p>상세는 필요한 곳에서만 펼칩니다.</p></div></div>
      <div class="grid two-col">
        <article class="card">
          <div class="card-title"><h3>부업 생산성</h3><button class="btn ghost small" data-income-tab="side">SIDE 열기</button></div>
          ${side.length ? side.map(({p,s}) => `<div class="line"><span><strong>${safe(p.name)}</strong><br><span class="muted">${(s.mins/60).toFixed(1)}h · ${s.sessions} sessions</span></span><span><strong>${fmt(s.net,p.currency)}</strong><br><span class="fx-note">${eqText(s.net,p.currency)}</span></span></div>`).join('') : '<div class="empty">이 달의 부업 세션이 아직 없습니다.</div>'}
        </article>
        <article class="card">
          <div class="card-title"><h3>${activeSettlement ? '진행 중 정산' : 'SEED'}</h3>${activeSettlement ? '<span class="tag warn">ACTIVE</span>' : '<span class="tag live">BUILD</span>'}</div>
          ${activeSettlement ? `<div class="amount-sm">${fmt(activeSettlement.current, activeSettlement.currency)}</div><div class="muted">${safe(activeSettlement.title)}</div><div class="line"><span>이번 계획</span><strong>${fmt(activeSettlement.planned, activeSettlement.currency)}</strong></div>` : `<div class="amount-sm">${fmt(seedActual,state.seed.targetCurrency)}</div><div class="muted">장기목표 ${fmt(seedGoal,state.seed.targetCurrency)}</div><div class="progress"><i style="width:${seedGoal?Math.min(100,seedActual/seedGoal*100):0}%"></i></div>`}
        </article>
      </div>`;
  }

  function renderFlow() {
    const rows = ['JPY','KRW','USD'].map(cur => {
      const r = flowRow(cur);
      const items = [
        ['시작잔고', r.start], ['+ 본업', r.main], ['+ 부업', r.side], ['+ 기타수입', r.otherIn], ['- 카드청구', -r.card], ['- 계좌/현금 고정비', -r.fixed], ['- 기타직접지출', -r.otherOut], ['- 상환·지원금', -r.settlement], ['+ 환전유입', r.fxIn], ['- 환전유출', -r.fxOut], ['± 잔고보정', r.adjust]
      ];
      return `<article class="card"><div class="card-title"><div><p class="eyebrow">${cur} FLOW</p><h3>${selectedMonth}</h3></div><strong class="amount-sm">${fmt(r.end,cur)}</strong></div>${items.map(([n,v]) => `<div class="line"><span>${n}</span><strong>${v < 0 ? '−' + fmt(Math.abs(v),cur) : fmt(v,cur)}</strong></div>`).join('')}<div class="summary-box"><div class="line"><span>FLOW 예상잔고</span><strong>${fmt(r.end,cur)}</strong></div></div></article>`;
    }).join('');
    $('#screen-flow').innerHTML = `<p class="eyebrow">MONTHLY FLOW</p><h1 class="page-title">${selectedMonth}</h1><p class="page-copy">시작잔고 → 이 달의 증감 → 월말 예상. 환전은 소득이 아니라 통화 간 이동입니다.</p><div class="grid currency-grid">${rows}</div>`;
  }

  function renderIncome() {
    $('#screen-income').innerHTML = `<p class="eyebrow">INCOME</p><h1 class="page-title">돈 만드는 쪽</h1><div class="pill-tabs"><button class="pill ${incomeTab==='main'?'active':''}" data-income-tab="main">MAIN · 본업</button><button class="pill ${incomeTab==='side'?'active':''}" data-income-tab="side">SIDE · 부업</button></div><div id="incomeBody">${incomeTab === 'main' ? renderMainIncome() : renderSideIncome()}</div>`;
  }

  function renderMainIncome() {
    const salaries = [...(state.salaries || [])].sort((a,b) => String(b.payDate).localeCompare(String(a.payDate)));
    return `<div class="btn-row"><button class="btn" data-new-salary="blank">＋ 신규</button><button class="btn ghost" data-new-salary="copy">⧉ 전월 급여 복사</button><button class="btn ghost" data-new-salary="template">▣ 템플릿에서 만들기</button></div>
      <div class="section-head"><div><h2>급여 · 상여 이력</h2><p>새로 만들거나 이전 내용을 복사해서 필요한 숫자만 탭탭 수정.</p></div></div>
      <div class="list">${salaries.length ? salaries.map(salaryCard).join('') : '<div class="empty">본업 명세가 없습니다.</div>'}</div>`;
  }

  function salaryCard(s) {
    const t = salaryTotals(s);
    const earnings = (s.items||[]).filter(i => i.kind === '지급').sort((a,b)=>num(a.order)-num(b.order));
    const deductions = (s.items||[]).filter(i => i.kind === '공제').sort((a,b)=>num(a.order)-num(b.order));
    return `<details class="list-item" data-salary-id="${safe(s.id)}"><summary class="list-main"><div><h3>${safe(s.type)} · ${safe(s.workMonth || '')}</h3><p>${safe(s.payDate || '')} 지급 · ${safe(s.status || '')}</p></div><div style="text-align:right"><strong>${fmt(t.net,'JPY')}</strong><div class="tag">NET</div></div></summary>
      <div class="details">
        <div class="field-grid three"><div class="field"><label>유형</label><select class="select" data-salary-field="type"><option ${s.type==='급여'?'selected':''}>급여</option><option ${s.type==='상여'?'selected':''}>상여</option><option ${s.type==='기타 본업수입'?'selected':''}>기타 본업수입</option></select></div><div class="field"><label>작업월</label><input class="input" type="month" value="${safe(s.workMonth)}" data-salary-field="workMonth"></div><div class="field"><label>지급일</label><input class="input" type="date" value="${safe(s.payDate)}" data-salary-field="payDate"></div></div>
        ${salaryItemEditor(s,'지급',earnings)}
        ${salaryItemEditor(s,'공제',deductions)}
        <div class="summary-box"><div class="line"><span>총 지급</span><strong>${fmt(t.earn,'JPY')}</strong></div><div class="line"><span>공제</span><strong>${fmt(t.ded,'JPY')}</strong></div><div class="line"><span>실수령</span><strong>${fmt(t.net,'JPY')}</strong></div></div>
        <div class="btn-row" style="margin-top:10px"><button class="btn lime" data-save-salary="${safe(s.id)}">저장</button><button class="btn ghost" data-copy-salary="${safe(s.id)}">이 명세 복사</button><button class="btn danger" data-delete-salary="${safe(s.id)}">삭제</button></div>
      </div></details>`;
  }
  function salaryItemEditor(s, kind, items) {
    return `<div class="section-head"><div><h2>${kind} 항목</h2></div><button class="btn ghost small" data-add-salary-item="${safe(s.id)}" data-kind="${kind}">＋ 항목</button></div><div class="editor-grid">${items.map(i => `<div class="editor-row" data-item-order="${i.order}" data-kind="${kind}"><input class="input" value="${safe(i.name)}" data-item-name><input class="input num" type="number" inputmode="numeric" value="${num(i.amount)}" data-item-amount><button class="delete-x" data-remove-salary-item="${safe(s.id)}" data-order="${i.order}" data-kind="${kind}">×</button></div>`).join('')}</div>`;
  }

  function renderSideIncome() {
    const projects = (state.projects || []).filter(p => p.active !== false);
    return `<div class="btn-row"><button class="btn" data-new-project>＋ 부업 추가</button><button class="btn ghost" data-oneoff>＋ 단발수입</button><button class="btn ghost" data-payout>＋ 입금 기록</button></div>
      <div class="section-head"><div><h2>${selectedMonth} 작업 분석</h2><p>WORK(일한 달)와 PAYOUT(돈 들어오는 달)은 분리합니다.</p></div></div>
      <div class="list">${projects.length ? projects.map(projectCard).join('') : '<div class="empty">부업 프로젝트가 없습니다.</div>'}</div>`;
  }

  function projectCard(p) {
    const s = workSummary(p);
    const sessions = (state.sessions||[]).filter(x => x.projectId === p.id && String(x.date).startsWith(selectedMonth)).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5);
    return `<details class="list-item" data-project-id="${safe(p.id)}"><summary class="list-main"><div><h3>${safe(p.name)}</h3><p>${safe(p.platform)} · ${safe(p.model)} · ${safe(p.currency)}</p></div><div style="text-align:right"><strong>${fmt(s.net,p.currency)}</strong><div class="fx-note">${eqText(s.net,p.currency)}</div></div></summary>
      <div class="project-metrics"><div class="project-metric"><small>작업시간</small><strong>${(s.mins/60).toFixed(1)}h</strong></div><div class="project-metric"><small>세션 / 건수</small><strong>${s.sessions} / ${s.count}</strong></div><div class="project-metric"><small>실효시급</small><strong>${fmt(s.hourly,p.currency)}</strong></div></div>
      <div class="session-box">${sessionForm(p)}</div>
      <div class="section-head"><div><h2>최근 세션</h2></div><button class="btn ghost small" data-edit-project="${safe(p.id)}">프로젝트 설정</button></div>
      ${sessions.length ? sessions.map(x => { const q=sessionIncome(p,x); return `<div class="line"><span>${safe(x.date)} · ${minutesText(x.minutes)}<br><span class="muted">P ${num(x.pass)} / F ${num(x.fail)} / Hold ${num(x.hold)}</span></span><span><strong>${fmt(q.net,p.currency)}</strong><br><span class="fx-note">${eqText(q.net,p.currency,x.date.slice(0,7))}</span></span></div>` }).join('') : '<div class="empty">아직 세션이 없습니다.</div>'}
    </details>`;
  }

  function sessionForm(p) {
    const resultFields = p.model === '시급' ? '' : `<div class="field"><label>PASS</label><input class="input num" type="number" min="0" value="0" data-session-pass></div><div class="field"><label>FAIL</label><input class="input num" type="number" min="0" value="0" data-session-fail></div><div class="field"><label>HOLD</label><input class="input num" type="number" min="0" value="0" data-session-hold></div>`;
    return `<div class="field-grid three"><div class="field"><label>날짜</label><input class="input" type="date" value="${today()}" data-session-date></div><div class="field"><label>시작 · 10분 단위</label><input class="input" type="time" step="600" value="10:10" data-session-start></div><div class="field"><label>종료 · 10분 단위</label><input class="input" type="time" step="600" value="11:40" data-session-end></div>${resultFields}</div><div class="session-total"><span>${p.model === '시급' ? `시급 ${fmt(p.hourlyPay,p.currency)}` : `PASS ${fmt(p.unitPay,p.currency)} · FAIL ${fmt(p.failPay,p.currency)}`}</span><span>공제 ${(num(p.deductionRate)*100).toFixed(1)}%</span></div><button class="btn lime block" style="margin-top:10px" data-save-session="${safe(p.id)}">세션 저장</button>`;
  }

  function renderSeed() {
    const s = state.seed || { planStart:'2027-01',targetCurrency:'KRW',longGoal:0,annualGoal:0,rows:[] };
    const rows = s.rows || [];
    const cumulativeActual = rows.reduce((a,b)=>a+num(b.actual),0);
    const cumulativeTarget = rows.reduce((a,b)=>a+num(b.target),0);
    const actualStart = rows.find(r => num(r.actual) > 0)?.month || '';
    const year = selectedMonth.slice(0,4);
    const yearRows = rows.filter(r => r.month.startsWith(year));
    const yearActual = yearRows.reduce((a,b)=>a+num(b.actual),0);
    const yearTarget = yearRows.reduce((a,b)=>a+num(b.target),0);
    $('#screen-seed').innerHTML = `<p class="eyebrow">SEED BUILDING</p><h1 class="page-title">씨드 만들기</h1><p class="page-copy">투자 화면이 아니라 투자할 수 있는 원금을 만드는 계획. 시작월은 언제든 앞당기거나 늦출 수 있습니다.</p>
      <div class="seed-hero"><article class="card dark"><p class="eyebrow">LONG TERM SEED</p><div class="amount">${fmt(cumulativeActual,s.targetCurrency)}</div><div class="muted">목표 ${fmt(s.longGoal,s.targetCurrency)} · 실제 시작 ${actualStart || '아직 없음'}</div><div class="progress" style="margin-top:14px"><i style="width:${num(s.longGoal)?Math.min(100,cumulativeActual/num(s.longGoal)*100):0}%"></i></div><div class="kpi-grid"><div class="kpi"><small>누적 목표</small><strong>${fmt(cumulativeTarget,s.targetCurrency)}</strong></div><div class="kpi"><small>${year} 실제</small><strong>${fmt(yearActual,s.targetCurrency)}</strong></div></div></article>
      <article class="card"><div class="field-grid"><div class="field"><label>계획 시작월</label><input id="seedPlanStart" class="input" type="month" value="${safe(s.planStart)}"></div><div class="field"><label>목표통화</label><select id="seedCurrency" class="select"><option ${s.targetCurrency==='KRW'?'selected':''}>KRW</option><option ${s.targetCurrency==='JPY'?'selected':''}>JPY</option><option ${s.targetCurrency==='USD'?'selected':''}>USD</option></select></div></div><div class="field" style="margin-top:8px"><label>장기 목표</label><input id="seedLongGoal" class="input num" type="number" value="${num(s.longGoal)}"></div><div class="line"><span>${year} 월목표 합계</span><strong>${fmt(yearTarget,s.targetCurrency)}</strong></div><button class="btn lime block" data-save-seed-config>설정 저장</button></article></div>
      <div class="section-head"><div><h2>${year} 월 목표 / 실제</h2><p>시작 전 달은 실패가 아니라 비활성 상태로 둡니다.</p></div></div><div class="seed-months">${yearRows.map(seedMonthCard).join('')}</div>
      <article class="card chart-card"><div class="card-title"><h3>누적 목표 vs 실제</h3><span class="tag">${year}</span></div><canvas id="seedChart" width="1000" height="260"></canvas></article>`;
    requestAnimationFrame(drawSeedChart);
  }

  function seedMonthCard(r) {
    const active = r.month >= (state.seed.planStart || '0000-00') || num(r.actual) > 0;
    return `<article class="seed-month ${active?'':'inactive'}" data-seed-month="${r.month}"><div class="month-name">${r.month}</div><div class="field" style="margin-top:8px"><label>목표</label><input class="input num" type="number" value="${num(r.target)}" data-seed-target></div><div class="field" style="margin-top:6px"><label>실제</label><input class="input num" type="number" value="${num(r.actual)}" data-seed-actual></div><button class="btn ghost small block" style="margin-top:7px" data-save-seed-month="${r.month}">저장</button></article>`;
  }

  function drawSeedChart() {
    const canvas = $('#seedChart'); if (!canvas) return;
    const year = selectedMonth.slice(0,4);
    const rows = (state.seed.rows||[]).filter(r=>r.month.startsWith(year));
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 600, cssH = 230;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr; ctx.scale(dpr,dpr);
    ctx.clearRect(0,0,cssW,cssH);
    let t=0,a=0; const T=[],A=[]; rows.forEach(r=>{t+=num(r.target);a+=num(r.actual);T.push(t);A.push(a)});
    const max=Math.max(...T,...A,1), pad={l:8,r:8,t:14,b:24};
    ctx.strokeStyle='#dfe5e9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,cssH-pad.b);ctx.lineTo(cssW-pad.r,cssH-pad.b);ctx.stroke();
    const line=(arr,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();arr.forEach((v,i)=>{const x=pad.l+(rows.length<=1?0:i*(cssW-pad.l-pad.r)/(rows.length-1)), y=cssH-pad.b-(v/max)*(cssH-pad.t-pad.b);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()};
    line(T,'#9ba7b2',3);line(A,'#121c27',4);
    ctx.fillStyle='#7d8995';ctx.font='10px -apple-system';rows.forEach((r,i)=>{if(i%2===0){const x=pad.l+(rows.length<=1?0:i*(cssW-pad.l-pad.r)/(rows.length-1));ctx.fillText(r.month.slice(5),x-5,cssH-6)}});
  }

  function renderMore() {
    const fx = fxFor(selectedMonth);
    const source = state.meta?.source || 'local';
    $('#screen-more').innerHTML = `<p class="eyebrow">MORE</p><h1 class="page-title">설정 · 환율 · 정산</h1>
      <div class="grid two-col"><article class="card"><div class="card-title"><h3>Google Sheets 연결</h3><span class="tag ${source==='google-sheets'?'live':''}"><i class="status-dot ${source==='google-sheets'?'ok':''}"></i>&nbsp;${source==='google-sheets'?'LIVE':'LOCAL'}</span></div><p class="page-copy">공개 GitHub 코드에는 잔고나 API 비밀값을 넣지 않습니다. Apps Script URL과 개인 토큰은 이 기기에만 저장합니다.</p><div class="field"><label>Apps Script Web App URL</label><input id="apiUrl" class="input" type="url" value="${safe(config.apiUrl||'')}" placeholder="https://script.google.com/macros/s/.../exec"></div><div class="field" style="margin-top:8px"><label>개인 API 토큰</label><input id="apiToken" class="input" type="password" value="${safe(config.apiToken||'')}" placeholder="이 기기에만 저장"></div><div class="btn-row" style="margin-top:10px"><button class="btn lime" data-save-api>연결 저장 & 동기화</button><button class="btn ghost" data-reset-local>로컬 데모 초기화</button></div></article>
      <article class="card"><div class="card-title"><h3>환율 등록</h3><span class="tag">${selectedMonth}</span></div><p class="page-copy">환산표시용 환율입니다. 실제 환전은 FLOW의 환전유입/유출로 따로 기록합니다.</p><div class="field-grid"><div class="field"><label>¥100 = ₩</label><input id="fxKrw" class="input num" type="number" step="0.01" value="${num(fx.krwPer100Jpy)||''}"></div><div class="field"><label>$1 = ¥</label><input id="fxUsd" class="input num" type="number" step="0.01" value="${num(fx.jpyPerUsd)||''}"></div></div><button class="btn lime block" style="margin-top:10px" data-save-fx>이 달 환율 저장</button></article></div>
      <div class="section-head"><div><h2>정산</h2><p>청산되면 메인에서 자연스럽게 사라지는 프로젝트형 항목.</p></div></div><div class="list">${(state.settlements||[]).length ? state.settlements.map(x=>`<article class="list-item"><div class="list-main"><div><h3>${safe(x.title)}</h3><p>${x.active?'진행 중':'완료'}</p></div><strong>${fmt(x.current,x.currency)}</strong></div><div class="line"><span>이번 계획</span><strong>${fmt(x.planned,x.currency)}</strong></div></article>`).join('') : '<div class="empty">활성 정산이 없습니다.</div>'}</div>`;
  }

  function bindCommon() {
    $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    $$('[data-income-tab]').forEach(b => b.onclick = () => { incomeTab = b.dataset.incomeTab; go('income'); });
    $('#monthSelect').onchange = e => { selectedMonth = e.target.value; renderAll(); };
    $('#syncButton').onclick = sync;
    $('#quickButton').onclick = openQuick;
    $('#sheetBackdrop').onclick = closeSheet;

    $$('[data-new-salary]').forEach(b => b.onclick = () => createSalary(b.dataset.newSalary));
    $$('[data-save-salary]').forEach(b => b.onclick = () => saveSalaryFromCard(b.dataset.saveSalary));
    $$('[data-copy-salary]').forEach(b => b.onclick = () => copySalary(b.dataset.copySalary));
    $$('[data-delete-salary]').forEach(b => b.onclick = () => deleteSalary(b.dataset.deleteSalary));
    $$('[data-add-salary-item]').forEach(b => b.onclick = () => addSalaryItem(b.dataset.addSalaryItem, b.dataset.kind));
    $$('[data-remove-salary-item]').forEach(b => b.onclick = () => removeSalaryItem(b.dataset.removeSalaryItem, b.dataset.kind, b.dataset.order));

    $('[data-new-project]')?.addEventListener('click', () => openProjectForm());
    $('[data-oneoff]')?.addEventListener('click', openOneOffForm);
    $('[data-payout]')?.addEventListener('click', openPayoutForm);
    $$('[data-edit-project]').forEach(b => b.onclick = () => openProjectForm(b.dataset.editProject));
    $$('[data-save-session]').forEach(b => b.onclick = () => saveSessionFromCard(b));

    $('[data-save-seed-config]')?.addEventListener('click', saveSeedConfig);
    $$('[data-save-seed-month]').forEach(b => b.onclick = () => saveSeedMonth(b.dataset.saveSeedMonth));
    $('[data-save-api]')?.addEventListener('click', saveApiConfig);
    $('[data-reset-local]')?.addEventListener('click', resetLocalDemo);
    $('[data-save-fx]')?.addEventListener('click', saveFx);
  }

  function go(screen) {
    currentScreen = screen;
    $$('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === screen));
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function createSalary(mode) {
    let record;
    if (mode === 'copy') {
      const prevMonth = monthOffset(selectedMonth,-1);
      const src = [...(state.salaries||[])].filter(s => s.payMonth === prevMonth || s.workMonth === monthOffset(selectedMonth,-1)).sort((a,b)=>String(b.payDate).localeCompare(String(a.payDate)))[0] || state.salaries?.[0];
      if (!src) return toast('복사할 이전 급여가 없습니다.');
      record = clone(src); record.id = uid('salary'); record.payMonth = selectedMonth; record.workMonth = monthOffset(selectedMonth,-1); record.payDate = `${selectedMonth}-25`; record.status = '예정';
    } else if (mode === 'template') {
      const tpl = (state.templates||[]).find(t => t.area === 'MAIN' && t.type === '급여') || demoState().templates[0];
      record = { id: uid('salary'), payMonth:selectedMonth, workMonth:monthOffset(selectedMonth,-1), payDate:`${selectedMonth}-25`, type:tpl.type||'급여', status:'예정', templateId:tpl.id, items:clone(tpl.items||[]) };
    } else {
      record = { id: uid('salary'), payMonth:selectedMonth, workMonth:monthOffset(selectedMonth,-1), payDate:`${selectedMonth}-25`, type:'급여', status:'예정', templateId:'', items:[{kind:'지급',name:'기본급',amount:0,order:1}] };
    }
    state.salaries ||= []; state.salaries.unshift(record); saveLocal(); renderAll(); incomeTab='main';
    toast(mode==='copy'?'전월 명세를 복사했습니다.':'새 명세를 만들었습니다.');
  }

  function collectSalaryCard(id) {
    const card = $(`[data-salary-id="${CSS.escape(id)}"]`); const salary = state.salaries.find(s=>s.id===id); if(!card||!salary) return salary;
    $$('[data-salary-field]',card).forEach(el => salary[el.dataset.salaryField]=el.value);
    salary.payMonth = String(salary.payDate||'').slice(0,7) || selectedMonth;
    const items=[];
    $$('.editor-row',card).forEach(row=>items.push({kind:row.dataset.kind,name:$('[data-item-name]',row).value,amount:num($('[data-item-amount]',row).value),order:num(row.dataset.itemOrder)}));
    salary.items=items; return salary;
  }

  async function saveSalaryFromCard(id) {
    const salary = collectSalaryCard(id); if(!salary) return;
    saveLocal();
    if(apiReady()) { try { await api('saveSalary',{salary}); await sync(); return; } catch(e){ return toast(`저장 실패: ${e.message}`); } }
    renderAll(); toast('로컬에 저장했습니다. API 연결 후 Sheets에 저장됩니다.');
  }
  function copySalary(id) { const src=collectSalaryCard(id); const c=clone(src); c.id=uid('salary'); c.payMonth=monthOffset(src.payMonth||selectedMonth,1); c.workMonth=src.payMonth||selectedMonth; c.payDate=`${c.payMonth}-25`; c.status='예정'; state.salaries.unshift(c); saveLocal(); renderAll(); toast('명세를 다음 달용으로 복사했습니다.'); }
  async function deleteSalary(id) { if(!confirm('이 명세를 삭제할까요?'))return; state.salaries=state.salaries.filter(s=>s.id!==id); saveLocal(); if(apiReady()){try{await api('deleteSalary',{id});await sync();return}catch(e){toast(e.message)}}renderAll(); }
  function addSalaryItem(id,kind){ const s=state.salaries.find(x=>x.id===id); if(!s)return; const max=Math.max(0,...s.items.filter(i=>i.kind===kind).map(i=>num(i.order))); s.items.push({kind,name:'새 항목',amount:0,order:max+1}); saveLocal(); renderAll(); }
  function removeSalaryItem(id,kind,order){ const s=state.salaries.find(x=>x.id===id); if(!s)return; s.items=s.items.filter(i=>!(i.kind===kind&&num(i.order)===num(order))); saveLocal(); renderAll(); }

  function timeMinutes(start,end){ const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number); let d=(eh*60+em)-(sh*60+sm); if(d<0)d+=1440; return d; }
  const minutesText = m => `${Math.floor(num(m)/60)}h ${num(m)%60}m`;

  async function saveSessionFromCard(button) {
    const project=state.projects.find(p=>p.id===button.dataset.saveSession); const root=button.closest('[data-project-id]'); if(!project||!root)return;
    const date=$('[data-session-date]',root).value,start=$('[data-session-start]',root).value,end=$('[data-session-end]',root).value;
    const session={id:uid('session'),date,projectId:project.id,start,end,minutes:timeMinutes(start,end),pass:num($('[data-session-pass]',root)?.value),fail:num($('[data-session-fail]',root)?.value),hold:num($('[data-session-hold]',root)?.value),excluded:0,note:''};
    state.sessions ||= []; state.sessions.push(session); saveLocal();
    const q=sessionIncome(project,session);
    if(apiReady()){try{await api('appendSideSession',{session});await sync();toast(`${minutesText(session.minutes)} · ${fmt(q.net,project.currency)}`);return}catch(e){return toast(`세션 저장 실패: ${e.message}`)}}
    renderAll();toast(`${minutesText(session.minutes)} · 예상 ${fmt(q.net,project.currency)} 저장`);
  }

  function openProjectForm(id='') {
    const p=id?state.projects.find(x=>x.id===id):{id:uid('project'),name:'',platform:'',model:'단발',currency:'JPY',unitPay:0,failPay:0,hourlyPay:0,deductionRate:0,active:true,note:''};
    openSheet(`<h2 class="sheet-title">${id?'부업 설정':'부업 추가'}</h2><p class="sheet-copy">건당·시급·단발·복합 모두 같은 프로젝트 구조로 관리합니다.</p><div class="field-grid"><div class="field"><label>부업명</label><input id="pName" class="input" value="${safe(p.name)}"></div><div class="field"><label>플랫폼</label><input id="pPlatform" class="input" value="${safe(p.platform)}"></div></div><div class="field-grid" style="margin-top:8px"><div class="field"><label>수익모델</label><select id="pModel" class="select"><option ${p.model==='건당'?'selected':''}>건당</option><option ${p.model==='시급'?'selected':''}>시급</option><option ${p.model==='단발'?'selected':''}>단발</option><option ${p.model==='복합'?'selected':''}>복합</option></select></div><div class="field"><label>통화</label><select id="pCurrency" class="select"><option ${p.currency==='JPY'?'selected':''}>JPY</option><option ${p.currency==='KRW'?'selected':''}>KRW</option><option ${p.currency==='USD'?'selected':''}>USD</option></select></div></div><div class="field-grid three" style="margin-top:8px"><div class="field"><label>PASS/기본 건당</label><input id="pUnit" class="input num" type="number" value="${num(p.unitPay)}"></div><div class="field"><label>FAIL 건당</label><input id="pFail" class="input num" type="number" value="${num(p.failPay)}"></div><div class="field"><label>시급</label><input id="pHourly" class="input num" type="number" value="${num(p.hourlyPay)}"></div></div><div class="field" style="margin-top:8px"><label>공제율 (예: 0.033)</label><input id="pDed" class="input" type="number" step="0.001" value="${num(p.deductionRate)}"></div><div class="sheet-actions"><button id="saveProject" class="btn lime block">저장</button></div>`);
    $('#saveProject').onclick=async()=>{const next={...p,name:$('#pName').value.trim(),platform:$('#pPlatform').value.trim(),model:$('#pModel').value,currency:$('#pCurrency').value,unitPay:num($('#pUnit').value),failPay:num($('#pFail').value),hourlyPay:num($('#pHourly').value),deductionRate:num($('#pDed').value)}; if(!next.name)return toast('부업명을 입력하세요.'); const i=state.projects.findIndex(x=>x.id===next.id);i>=0?state.projects[i]=next:state.projects.push(next);saveLocal();closeSheet();if(apiReady()){try{await api('upsertProject',{project:next});await sync();return}catch(e){return toast(e.message)}}renderAll();};
  }

  function openOneOffForm() {
    const projects=(state.projects||[]).filter(p=>p.active!==false);
    openSheet(`<h2 class="sheet-title">단발수입</h2><p class="sheet-copy">프로젝트를 새로 만들 필요 없이 이름·상세·금액만 넣을 수도 있습니다.</p><div class="field"><label>연결 프로젝트</label><select id="oProject" class="select"><option value="">직접 입력 / 기타</option>${projects.map(p=>`<option value="${safe(p.id)}">${safe(p.name)} · ${p.currency}</option>`).join('')}</select></div><div class="field-grid" style="margin-top:8px"><div class="field"><label>이름</label><input id="oName" class="input" placeholder="예: 구매대행 도움"></div><div class="field"><label>통화</label><select id="oCurrency" class="select"><option>JPY</option><option>KRW</option><option>USD</option></select></div></div><div class="field-grid" style="margin-top:8px"><div class="field"><label>금액</label><input id="oAmount" class="input num" type="number" inputmode="decimal"></div><div class="field"><label>입금예정일</label><input id="oDate" class="input" type="date" value="${today()}"></div></div><div class="field" style="margin-top:8px"><label>상세</label><textarea id="oMemo" class="textarea" rows="3"></textarea></div><div class="sheet-actions"><button id="saveOneOff" class="btn lime block">추가</button></div>`);
    $('#oProject').onchange=e=>{const p=state.projects.find(x=>x.id===e.target.value);if(p)$('#oCurrency').value=p.currency;};
    $('#saveOneOff').onclick=async()=>{const projectId=$('#oProject').value||'',p=state.projects.find(x=>x.id===projectId),row={id:uid('payout'),projectId,projectName:p?.name||$('#oName').value.trim()||'단발수입',workMonth:selectedMonth,payMonth:$('#oDate').value.slice(0,7),payDate:$('#oDate').value,currency:$('#oCurrency').value,expected:num($('#oAmount').value),actual:0,status:'예정',memo:$('#oMemo').value};state.payouts.push(row);saveLocal();closeSheet();if(apiReady()){try{await api('appendPayout',{payout:row,mirrorLedger:true});await sync();return}catch(e){return toast(e.message)}}renderAll();};
  }

  function openPayoutForm() {
    const projects=(state.projects||[]).filter(p=>p.active!==false);
    openSheet(`<h2 class="sheet-title">입금 기록</h2><p class="sheet-copy">작업월과 입금월을 분리합니다. FLOW에는 실제 입금월 기준으로 반영됩니다.</p><div class="field"><label>프로젝트</label><select id="payProject" class="select">${projects.map(p=>`<option value="${safe(p.id)}">${safe(p.name)}</option>`).join('')}</select></div><div class="field-grid" style="margin-top:8px"><div class="field"><label>작업월</label><input id="payWork" class="input" type="month" value="${selectedMonth}"></div><div class="field"><label>입금일</label><input id="payDate" class="input" type="date" value="${today()}"></div></div><div class="field-grid" style="margin-top:8px"><div class="field"><label>예상액</label><input id="payExpected" class="input num" type="number"></div><div class="field"><label>실제 입금액</label><input id="payActual" class="input num" type="number"></div></div><div class="sheet-actions"><button id="savePayout" class="btn lime block">저장</button></div>`);
    $('#savePayout').onclick=async()=>{const p=state.projects.find(x=>x.id===$('#payProject').value);const row={id:uid('payout'),projectId:p.id,projectName:p.name,workMonth:$('#payWork').value,payMonth:$('#payDate').value.slice(0,7),payDate:$('#payDate').value,currency:p.currency,expected:num($('#payExpected').value),actual:num($('#payActual').value),status:num($('#payActual').value)>0?'입금완료':'입금예정',memo:''};state.payouts.push(row);saveLocal();closeSheet();if(apiReady()){try{await api('appendPayout',{payout:row,mirrorLedger:true});await sync();return}catch(e){return toast(e.message)}}renderAll();};
  }

  async function saveSeedConfig(){state.seed.planStart=$('#seedPlanStart').value;state.seed.targetCurrency=$('#seedCurrency').value;state.seed.longGoal=num($('#seedLongGoal').value);saveLocal();if(apiReady()){try{await api('saveSeedConfig',{seed:{planStart:state.seed.planStart,targetCurrency:state.seed.targetCurrency,longGoal:state.seed.longGoal}});await sync();return}catch(e){return toast(e.message)}}renderAll();toast('SEED 설정 저장');}
  async function saveSeedMonth(month){const card=$(`[data-seed-month="${month}"]`),row=state.seed.rows.find(r=>r.month===month);if(!card||!row)return;row.target=num($('[data-seed-target]',card).value);row.actual=num($('[data-seed-actual]',card).value);saveLocal();if(apiReady()){try{await api('saveSeedMonth',{row});await sync();return}catch(e){return toast(e.message)}}renderAll();toast(`${month} 저장`);}
  async function saveFx(){const existing=(state.fx||[]).find(r=>r.month===selectedMonth);const row={id:existing?.id||uid('fx'),month:selectedMonth,krwPer100Jpy:num($('#fxKrw').value),jpyPerUsd:num($('#fxUsd').value),note:''};if(existing)Object.assign(existing,row);else state.fx.push(row);saveLocal();if(apiReady()){try{await api('saveFx',{fx:row});await sync();return}catch(e){return toast(e.message)}}renderAll();toast('환율 저장');}
  async function saveApiConfig(){config.apiUrl=$('#apiUrl').value.trim();config.apiToken=$('#apiToken').value;saveConfig();if(!apiReady())return toast('URL과 토큰을 모두 입력하세요.');closeSheet();await sync();}
  function resetLocalDemo(){if(!confirm('이 기기의 로컬 테스트 데이터를 초기화할까요? Google Sheet 데이터는 건드리지 않습니다.'))return;state=demoState();saveLocal();renderAll();toast('로컬 데모 초기화');}

  function openQuick() {
    openSheet(`<h2 class="sheet-title">빠른 추가</h2><p class="sheet-copy">폰에서는 입력을 짧게. 분석은 나중에 PC에서 깊게 봅니다.</p><div class="quick-grid"><button class="quick-card" data-quick="salary"><strong>본업 명세</strong><small>신규 / 전월 복사 / 템플릿</small></button><button class="quick-card" data-quick="session"><strong>부업 세션</strong><small>시간·건수 기록</small></button><button class="quick-card" data-quick="oneoff"><strong>단발수입</strong><small>이름·금액만 빠르게</small></button><button class="quick-card" data-quick="seed"><strong>SEED</strong><small>목표·실제 적립</small></button></div>`);
    $$('[data-quick]').forEach(b=>b.onclick=()=>{closeSheet();const q=b.dataset.quick;if(q==='salary'){incomeTab='main';go('income');createSalary('copy')}else if(q==='session'){incomeTab='side';go('income')}else if(q==='oneoff'){incomeTab='side';go('income');setTimeout(openOneOffForm,20)}else go('seed');});
  }
  function openSheet(html){$('#sheetContent').innerHTML=html;$('#sheet').classList.add('open');$('#sheet').setAttribute('aria-hidden','false');}
  function closeSheet(){$('#sheet').classList.remove('open');$('#sheet').setAttribute('aria-hidden','true');}
  let toastTimer;function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600);}

  document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
    renderAll();
  });
})();