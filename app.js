import { createStore } from './store.js';
import { TASKS, MICRO_MISSIONS, RUN_LADDER, RUN_RULES, TIER_LABELS, CONTEXT_LABELS } from './data.js';
import {
  todayStr, toDateStr, parseLocalDate, addDays, mondayOf,
  calcStreak, painFreeKm, nextLevel, pickMissions, parseStepsParam,
  escapeHtml,
} from './logic.js';

const store = createStore();
const TABS = ['today', 'log', 'guide'];
const ESSENTIAL_IDS = TASKS.filter((t) => t.tier === 'essential').map((t) => t.id);
const SUNDAY = 0;
const SATURDAY = 6;
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const COMMUTE_WALK_LABEL = '출퇴근 걷기 45분';

const DEFAULT_SETTINGS = { painOnsetKm: 0, runLevel: 1, runDays: [2, 4], startedAt: null };

// ── 상태 접근 ────────────────────────────────────────────────
const getSettings = () => ({ ...DEFAULT_SETTINGS, ...store.get('settings', {}) });
const getChecks = () => store.get('checks', {});
const getSessions = () => store.get('sessions', []);
const getSteps = () => store.get('steps', {});
const isOnboarded = () => store.get('settings', null) !== null;

function ladderAt(level) {
  const idx = Math.min(Math.max(level, 1), RUN_LADDER.length) - 1;
  return RUN_LADDER[idx];
}

function isRunDay(dateStr, settings) {
  const day = parseLocalDate(dateStr).getDay();
  if (day === SUNDAY) return true;
  if (day === SATURDAY) return false;
  return (settings.runDays || []).includes(day);
}

function fmtDate(dateStr) {
  const d = parseLocalDate(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_NAMES[d.getDay()]})`;
}

// ── 탭 ──────────────────────────────────────────────────────
export function activateTab(name) {
  const target = TABS.includes(name) ? name : 'today';
  for (const t of TABS) {
    document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== target);
  }
  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === target);
  });
  store.set('lastTab', target);
  if (target === 'log') renderLog();
  if (target === 'guide') renderGuide();
}

// ── 걸음 수 흡수 (iOS 단축어) ───────────────────────────────
function absorbStepsParam() {
  const parsed = parseStepsParam(location.search, todayStr());
  if (!parsed) {
    if (location.search) history.replaceState({}, '', location.pathname);
    return;
  }
  const steps = getSteps();
  steps[parsed.date] = parsed.steps; // 누적이 아니라 덮어쓰기
  store.set('steps', steps);
  history.replaceState({}, '', location.pathname);
}

// ── 온보딩 ──────────────────────────────────────────────────
function renderOnboarding(root) {
  root.innerHTML = `
    <div class="card">
      <h2>시작하기 전에</h2>
      <p class="muted" style="margin:8px 0 16px">
        지금 상태를 알아야 첫 거리를 정할 수 있습니다. 모르면 비워두고 넘어가세요.
      </p>
      <label class="field">
        <span>최근에 뛰었을 때 몇 km쯤에서 아팠나요?</span>
        <input type="number" id="obPain" step="0.1" min="0" max="50" placeholder="예: 2.8">
      </label>
      <label class="field">
        <span>주중 러닝 요일 (일요일은 항상 포함)</span>
        <div class="daypick" id="obDays">
          ${[1, 2, 3, 4, 5].map((d) => `
            <button type="button" data-day="${d}" class="${[2, 4].includes(d) ? 'on' : ''}">${DAY_NAMES[d]}</button>
          `).join('')}
        </div>
      </label>
      <div id="obWarn" class="block warn hidden">
        <div class="bt">연속 이틀은 피해주세요</div>
        <div class="muted">장경인대 회복기에는 러닝 사이에 하루를 비웁니다.</div>
      </div>
      <button class="btn btn-primary" id="obStart" type="button">시작하기</button>
    </div>
  `;

  let days = [2, 4];
  const warn = root.querySelector('#obWarn');
  const startBtn = root.querySelector('#obStart');

  const hasBackToBack = (list) => list.slice().sort((a, b) => a - b)
    .some((d, i, arr) => i > 0 && d - arr[i - 1] === 1);

  const sync = () => {
    const bad = hasBackToBack(days);
    warn.classList.toggle('hidden', !bad);
    startBtn.disabled = bad;
  };

  root.querySelectorAll('#obDays button').forEach((b) => {
    b.addEventListener('click', () => {
      const d = Number(b.dataset.day);
      days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
      b.classList.toggle('on', days.includes(d));
      sync();
    });
  });

  startBtn.addEventListener('click', () => {
    const km = Number(root.querySelector('#obPain').value) || 0;
    // 목표는 통증 시작 거리의 80%. 그 아래로 가장 가까운 칸에서 시작한다.
    let level = 1;
    if (km > 0) {
      const target = km * 0.8;
      for (let i = RUN_LADDER.length - 1; i >= 0; i--) {
        if (RUN_LADDER[i].approxKm <= target) { level = RUN_LADDER[i].level; break; }
      }
    }
    store.set('settings', {
      painOnsetKm: km, runLevel: level, runDays: days, startedAt: todayStr(),
    });
    renderToday();
  });
}

// Task 10/11에서 채운다.
function renderLog() {}
function renderGuide() {}

// ── 오늘 화면 ───────────────────────────────────────────────
export function renderToday() {
  const root = document.getElementById('tab-today');

  if (!isOnboarded()) { renderOnboarding(root); return; }

  const today = todayStr();
  const settings = getSettings();
  const checks = getChecks();
  const steps = getSteps();
  const sessions = getSessions();
  const day = parseLocalDate(today).getDay();
  const todayChecks = checks[today] || [];
  const streak = calcStreak(checks, ESSENTIAL_IDS, today);

  const parts = [];

  // 1. 이미 해낸 것
  const stepCount = steps[today];
  let doneLabel = '';
  if (Number.isFinite(stepCount)) {
    doneLabel = `${stepCount.toLocaleString('ko-KR')}보`;
  } else if (day !== SATURDAY && day !== SUNDAY) {
    doneLabel = COMMUTE_WALK_LABEL;
  }
  parts.push(`
    <div class="topstats">
      <div class="streak">🔥 ${streak}일째</div>
      ${doneLabel ? `<div class="done">${escapeHtml(doneLabel)} ✓</div>` : ''}
    </div>
  `);

  // 2. 오늘의 한 가지
  const runToday = isRunDay(today, settings);
  const level = ladderAt(settings.runLevel);
  const loggedToday = sessions.filter((s) => s.date === today);
  const ranToday = loggedToday.some((s) => s.type === 'run');
  const golfToday = loggedToday.some((s) => s.type === 'golf');

  if (day === SATURDAY) {
    parts.push(`
      <div class="card hero rest">
        <div class="label">오늘의 한 가지</div>
        <div class="title">오늘은 쉬는 날입니다</div>
        <div class="meta">회복도 프로그램의 일부입니다. 연속 기록은 토요일을 세지 않습니다.</div>
      </div>
    `);
  } else if (runToday) {
    parts.push(`
      <div class="card hero">
        <div class="label">오늘의 한 가지 · Lv${level.level}</div>
        <div class="title">${escapeHtml(level.label)}</div>
        <div class="meta">약 ${level.approxKm}km${day === SUNDAY ? ' · 오후 권장' : ''}</div>
        <ul>${RUN_RULES.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
      </div>
    `);
  } else {
    parts.push(`
      <div class="card hero">
        <div class="label">오늘의 한 가지</div>
        <div class="title">클램셸 + 힙 브리지</div>
        <div class="meta">5분이면 끝납니다</div>
      </div>
    `);
  }

  // 3. 필수 2개
  const essentials = TASKS.filter((t) => t.tier === 'essential');
  const essentialRows = essentials.map((t) => {
    const on = todayChecks.includes(t.id);
    return `
      <label class="check-row ${on ? 'done' : ''}">
        <input type="checkbox" data-check="${t.id}" ${on ? 'checked' : ''}>
        <span>
          <span class="t">${escapeHtml(t.title)}</span><br>
          <span class="d">${escapeHtml(t.detail)}</span>
        </span>
      </label>
    `;
  }).join('');

  if (day === SATURDAY) {
    parts.push(`
      <details class="collapse">
        <summary>필수 2개 (쉬는 날이라 선택)</summary>
        <div class="body">${essentialRows}</div>
      </details>
    `);
  } else {
    parts.push(`<div class="card"><h3>필수</h3><div style="margin-top:6px">${essentialRows}</div></div>`);
  }

  // 4. 자투리 미션 3개
  const missions = pickMissions(MICRO_MISSIONS, today, 3);
  if (missions.length) {
    parts.push(`
      <div class="card">
        <h3>자투리 <span class="muted" style="font-weight:600">· 매일 바뀝니다</span></h3>
        <div style="margin-top:6px">
          ${missions.map((m) => `
            <div class="mission">
              <span class="ctx">${escapeHtml(CONTEXT_LABELS[m.context] || m.context)}</span>
              <span class="txt">${escapeHtml(m.text)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  // 5. 접힌 권장 / 회복
  for (const tier of ['recommended', 'recovery']) {
    const items = TASKS.filter((t) => t.tier === tier);
    if (!items.length) continue;
    const heading = tier === 'recommended' ? '여유 있으면 (+10분)' : '뻐근하면 (회복)';
    parts.push(`
      <details class="collapse">
        <summary>${heading}</summary>
        <div class="body">
          ${items.map((t) => {
            const on = todayChecks.includes(t.id);
            return `
              <label class="check-row ${on ? 'done' : ''}">
                <input type="checkbox" data-check="${t.id}" ${on ? 'checked' : ''}>
                <span>
                  <span class="t">${escapeHtml(t.title)}</span><br>
                  <span class="d">${escapeHtml(t.detail)}</span>
                </span>
              </label>
            `;
          }).join('')}
        </div>
      </details>
    `);
  }

  // 6. 러닝 기록 (러닝 지정일만)
  if (runToday) {
    parts.push(`
      <div class="card">
        ${golfToday ? `
          <div class="block warn">
            <div class="bt">오늘 골프 연습을 했습니다</div>
            <div class="muted">한 발 버티기가 지친 상태라 폼이 무너지기 쉽습니다.</div>
          </div>` : ''}
        ${ranToday ? '<div class="block ok"><div class="bt">오늘 러닝을 기록했습니다</div></div>' : ''}
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn-primary" id="logRunBtn" type="button">
            ${ranToday ? '러닝 한 번 더 기록' : '오늘 러닝 기록하기'}
          </button>
        </div>
      </div>
    `);
  }

  // 7. 골프
  parts.push(`
    <div class="btn-row" style="margin-bottom:12px">
      <button class="btn btn-ghost btn-sm" id="logGolfBtn" type="button" style="width:100%">
        ${golfToday ? '골프 연습 기록됨 ✓' : '골프 연습 30분 기록'}
      </button>
    </div>
  `);

  root.innerHTML = parts.join('');

  // ── 이벤트 ──
  root.querySelectorAll('input[data-check]').forEach((el) => {
    el.addEventListener('change', () => {
      const latest = getChecks();
      const list = new Set(latest[today] || []);
      if (el.checked) list.add(el.dataset.check); else list.delete(el.dataset.check);
      latest[today] = [...list];
      store.set('checks', latest);
      renderToday();
    });
  });

  const runBtn = root.querySelector('#logRunBtn');
  if (runBtn) runBtn.addEventListener('click', openRunModal);

  const golfBtn = root.querySelector('#logGolfBtn');
  if (golfBtn) {
    golfBtn.addEventListener('click', () => {
      if (golfToday) return;
      const list = getSessions();
      list.push({ date: today, type: 'golf' });
      store.set('sessions', list);
      renderToday();
    });
  }
}

// ── 러닝 기록 모달 ──────────────────────────────────────────
function openRunModal() {
  const today = todayStr();
  const settings = getSettings();
  const level = ladderAt(settings.runLevel);

  openModal(`
    <h2>오늘 러닝 기록</h2>
    <p class="muted" style="margin:0 0 14px">${escapeHtml(level.label)} · 목표 약 ${level.approxKm}km</p>
    <label class="field">
      <span>뛴 거리 (km)</span>
      <input type="number" id="rmDist" step="0.1" min="0" max="100" value="${level.approxKm}">
    </label>
    <label class="inline-check" style="margin-bottom:12px">
      <input type="checkbox" id="rmPain"> 통증이 있었나요?
    </label>
    <div id="rmPainFields" class="hidden">
      <label class="field">
        <span>통증이 시작된 거리 (km)</span>
        <input type="number" id="rmOnset" step="0.1" min="0" max="100" placeholder="예: 2.1">
      </label>
      <label class="field">
        <span>통증 점수 <b id="rmScoreVal">3</b>/10</span>
        <input type="range" id="rmScore" min="0" max="10" value="3">
      </label>
    </div>
    <label class="field">
      <span>메모</span>
      <textarea id="rmMemo" placeholder="노면, 날씨, 컨디션 등"></textarea>
    </label>
    <div class="btn-row">
      <button class="btn btn-ghost" id="rmCancel" type="button">취소</button>
      <button class="btn btn-primary" id="rmSave" type="button">저장</button>
    </div>
  `, (modal) => {
    const painEl = modal.querySelector('#rmPain');
    const fields = modal.querySelector('#rmPainFields');
    const scoreEl = modal.querySelector('#rmScore');

    painEl.addEventListener('change', () => fields.classList.toggle('hidden', !painEl.checked));
    scoreEl.addEventListener('input', () => {
      modal.querySelector('#rmScoreVal').textContent = scoreEl.value;
    });

    modal.querySelector('#rmCancel').addEventListener('click', closeModal);
    modal.querySelector('#rmSave').addEventListener('click', () => {
      const distanceKm = Number(modal.querySelector('#rmDist').value) || 0;
      const hadPain = painEl.checked;
      const onsetRaw = Number(modal.querySelector('#rmOnset').value);
      const session = {
        date: today,
        type: 'run',
        level: settings.runLevel,
        distanceKm,
        hadPain,
        painOnsetKm: hadPain && Number.isFinite(onsetRaw) && onsetRaw > 0 ? onsetRaw : undefined,
        painScore: hadPain ? Number(scoreEl.value) : 0,
        memo: modal.querySelector('#rmMemo').value || '',
      };

      const list = getSessions();
      list.push(session);
      store.set('sessions', list);

      const decided = nextLevel(settings.runLevel, list.filter((s) => s.type === 'run'), RUN_LADDER.length);
      store.set('settings', { ...settings, runLevel: decided.level, painOnsetKm: painFreeKm(session) });

      closeModal();
      renderToday();
      showLevelToast(decided);
    });
  });
}

function showLevelToast(decided) {
  const root = document.getElementById('tab-today');
  const note = document.createElement('div');
  note.className = `card ${decided.paused ? '' : ''}`;
  note.innerHTML = `
    <div class="block ${decided.paused ? 'warn' : 'ok'}">
      <div class="bt">${decided.paused ? '러닝을 잠시 멈추세요' : `다음 러닝 Lv${decided.level}`}</div>
      <div class="muted">${escapeHtml(decided.reason)}</div>
    </div>
  `;
  root.prepend(note);
}

// ── 모달 공통 ───────────────────────────────────────────────
function openModal(html, wire) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
  const backdrop = root.querySelector('.modal-backdrop');
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  if (wire) wire(root.querySelector('.modal'));
}

function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

// ── 자정 넘김 ───────────────────────────────────────────────
// location.reload()를 쓰지 않는다 — 입력 중이던 모달 값이 날아간다.
let lastSeenDate = todayStr();
setInterval(() => {
  const now = todayStr();
  if (now !== lastSeenDate) {
    lastSeenDate = now;
    if (!document.getElementById('modal-root').firstChild) renderToday();
  }
}, 60000);

// ── 부팅 ────────────────────────────────────────────────────
document.querySelectorAll('.tabbar button').forEach((b) => {
  b.addEventListener('click', () => activateTab(b.dataset.tab));
});

absorbStepsParam();
renderToday();
activateTab(store.get('lastTab', 'today'));

window.__rr = { store, renderToday };
