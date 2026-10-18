import { createStore } from './store.js';
import {
  TASKS, MICRO_MISSIONS, RUN_LADDER, RUN_RULES, TIER_LABELS, CONTEXT_LABELS,
  WARMUP_MIN, COOLDOWN_MIN, MEAL_TIPS, MEAL_CHECKS_WEEKDAY, MEAL_CHECKS_WEEKEND,
  ACTIVITIES, ACTIVITY_LABELS, HIGH_LOAD_IDS,
} from './data.js';
import { ILLUSTRATIONS } from './illustrations.js';
import { randomGlyph } from './glyphs.js';
import {
  todayStr, toDateStr, parseLocalDate, addDays, mondayOf,
  calcStreak, painFreeKm, nextLevel, pickMissions, parseStepsParam,
  weeklyReport, chartPoints, nextStepHint, pickTip, mealChecksFor, metricTrend,
  startingLevel, swipeIntent, adjacentTab, pullProgress, shouldRefresh, PULL_THRESHOLD,
  phaseFor, doseFor, fmtDuration, PHASES, parseStepsValue,
  dayStatus, lastNDays, longestStreak, weeklyRunGoal, cumulativeStats, bestPainFreeIn,
  countCheckDays, bodyFatPercent, bodyVerdict, BODY_NOISE_KG,
  escapeHtml,
} from './logic.js';

const store = createStore();
const TABS = ['home', 'today', 'log', 'guide'];
const ESSENTIAL_IDS = TASKS.filter((t) => t.tier === 'essential').map((t) => t.id);
const SUNDAY = 0;
const SATURDAY = 6;
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const COMMUTE_WALK_LABEL = '출퇴근 걷기 45분';

const DEFAULT_SETTINGS = {
  painOnsetKm: 0, runLevel: 1, runDays: [2, 4], startedAt: null, pausedUntil: null,
};
const PAUSE_DAYS = 14;
const LIGHT_FACTOR = 0.6; // "오늘은 가볍게" 세트 비율

const getWeights = () => store.get('weights', {});
const getMuscle = () => store.get('muscle', {});
const getFatMass = () => store.get('fatmass', {});
const mealsToday = (dateStr) => mealChecksFor(dateStr, MEAL_CHECKS_WEEKDAY, MEAL_CHECKS_WEEKEND);
const lightSets = (sets) => Math.max(2, Math.round(sets * LIGHT_FACTOR));
let stepsError = null; // 단축어가 보낸 값을 못 읽었을 때 화면에 띄운다

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

function isPaused(settings, dateStr) {
  return Boolean(settings.pausedUntil) && dateStr < settings.pausedUntil;
}

function isRunDay(dateStr, settings) {
  if (isPaused(settings, dateStr)) return false; // 중단 기간에는 러닝을 띄우지 않는다
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
let currentTab = 'today';

export function activateTab(name, dir) {
  const target = TABS.includes(name) ? name : 'today';
  currentTab = target;
  for (const t of TABS) {
    const el = document.getElementById(`tab-${t}`);
    el.classList.toggle('hidden', t !== target);
    if (t === target && dir) {
      el.classList.remove('slide-next', 'slide-prev');
      void el.offsetWidth; // 리플로우를 강제해야 애니메이션이 다시 돈다
      el.classList.add(dir === 'next' ? 'slide-next' : 'slide-prev');
    }
  }
  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === target);
  });
  store.set('lastTab', target);
  if (target === 'home') renderHome();
  if (target === 'log') renderLog();
  if (target === 'guide') renderGuide();
}

// ── 걸음 수 흡수 (iOS 단축어) ───────────────────────────────
function absorbStepsParam() {
  const parsed = parseStepsParam(location.search, todayStr());
  if (!parsed) {
    // steps가 왔는데 못 읽었으면 조용히 넘기지 않는다. 단축어를 고칠 단서가 없어진다.
    let raw = null;
    try { raw = new URLSearchParams(location.search).get('steps'); } catch { /* 무시 */ }
    if (raw !== null) stepsError = raw;
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
    store.set('settings', {
      painOnsetKm: km,
      runLevel: startingLevel(km, RUN_LADDER),
      runDays: days,
      startedAt: todayStr(),
    });
    renderToday();
  });
}

// ── 가이드 탭 ───────────────────────────────────────────────
let guideFilter = 'all';

// 얼마나·몇 세트·어느 속도로·얼마나 쉬는지. 단계에 따라 세트가 바뀐다.
function renderDose(task, phase) {
  const d = doseFor(task, phase);
  const rest = d.restSec > 0 ? `${d.restSec}초` : '없음';
  return `
    <div class="dose">
      <div class="dose-grid">
        <div><span class="dk">한 세트</span><span class="dv">${escapeHtml(d.reps)}</span></div>
        <div><span class="dk">세트 수</span><span class="dv">${d.sets}세트</span></div>
        <div><span class="dk">세트 간 휴식</span><span class="dv">${rest}</span></div>
        <div><span class="dk">총 소요</span><span class="dv">${escapeHtml(fmtDuration(d.totalSec))}</span></div>
      </div>
      <div class="dose-tempo"><span class="dk">속도</span> ${escapeHtml(d.tempo)}</div>
      ${d.caution ? `
        <div class="block warn" style="margin-top:8px">
          <div class="bt">이 단계에서는 주의</div>
          <div class="muted">${escapeHtml(d.caution)}</div>
        </div>` : ''}
    </div>`;
}

// 그림은 스와이프로 넘긴다. 라이브러리 없이 CSS scroll-snap만 쓴다.
function renderCarousel(taskId) {
  const frames = ILLUSTRATIONS[taskId];
  if (!frames || frames.length === 0) return '';
  return `
    <div class="carousel" data-carousel="${taskId}">
      <div class="track">
        ${frames.map((f, i) => `
          <figure class="slide">
            <div class="ill-box">${f.svg}</div>
            <figcaption><span class="step-n">${i + 1}</span>${escapeHtml(f.caption)}</figcaption>
          </figure>`).join('')}
      </div>
      ${frames.length > 1 ? `
        <div class="dots">
          ${frames.map((_, i) => `<span class="dot${i === 0 ? ' on' : ''}"></span>`).join('')}
        </div>
        <div class="swipe-hint">옆으로 넘겨보세요 →</div>` : ''}
    </div>`;
}

// 스크롤 위치로 점 인디케이터를 갱신한다.
function bindCarousels(root) {
  root.querySelectorAll('.carousel').forEach((c) => {
    const track = c.querySelector('.track');
    const dots = [...c.querySelectorAll('.dot')];
    if (dots.length === 0) return;
    track.addEventListener('scroll', () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach((d, n) => d.classList.toggle('on', n === i));
    }, { passive: true });
  });
}

function renderGuide() {
  const root = document.getElementById('tab-guide');
  const filters = [['all', '전체'], ['essential', '필수'], ['recommended', '권장'], ['recovery', '회복']];
  const items = TASKS.filter((t) => guideFilter === 'all' || t.tier === guideFilter);

  const settings = getSettings();
  const phase = phaseFor(settings.runLevel, isPaused(settings, todayStr()));
  const ph = PHASES[phase];

  root.innerHTML = `
    <div class="card">
      <h3>지금 단계 · ${escapeHtml(ph.label)}</h3>
      <div class="kv"><span class="k">러닝</span><span class="v">Lv${settings.runLevel} / ${RUN_LADDER.length}</span></div>
      <div class="kv"><span class="k">강화 빈도</span><span class="v">${escapeHtml(ph.frequency)}</span></div>
      <p class="muted" style="margin:8px 0 0">${escapeHtml(ph.note)}</p>
      <p class="muted" style="margin:6px 0 0;font-size:12px">
        아래 처방은 이 단계에 맞춰 자동으로 바뀝니다.
      </p>
    </div>
    <div class="chips" id="guideChips">
      ${filters.map(([k, label]) => `
        <button type="button" data-filter="${k}" class="${guideFilter === k ? 'active' : ''}">${label}</button>
      `).join('')}
    </div>
    ${items.map((t) => `
      <details class="collapse" data-task="${t.id}">
        <summary>
          <span>${escapeHtml(t.title)}</span>
          <span class="pill">${escapeHtml(TIER_LABELS[t.tier] || t.tier)}</span>
        </summary>
        <div class="body">
          <p class="muted" style="margin:0 0 4px">${escapeHtml(t.summary)}</p>
          ${renderDose(t, phase)}
          ${renderCarousel(t.id)}
          <div class="block plain">
            <div class="bt">언제 추천?</div>
            <div class="muted">${escapeHtml(t.when)}</div>
          </div>
          <div class="block plain">
            <div class="bt">하는 법</div>
            <ol class="howto">${t.how.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ol>
          </div>
          <div class="block warn">
            <div class="bt">잘못된 자세</div>
            <ul class="bullets">${t.mistakes.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
          </div>
          <div class="block ok">
            <div class="bt">코칭 팁</div>
            <ul class="bullets">${t.tips.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
          </div>
          ${t.youtube ? `
            <a class="btn" style="margin-top:12px" target="_blank" rel="noopener noreferrer"
               href="${escapeHtml(t.youtube)}">유튜브로 자세 보기</a>` : ''}
        </div>
      </details>
    `).join('')}
  `;

  root.querySelectorAll('#guideChips button').forEach((b) => {
    b.addEventListener('click', () => { guideFilter = b.dataset.filter; renderGuide(); });
  });
  bindCarousels(root);
}

// 필수 체크 옆 "자세히" → 가이드 탭의 해당 운동을 펼친 채로 보여준다.
function openGuideFor(taskId) {
  guideFilter = 'all';
  activateTab('guide');
  const el = document.querySelector(`#tab-guide details[data-task="${taskId}"]`);
  if (!el) return;
  el.open = true;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── 설정 ────────────────────────────────────────────────────
const SHORTCUT_URL = 'https://runner-recovery.vercel.app/?steps=[걸음수]&date=[날짜]';

function openSettings() {
  const settings = getSettings();
  let days = [...(settings.runDays || [])];
  let level = settings.runLevel;

  openModal(`
    <div class="card">
      <h3>주중 러닝 요일</h3>
      <p class="muted" style="margin:4px 0 10px">일요일은 항상 메인 세션입니다.</p>
      <div class="daypick" id="stDays">
        ${[1, 2, 3, 4, 5].map((d) => `
          <button type="button" data-day="${d}" class="${days.includes(d) ? 'on' : ''}">${DAY_NAMES[d]}</button>
        `).join('')}
      </div>
      <div id="stWarn" class="block warn hidden">
        <div class="bt">연속 이틀은 피해주세요</div>
        <div class="muted">러닝 사이에는 하루를 비웁니다.</div>
      </div>
    </div>

    <div class="card">
      <h3>현재 단계</h3>
      <p class="muted" id="stLevelLabel" style="margin:4px 0 10px"></p>
      <div class="btn-row">
        <button class="btn btn-sm" id="stDown" type="button" style="flex:1">− 내리기</button>
        <button class="btn btn-sm" id="stUp" type="button" style="flex:1">올리기 +</button>
      </div>
    </div>

    <div class="card">
      <h3>걸음 수 연동 (iOS 단축어)</h3>
      <p class="muted" style="margin:4px 0 0">
        웹 앱은 건강 데이터를 직접 읽을 수 없습니다. 단축어를 하나 만들면
        홈 화면 아이콘 하나로 걸음 수까지 같이 들어옵니다.
      </p>
      <div class="block warn">
        <div class="bt">홈 화면 앱과 Safari는 저장소가 다릅니다</div>
        <div class="muted">
          iOS는 홈 화면에 추가한 웹 앱과 Safari의 데이터를 따로 보관합니다.
          단축어의 <b>URL 열기</b>는 Safari를 열기 때문에 홈 화면 앱에는 값이
          들어오지 않습니다. 그래서 <b>클립보드에 복사</b>하는 방식을 씁니다.
        </div>
      </div>
      <ol class="howto">
        <li>단축어 앱 → 새 단축어 만들기</li>
        <li><b>건강 샘플 찾기</b> (영문 <i>Find Health Samples</i>) 추가
          <br>· 유형 <b>걸음 수</b> · 필터 추가 → 시작 날짜 <b>오늘</b> · 제한 <b>끄기</b>
          <br><span class="muted">이름이 비슷한 <b>건강 샘플 기록</b>은 값을 써넣는 동작입니다. 다른 것입니다.</span></li>
        <li><b>통계 계산</b> 추가 → 연산 <b>합계</b>
          <br><span class="muted">합계가 샘플을 못 받으면 그 앞에
          <b>건강 샘플 세부사항 가져오기</b>를 넣고 세부사항을 <b>값</b>으로 지정하세요.</span></li>
        <li><b>클립보드에 복사</b> 추가 → 입력은 합계</li>
        <li>단축어를 <b>홈 화면에 추가</b></li>
      </ol>
      <p class="muted" style="margin:10px 0 0">
        쓸 때는 단축어 아이콘을 한 번 누른 뒤, 이 앱 상단의 걸음 수를 눌러
        <b>클립보드에서 붙여넣기</b>를 누르면 됩니다.
        쉼표(9,240)나 단위(9240 걸음)가 붙어도 읽습니다.
      </p>
    </div>

    <div class="card">
      <h3>데이터</h3>
      <p class="muted" style="margin:4px 0 10px">이 기기에만 저장됩니다. 지우면 되돌릴 수 없습니다.</p>
      <button class="btn btn-danger btn-sm" id="stReset" type="button" style="width:100%">모든 데이터 초기화</button>
    </div>

  `, (modal) => {
    const warn = modal.querySelector('#stWarn');
    const saveBtn = modal.querySelector('#stSave');
    const levelLabel = modal.querySelector('#stLevelLabel');

    const hasBackToBack = (list) => list.slice().sort((a, b) => a - b)
      .some((d, i, arr) => i > 0 && d - arr[i - 1] === 1);

    const sync = () => {
      const bad = hasBackToBack(days);
      warn.classList.toggle('hidden', !bad);
      saveBtn.disabled = bad;
      const l = ladderAt(level);
      levelLabel.textContent = `Lv${l.level} · ${l.label} · 약 ${l.approxKm}km`;
    };
    sync();

    modal.querySelectorAll('#stDays button').forEach((b) => {
      b.addEventListener('click', () => {
        const d = Number(b.dataset.day);
        days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
        b.classList.toggle('on', days.includes(d));
        sync();
      });
    });

    modal.querySelector('#stUp').addEventListener('click', () => {
      level = Math.min(RUN_LADDER.length, level + 1); sync();
    });
    modal.querySelector('#stDown').addEventListener('click', () => {
      level = Math.max(1, level - 1); sync();
    });

    modal.querySelector('#stReset').addEventListener('click', () => {
      if (!confirm('모든 기록을 지웁니다. 계속할까요?')) return;
      if (!confirm('정말 지웁니다. 되돌릴 수 없습니다.')) return;
      for (const k of ['checks', 'sessions', 'steps', 'weights', 'muscle', 'fatmass', 'waist', 'bodyfat', 'lightDay', 'settings', 'lastTab', 'installHintDismissed']) {
        store.remove(k);
      }
      closeModal();
      renderToday();
      activateTab('today');
    });

    modal.querySelector('#stClose').addEventListener('click', closeModal);
    saveBtn.addEventListener('click', () => {
      store.set('settings', { ...getSettings(), runDays: days, runLevel: level });
      closeModal();
      renderToday();
      renderGuide(); // 단계가 바뀌면 처방도 같이 바뀐다
    });
  }, {
    fullscreen: true,
    title: '설정',
    footer: `
      <button class="btn btn-ghost" id="stClose" type="button">닫기</button>
      <button class="btn btn-primary" id="stSave" type="button">저장</button>`,
  });
}

// ── 홈 탭 ───────────────────────────────────────────────────
const GRID_DAYS = 30;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function tile(value, label, delta, unit) {
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '';
  const cls = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
  return `
    <div class="tile">
      <div class="tv">${escapeHtml(String(value))}<span class="tu">${escapeHtml(unit || '')}</span></div>
      <div class="tl">${escapeHtml(label)}</div>
      ${arrow ? `<div class="td ${cls}">${arrow} ${escapeHtml(String(Math.abs(delta)))}</div>` : ''}
    </div>`;
}

function renderGrid(checks, settings, today, sessions) {
  const days = lastNDays(today, GRID_DAYS);
  const ranOn = new Set(sessions.filter((s) => s.type === 'run').map((s) => s.date));
  const counted = days.filter((d) => {
    const st = dayStatus(d, { checks, essentialIds: ESSENTIAL_IDS, startedAt: settings.startedAt, today });
    return st === 'full' || st === 'partial' || st === 'none';
  });
  const fullCount = days.filter((d) =>
    dayStatus(d, { checks, essentialIds: ESSENTIAL_IDS, startedAt: settings.startedAt, today }) === 'full').length;

  return `
    <div class="card">
      <div class="todo-head">
        <h3>최근 30일</h3>
        <span class="todo-count">필수 ${fullCount}/${counted.length}</span>
      </div>
      <div class="grid30">
        ${days.map((d) => {
          const st = dayStatus(d, { checks, essentialIds: ESSENTIAL_IDS, startedAt: settings.startedAt, today });
          const isToday = d === today;
          return `<span class="g-cell g-${st}${isToday ? ' g-today' : ''}${ranOn.has(d) ? ' g-ran' : ''}"
                        title="${escapeHtml(d)}"></span>`;
        }).join('')}
      </div>
      <div class="legend">
        <span><i class="g-cell g-full"></i>완료</span>
        <span><i class="g-cell g-partial"></i>1개</span>
        <span><i class="g-cell g-none"></i>미완료</span>
        <span><i class="g-cell g-rest"></i>쉬는 날</span>
        <span><i class="g-cell g-full g-ran"></i>러닝</span>
      </div>
    </div>`;
}

function renderHome() {
  const root = document.getElementById('tab-home');
  const today = todayStr();
  const settings = getSettings();
  const checks = getChecks();
  const sessions = getSessions();
  const steps = getSteps();

  const streak = calcStreak(checks, ESSENTIAL_IDS, today);
  const best = longestStreak(checks, ESSENTIAL_IDS, today, 180);

  const from30 = toDateStr(addDays(parseLocalDate(today), -29));
  const prevFrom = toDateStr(addDays(parseLocalDate(today), -59));
  const prevTo = toDateStr(addDays(parseLocalDate(today), -30));

  const bestNow = bestPainFreeIn(sessions, from30, today);
  const bestPrev = bestPainFreeIn(sessions, prevFrom, prevTo);
  const runs30 = sessions.filter((s) => s.type === 'run' && s.date >= from30).length;
  const runsPrev = sessions.filter((s) => s.type === 'run' && s.date >= prevFrom && s.date <= prevTo).length;

  const goal = weeklyRunGoal(settings, sessions, toDateStr(mondayOf(parseLocalDate(today))), today);
  const cum = cumulativeStats(sessions, steps);

  // 이번 주 요일별 필수 달성 (0~2)
  const weekStart = mondayOf(parseLocalDate(today));
  const weekDays = Array.from({ length: 7 }, (_, i) => toDateStr(addDays(weekStart, i)));
  const weekBars = weekDays.map((d) => {
    const list = checks[d] || [];
    return { d, n: ESSENTIAL_IDS.filter((id) => list.includes(id)).length, future: d > today };
  });

  // 복부지방 — 행동(식사)과 측정값을 한 카드에
  const mealDates = lastNDays(today, 30).filter((d) => !settings.startedAt || d >= settings.startedAt);
  const mLate = countCheckDays(checks, 'm-late', mealDates);
  const wT = metricTrend(getWeights(), today, null);
  const fatT = metricTrend(getFatMass(), today, null);
  const muscleT = metricTrend(getMuscle(), today, null);
  const note = bodyNote(bodyVerdict(fatT, muscleT), fatT, muscleT);

  // 8주 통증 추이
  const from8w = toDateStr(addDays(parseLocalDate(today), -55));
  const trendRuns = sessions.filter((s) => s.type === 'run' && s.date >= from8w);
  const { points } = chartPoints(trendRuns, 180, 44);

  root.innerHTML = `
    <div class="tiles">
      ${tile(streak, `연속 · 최장 ${best}일`, 0, '일')}
      ${tile(bestNow || '–', '통증없이 뛴 최고', bestNow && bestPrev ? Math.round((bestNow - bestPrev) * 10) / 10 : 0, bestNow ? 'km' : '')}
      ${tile(runs30, '30일 러닝', runs30 - runsPrev, '회')}
    </div>

    <div class="card">
      <div class="todo-head">
        <h3>이번 주 러닝</h3>
        <span class="todo-count">${goal.done}/${goal.target}</span>
      </div>
      <div class="goalbar">
        ${Array.from({ length: goal.target }, (_, i) =>
          `<span class="gslot${i < goal.done ? ' on' : ''}"></span>`).join('')}
      </div>
      <p class="muted" style="margin:8px 0 0;font-size:12px">
        ${goal.done >= goal.target
          ? '이번 주 계획을 다 채웠습니다.'
          : `계획한 요일: ${(settings.runDays || []).map((d) => DOW[d]).join('·')}${(settings.runDays || []).length ? '·' : ''}일`}
      </p>
    </div>

    ${renderGrid(checks, settings, today, sessions)}

    <div class="split">
      <div class="card">
        <h3>이번 주 필수</h3>
        <div class="weekbars">
          ${weekBars.map((b) => `
            <div class="wb">
              <span class="wb-fill wb-${b.future ? 'f' : b.n}"></span>
              <span class="wb-d">${DOW[parseLocalDate(b.d).getDay()]}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <h3>8주 통증 추이</h3>
        ${points.length > 1 ? `
          <svg class="chart" viewBox="0 0 196 60" role="img" aria-label="통증 없이 뛴 거리 추이">
            <polyline fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round"
              points="${points.map((p) => `${p.x + 8},${p.y + 8}`).join(' ')}"/>
          </svg>
          <div class="muted" style="font-size:11px">최근 ${points.length}회</div>`
        : '<div class="empty" style="padding:14px">러닝 2회부터 그려집니다.</div>'}
      </div>
    </div>

    <div class="card">
      <div class="todo-head">
        <h3>복부지방</h3>
        <span class="todo-count">${mLate}/${mealDates.length}</span>
      </div>
      <p class="muted" style="margin:2px 0 0;font-size:12px">
        최근 30일 중 <b>21시 이후 간식 없음</b>을 지킨 날. 복부지방에 가장 큰 레버입니다.
      </p>
      <div class="goalbar" style="margin-top:10px">
        ${mealDates.slice(-15).map((d) =>
          `<span class="gslot${(checks[d] || []).includes('m-late') ? ' on' : ''}"></span>`).join('')}
      </div>
      <div style="margin-top:12px">
        ${metricRow('체지방량', fatT, 'kg', true)}
        ${metricRow('골격근량', muscleT, 'kg', false)}
        ${metricRow('체중', wT, 'kg', true)}
      </div>
      <div class="block ${note.tone}"><div class="muted">${note.text}</div></div>
    </div>

    <div class="card">
      <h3>누적</h3>
      <div class="kv"><span class="k">러닝</span><span class="v">${cum.runKm}km · ${cum.runCount}회</span></div>
      ${cum.hasSteps
        ? `<div class="kv"><span class="k">걷기 (추정)</span><span class="v">약 ${cum.walkKm}km</span></div>
           <div class="kv"><span class="k">걸음 수</span><span class="v">${cum.stepTotal.toLocaleString('ko-KR')}보</span></div>`
        : ''}
      ${Object.keys(cum.activities).length
        ? `<div class="kv"><span class="k">다른 활동</span><span class="v">${
            Object.entries(cum.activities).map(([k, n]) => `${escapeHtml(ACTIVITY_LABELS[k] || k)} ${n}`).join(' · ')
          }</span></div>`
        : ''}
      ${cum.hasSteps ? '<p class="muted" style="margin:8px 0 0;font-size:11px">걷기 거리는 보폭 0.7m 가정 추정치입니다.</p>' : ''}
    </div>
  `;
}

// ── 기록 탭 ─────────────────────────────────────────────────
const CHART_W = 320;
const CHART_H = 130;
const SESSION_TYPE_LABELS = { run: '러닝', walk: '걷기', golf: '골프' };
const sessionLabel = (s) =>
  s.type === 'activity' ? (ACTIVITY_LABELS[s.kind] || '활동') : (SESSION_TYPE_LABELS[s.type] || s.type);

function renderChart(sessions) {
  const { points, maxKm, minKm } = chartPoints(sessions, CHART_W, CHART_H);
  if (points.length === 0) {
    return `<div class="empty">아직 러닝 기록이 없습니다.<br>첫 러닝을 기록하면 여기에 추이가 그려집니다.</div>`;
  }

  const pad = 8;
  const line = points.length > 1
    ? `<polyline fill="none" stroke="var(--brand)" stroke-width="2.5"
         stroke-linejoin="round" stroke-linecap="round"
         points="${points.map((p) => `${p.x + pad},${p.y + pad}`).join(' ')}" />`
    : '';
  const dots = points.map((p) => `
    <circle cx="${p.x + pad}" cy="${p.y + pad}" r="4.5"
      fill="${p.hadPain ? 'var(--warn)' : 'var(--brand)'}" />`).join('');

  return `
    <div class="chart-wrap">
      <svg class="chart" viewBox="0 0 ${CHART_W + pad * 2} ${CHART_H + pad * 2 + 16}"
           role="img" aria-label="통증 없이 뛴 거리 추이">
        ${line}${dots}
        <text class="axis" x="${pad}" y="${CHART_H + pad * 2 + 10}">${minKm}km</text>
        <text class="axis" x="${CHART_W + pad}" y="${pad - 1}" text-anchor="end">${maxKm}km</text>
      </svg>
    </div>
  `;
}

function renderStepBars(steps) {
  const today = parseLocalDate(todayStr());
  const days = Array.from({ length: 14 }, (_, i) => toDateStr(addDays(today, i - 13)));
  const values = days.map((d) => (Number.isFinite(steps[d]) ? steps[d] : 0));
  const max = Math.max(...values, 1);
  if (values.every((v) => v === 0)) return '';
  return `
    <div class="steps">
      ${values.map((v) => `<div class="bar" style="height:${Math.round((v / max) * 100)}%"></div>`).join('')}
    </div>
    <div class="muted" style="font-size:11px;margin-top:4px">최근 14일 걸음 수 · 최대 ${max.toLocaleString('ko-KR')}보</div>
  `;
}

function renderWeeklyReport() {
  const now = new Date();
  const isSundayNight = now.getDay() === SUNDAY && now.getHours() >= 22;
  if (!isSundayNight) return '';

  const weekStart = toDateStr(mondayOf(now));
  const r = weeklyReport({
    checks: getChecks(), sessions: getSessions(), steps: getSteps(), essentialIds: ESSENTIAL_IDS,
  }, weekStart);
  if (!r.hasData) return '';

  const settings = getSettings();
  // nextLevel()은 러닝 저장 시 이미 적용됐다. 여기서 다시 부르면 같은 승급을 두 번 센다.
  const hint = nextStepHint(settings.runLevel, getSessions().filter((s) => s.type === 'run'), RUN_LADDER.length);
  const arrow = r.delta > 0 ? '▲' : r.delta < 0 ? '▼' : '–';

  return `
    <div class="card">
      <h2>이번 주 리포트</h2>
      <div class="kv"><span class="k">필수 달성</span><span class="v">${r.essentialDone} / ${r.essentialTarget}일</span></div>
      <div class="kv"><span class="k">러닝</span><span class="v">${r.runCount}회 · ${r.totalKm}km</span></div>
      <div class="kv"><span class="k">통증 없이 뛴 최고 거리</span><span class="v">${r.bestPainFreeKm}km ${arrow} ${Math.abs(r.delta)}</span></div>
      <div class="kv"><span class="k">걸음 수 일평균</span><span class="v">${r.avgSteps.toLocaleString('ko-KR')}보</span></div>
      ${(() => {
        const wt = metricTrend(getWeights(), todayStr(), 7);
        return wt.count >= 2
          ? `<div class="kv"><span class="k">체중</span><span class="v">${wt.latest}kg ${wt.delta > 0 ? '▲' : wt.delta < 0 ? '▼' : '–'} ${Math.abs(wt.delta)}</span></div>`
          : '';
      })()}
      <div class="block ${hint.paused ? 'warn' : 'ok'}">
        <div class="bt">다음 주 제안</div>
        <div class="muted">${escapeHtml(hint.reason)}${hint.paused ? '' : ` · 현재 Lv${hint.level}`}</div>
      </div>
    </div>
  `;
}

function sparkline(entries, color) {
  if (entries.length < 2) return '';
  const w = 300, h = 54, pad = 6;
  const vals = entries.map((e) => e.value);
  const max = Math.max(...vals), min = Math.min(...vals);
  const span = max === min ? 1 : max - min;
  const pts = entries.map((e, i) => {
    const x = (i / (entries.length - 1)) * w + pad;
    const y = h - ((e.value - min) / span) * h + pad;
    return `${x},${y}`;
  }).join(' ');
  return `<svg class="chart" viewBox="0 0 ${w + pad * 2} ${h + pad * 2}" role="img">
    <polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" points="${pts}"/>
  </svg>`;
}

function metricRow(label, trend, unit, lowerIsBetter) {
  if (trend.latest === null) return `<div class="kv"><span class="k">${escapeHtml(label)}</span><span class="v">–</span></div>`;
  const good = lowerIsBetter ? trend.delta < 0 : trend.delta > 0;
  const arrow = trend.delta > 0 ? '▲' : trend.delta < 0 ? '▼' : '–';
  const cls = trend.delta === 0 ? '' : good ? 'ok-t' : 'warn-t';
  return `
    <div class="kv">
      <span class="k">${escapeHtml(label)}</span>
      <span class="v">${trend.latest}${escapeHtml(unit)}
        ${trend.count >= 2 ? `<span class="${cls}" style="font-weight:700;font-size:12px">${arrow} ${Math.abs(trend.delta)}</span>` : ''}
      </span>
    </div>`;
}

// 체지방량 kg에는 90cm 같은 임상 기준선이 없다. 숫자 옆에서 '이게 좋은 쪽인가'를
// 말해주는 건 자기 첫 측정값과, 근육이 같이 빠지고 있는지 여부뿐이다.
function bodyNote(verdict, fat, muscle) {
  const d = (t) => Math.abs(t.delta);
  switch (verdict) {
    case 'fat-down':
      return { tone: 'ok', text: `시작 이후 체지방량 ${d(fat)}kg 감소. 골격근량은 지키고 있습니다.` };
    case 'fat-down-muscle-down':
      return { tone: 'warn', text: `체지방량이 ${d(fat)}kg 줄었지만 골격근량도 ${d(muscle)}kg 줄었습니다. 단백질과 근력 운동을 늘릴 때입니다.` };
    case 'fat-up':
      return { tone: 'warn', text: `시작 이후 체지방량 ${d(fat)}kg 증가. 21시 이후 간식부터 다시 잡아보세요.` };
    case 'flat':
      return { tone: 'plain', text: `측정 오차(±${BODY_NOISE_KG}kg) 안에서 움직이는 중입니다. 몇 주 더 봐야 추세가 나옵니다.` };
    default:
      return { tone: 'plain', text: '인바디 결과를 2회 이상 기록하면 추이가 보입니다. 기록 탭 → 체성분.' };
  }
}

function renderBodyCard() {
  const today = todayStr();
  const w = metricTrend(getWeights(), today, null);
  const fat = metricTrend(getFatMass(), today, null);
  const muscle = metricTrend(getMuscle(), today, null);
  const note = bodyNote(bodyVerdict(fat, muscle), fat, muscle);
  const pct = bodyFatPercent(fat.latest, w.latest);

  return `
    <div class="card">
      <h3>체성분 <span class="muted" style="font-weight:600">· 주 1회 인바디</span></h3>
      <p class="muted" style="margin:4px 0 0;font-size:12px">
        체지방량이 추세선, 골격근량이 대조군입니다. 체중 하나로는 빠진 게
        지방인지 근육인지 구분할 수 없습니다.
      </p>
      <div style="margin-top:8px">
        ${metricRow('체지방량', fat, 'kg', true)}
        ${metricRow('골격근량', muscle, 'kg', false)}
        ${metricRow('체중', w, 'kg', true)}
        ${pct !== null
          ? `<div class="kv"><span class="k">체지방률 <span class="muted">· 계산값</span></span><span class="v">${pct}%</span></div>`
          : ''}
      </div>
      <div class="block ${note.tone}"><div class="muted">${note.text}</div></div>
      <p class="muted" style="margin:8px 0 0;font-size:11px">변화량은 모두 첫 측정 대비입니다.</p>
      ${fat.count >= 2 ? sparkline(fat.entries, 'var(--warn)') : sparkline(w.entries, 'var(--ok)')}
      <button class="btn btn-sm" id="bodyBtn" type="button" style="width:100%;margin-top:10px">인바디 결과 입력</button>
    </div>`;
}

function openBodyModal() {
  const today = todayStr();
  const w = getWeights()[today];
  const mu = getMuscle()[today];
  const fm = getFatMass()[today];

  openModal(`
    <p class="muted" style="margin:0 0 14px">비워둔 항목은 저장하지 않습니다.</p>
    <label class="field"><span>체중 (kg)</span>
      <input type="text" inputmode="decimal" id="bmW" placeholder="예: 73.1" value="${Number.isFinite(w) ? w : ''}"></label>
    <label class="field"><span>골격근량 (kg)</span>
      <input type="text" inputmode="decimal" id="bmMuscle" placeholder="예: 32.4" value="${Number.isFinite(mu) ? mu : ''}"></label>
    <label class="field"><span>체지방량 (kg)</span>
      <input type="text" inputmode="decimal" id="bmFat" placeholder="예: 18.6" value="${Number.isFinite(fm) ? fm : ''}"></label>
    <div class="block plain">
      <div class="bt">주 1회, 같은 조건으로</div>
      <div class="muted">생체전기저항은 수분 상태에 흔들립니다. 같은 요일·같은 시간,
        공복에 운동 전으로 고정해야 주간 변화가 측정 오차보다 커집니다.
        체지방률과 BMI는 적지 않아도 됩니다 — 위 숫자에서 계산됩니다.</div>
    </div>
    <div id="bmMsg"></div>
  `, (modal) => {
    const num = (id, lo, hi) => {
      const v = modal.querySelector(id).value.trim();
      if (v === '') return undefined;
      const n = Number(v.replace(/[,\s]/g, ''));
      return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 10) / 10 : null;
    };
    modal.querySelector('#bmCancel').addEventListener('click', closeModal);
    modal.querySelector('#bmSave').addEventListener('click', () => {
      const vals = { w: num('#bmW', 20, 250), muscle: num('#bmMuscle', 5, 100), fat: num('#bmFat', 1, 150) };
      if (Object.values(vals).some((v) => v === null)) {
        modal.querySelector('#bmMsg').innerHTML =
          '<div class="block warn" style="margin-top:10px"><div class="muted">숫자 범위를 확인해주세요.</div></div>';
        return;
      }
      const put = (key, getter, v) => {
        if (v === undefined) return;
        const map = getter();
        map[today] = v;
        store.set(key, map);
      };
      put('weights', getWeights, vals.w);
      put('muscle', getMuscle, vals.muscle);
      put('fatmass', getFatMass, vals.fat);
      closeModal();
      renderLog();
      if (!document.getElementById('tab-home').classList.contains('hidden')) renderHome();
    });
  }, {
    footer: `
      <button class="btn btn-ghost" id="bmCancel" type="button">취소</button>
      <button class="btn btn-primary" id="bmSave" type="button">저장</button>`,
  });
}

function renderLog() {
  const root = document.getElementById('tab-log');
  const sessions = getSessions();
  const steps = getSteps();

  const recent = sessions.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 60);

  root.innerHTML = `
    ${renderWeeklyReport()}
    <div class="card">
      <h2>통증 없이 뛴 거리</h2>
      <p class="muted" style="margin:4px 0 0">선이 올라가면 회복되고 있다는 뜻입니다. 빨간 점은 통증이 있던 날입니다.</p>
      ${renderChart(sessions)}
    </div>
    ${renderBodyCard()}
    <div class="card">
      <h3>걸음 수</h3>
      ${renderStepBars(steps) || `<div class="empty">아직 기록이 없습니다.<br>
        단축어로 복사해두고 붙여넣거나, 직접 입력하세요.</div>`}
      <button class="btn btn-sm" id="logStepsBtn" type="button" style="width:100%;margin-top:10px">
        오늘 걸음 수 입력
      </button>
    </div>
    <div class="card">
      <h3>세션 기록</h3>
      <div id="logList" style="margin-top:4px"></div>
    </div>
  `;

  const stepsBtn2 = root.querySelector('#logStepsBtn');
  if (stepsBtn2) stepsBtn2.addEventListener('click', openStepsModal);

  const bodyBtn = root.querySelector('#bodyBtn');
  if (bodyBtn) bodyBtn.addEventListener('click', openBodyModal);

  // 메모는 사용자 입력이므로 textContent로 넣는다.
  const list = root.querySelector('#logList');
  if (recent.length === 0) {
    list.innerHTML = '<div class="empty">아직 기록이 없습니다.</div>';
    return;
  }
  for (const s of recent) {
    const item = document.createElement('div');
    item.className = 'log-item';

    const head = document.createElement('div');
    head.className = 'head';

    const date = document.createElement('span');
    date.style.fontWeight = '800';
    date.textContent = fmtDate(s.date);
    head.appendChild(date);

    const type = document.createElement('span');
    type.className = 'pill';
    type.textContent = sessionLabel(s);
    head.appendChild(type);

    if (s.type === 'run') {
      const km = document.createElement('span');
      km.className = 'muted';
      km.style.fontSize = '13px';
      km.textContent = `${s.distanceKm ?? 0}km`;
      head.appendChild(km);

      const pain = document.createElement('span');
      pain.className = `pill ${s.hadPain ? 'warn' : 'ok'}`;
      pain.style.marginLeft = 'auto';
      pain.textContent = s.hadPain
        ? `통증 ${s.painScore ?? 0}/10 · ${painFreeKm(s)}km`
        : '통증 없음';
      head.appendChild(pain);
    }

    item.appendChild(head);

    if (s.memo) {
      const memo = document.createElement('div');
      memo.className = 'memo';
      memo.textContent = s.memo;
      item.appendChild(memo);
    }
    list.appendChild(item);
  }
}

// 운동 체크 한 줄. 필수와 접힌 섹션이 같은 마크업을 쓰도록 여기로 모았다.
function exerciseRow(task, todayChecks) {
  const on = todayChecks.includes(task.id);
  return `
    <div class="check-row ${on ? 'done' : ''}">
      <label class="check-hit">
        <input type="checkbox" data-check="${task.id}" ${on ? 'checked' : ''}>
        <span>
          <span class="t">${escapeHtml(task.title)}</span><br>
          <span class="d">${escapeHtml(task.detail)}</span>
        </span>
      </label>
      <button type="button" class="howto-link" data-guide="${task.id}">자세히</button>
    </div>
  `;
}

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

  // 0. 단축어 값이 안 읽혔으면 원문을 보여준다
  if (stepsError !== null) {
    parts.push(`
      <div class="card">
        <div class="block warn">
          <div class="bt">걸음 수를 읽지 못했습니다</div>
          <div class="muted">단축어가 보낸 값: <code>${escapeHtml(stepsError)}</code><br>
            숫자로 시작해야 합니다. 설정 → 걸음 수 연동에서 단계를 다시 확인해보세요.</div>
        </div>
        <button class="btn btn-sm btn-ghost" id="dismissStepsErr" type="button" style="width:100%;margin-top:8px">확인</button>
      </div>
    `);
  }

  // 1. 이미 해낸 것
  const stepCount = steps[today];
  let doneLabel = '';
  if (Number.isFinite(stepCount)) {
    doneLabel = `${stepCount.toLocaleString('ko-KR')}보`;
  } else if (day !== SATURDAY && day !== SUNDAY) {
    doneLabel = COMMUTE_WALK_LABEL;
  }
  const essDone = ESSENTIAL_IDS.filter((id) => todayChecks.includes(id)).length;
  const essTotal = ESSENTIAL_IDS.length;
  parts.push(`
    <div class="topstats">
      <div class="streak">🔥 ${streak}일째</div>
      ${essDone < essTotal && day !== SATURDAY
        ? `<span class="streak-hint">오늘 필수 ${essDone}/${essTotal}</span>` : ''}
      <button class="done-btn" id="stepsBtn" type="button">
        ${doneLabel ? `<span class="done">${escapeHtml(doneLabel)} ✓</span>`
                    : '<span class="done-add">걸음 수 입력</span>'}
      </button>
    </div>
  `);

  // 2+3. 오늘 할 일 — 러닝과 필수를 한 블록으로. 따로 두면 러닝 없는 날
  // 히어로가 필수 2개를 그대로 복창하고, 러닝 날엔 "한 가지"가 거짓말이 된다.
  const runToday = isRunDay(today, settings);
  const level = ladderAt(settings.runLevel);
  const loggedToday = sessions.filter((s) => s.date === today);
  const ranToday = loggedToday.some((s) => s.type === 'run');
  const actsToday = loggedToday.filter((s) => s.type === 'activity');
  const heavyToday = actsToday.filter((s) => HIGH_LOAD_IDS.includes(s.kind));
  const essentials = TASKS.filter((t) => t.tier === 'essential');
  const essentialRows = essentials.map((t) => exerciseRow(t, todayChecks)).join('');

  const todoTotal = essTotal + (runToday ? 1 : 0);
  const todoDone = essDone + (runToday && ranToday ? 1 : 0);

  if (isPaused(settings, today)) {
    parts.push(`
      <div class="card hero rest">
        <div class="label">러닝 중단 중 · ${escapeHtml(fmtDate(settings.pausedUntil))}까지</div>
        <div class="title">걷기 + 강화만</div>
        <div class="meta">통증이 3회 연속 나왔습니다. 2주간 러닝을 빼고 엉덩이 근력과 걷기로 버팁니다.</div>
      </div>`);
  } else if (day === SATURDAY) {
    parts.push(`
      <div class="card hero rest">
        <div class="label">오늘</div>
        <div class="title">쉬는 날입니다</div>
        <div class="meta">회복도 프로그램의 일부입니다. 토요일은 연속 기록에서 건너뜁니다 — 쉬어도 안 끊깁니다.</div>
      </div>`);
  }

  const runBlock = runToday ? `
    <div class="run-block">
      <div class="label">러닝 · Lv${level.level}${store.get('lightDay', '') === today ? ' · 가볍게' : ''}</div>
      ${(() => {
        const lightOn = store.get('lightDay', '') === today;
        const sets = lightOn ? lightSets(level.sets) : level.sets;
        const isInterval = level.runMin > 0;
        const runTotal = isInterval ? level.runMin * sets : 0;
        const bodyMin = isInterval ? (level.runMin + level.walkMin) * sets : 0;
        return `
          <div class="title">${escapeHtml(isInterval
            ? `뛰기 ${level.runMin}분 / 걷기 ${level.walkMin}분 × ${sets}` : level.label)}</div>
          <div class="meta">${isInterval
            ? `실제로 뛰는 시간 ${runTotal}분 · 전체 ${WARMUP_MIN + bodyMin + COOLDOWN_MIN}분`
            : `약 ${level.approxKm}km`}${day === SUNDAY ? ' · 오후 권장' : ''}</div>
          ${isInterval ? `
          <div class="timeline">
            <div class="tl-row"><span class="tl-k">웜업</span><span>걷기 ${WARMUP_MIN}분</span></div>
            ${Array.from({ length: sets }, (_, i) => `
              <div class="tl-row cyc"><span class="tl-k">${i + 1}</span>
                <span><b>뛰기 ${level.runMin}분</b> → 걷기 ${level.walkMin}분</span></div>`).join('')}
            <div class="tl-row"><span class="tl-k">쿨다운</span><span>걷기 ${COOLDOWN_MIN}분</span></div>
          </div>` : ''}
          <ul>${RUN_RULES.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`;
      })()}
      ${heavyToday.length ? `
        <div class="run-warn">
          <b>오늘 ${escapeHtml(heavyToday.map((a) => ACTIVITY_LABELS[a.kind] || a.kind).join(', '))}을 했습니다</b><br>
          한 발 버티기가 지친 상태라 폼이 무너지기 쉽습니다. 가볍게 가거나 하루 미루세요.
        </div>` : ''}
      <div class="btn-row" style="margin-top:12px">
        <button class="btn btn-primary" id="logRunBtn" type="button">
          ${ranToday ? '러닝 한 번 더 기록' : '오늘 러닝 기록하기'}
        </button>
      </div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn btn-ghost" id="lightBtn" type="button">
          ${store.get('lightDay', '') === today ? '원래 계획으로 되돌리기' : '오늘은 가볍게 (세트 줄이기)'}
        </button>
      </div>
    </div>` : '';

  const todoHead = `
    <div class="todo-head">
      <h3>오늘 할 일</h3>
      <span class="todo-count">${todoDone}/${todoTotal}</span>
    </div>`;

  if (day === SATURDAY) {
    parts.push(`
      <details class="collapse">
        <summary>필수 2개 (쉬는 날이라 선택)</summary>
        <div class="body">${essentialRows}</div>
      </details>`);
  } else {
    parts.push(`
      <div class="card">
        ${todoHead}
        <p class="muted" style="margin:2px 0 0;font-size:12px">
          ${essDone === essTotal
            ? '필수 완료. 연속 기록이 올라갔습니다.'
            : '아래 운동 2개를 다 체크한 날만 연속 기록에 들어갑니다. 러닝·식사·활동은 세지 않습니다.'}
        </p>
        ${runBlock}
        <div style="margin-top:${runToday ? '4px' : '6px'}">${essentialRows}</div>
      </div>`);
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

  // 4b. 식사
  const meals = mealsToday(today);
  const tip = pickTip(MEAL_TIPS, today);
  const mealDone = meals.filter((m) => todayChecks.includes(m.id)).length;
  parts.push(`
    <div class="card">
      <h3>식사 <span class="muted" style="font-weight:600">· ${mealDone}/${meals.length}</span></h3>
      <div style="margin-top:6px">
        ${meals.map((m) => {
          const on = todayChecks.includes(m.id);
          return `
            <label class="check-row ${on ? 'done' : ''}">
              <input type="checkbox" data-check="${m.id}" ${on ? 'checked' : ''}>
              <span>
                <span class="t">${escapeHtml(m.text)}</span><br>
                <span class="d">${escapeHtml(m.hint)}</span>
              </span>
            </label>`;
        }).join('')}
      </div>
      ${tip ? `
        <div class="block ${tip.kind === 'avoid' ? 'warn' : 'ok'}">
          <div class="bt">${tip.kind === 'avoid' ? '조심' : '오늘의 식사 팁'}</div>
          <div class="muted">${escapeHtml(tip.text)}</div>
        </div>` : ''}
    </div>
  `);

  // 5. 접힌 권장 / 회복
  for (const tier of ['recommended', 'recovery']) {
    const items = TASKS.filter((t) => t.tier === tier);
    if (!items.length) continue;
    const heading = tier === 'recommended' ? '여유 있으면 (+10분)' : '뻐근하면 (회복)';
    parts.push(`
      <details class="collapse">
        <summary>${heading}</summary>
        <div class="body">
          ${items.map((t) => exerciseRow(t, todayChecks)).join('')}
        </div>
      </details>
    `);
  }

  // 7. 활동 기록 (골프 · 배드민턴 · 탁구 등)
  parts.push(`
    <div class="card">
      <h3>오늘 한 다른 활동</h3>
      ${actsToday.length ? `
        <div style="margin:8px 0 2px">
          ${actsToday.map((a) => `
            <span class="pill ${HIGH_LOAD_IDS.includes(a.kind) ? 'warn' : 'ok'}" style="margin-right:6px">
              ${escapeHtml(ACTIVITY_LABELS[a.kind] || a.kind)}
            </span>`).join('')}
        </div>` : '<p class="muted" style="margin:4px 0 0">러닝 말고 몸을 쓴 게 있으면 남겨두세요. 다음 통증의 원인이 보입니다.</p>'}
      <div class="act-grid">
        ${ACTIVITIES.map((a) => `
          <button class="act-btn" type="button" data-act="${a.id}">
            <span class="al">${escapeHtml(a.label)}</span>
            ${a.load === 'high' ? '<span class="ld">부하 높음</span>' : ''}
          </button>`).join('')}
      </div>
    </div>
  `);

  // 체크 한 번에 섹션이 닫히면 토요일 필수 2개를 연달아 체크할 수 없다.
  const openState = [...root.querySelectorAll('details')].map((d) => d.open);
  const scrollY = window.scrollY;

  root.innerHTML = parts.join('');

  root.querySelectorAll('details').forEach((d, i) => { if (openState[i]) d.open = true; });
  if (scrollY) window.scrollTo(0, scrollY);

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

  const stepsBtn = root.querySelector('#stepsBtn');
  if (stepsBtn) stepsBtn.addEventListener('click', openStepsModal);

  const errBtn = root.querySelector('#dismissStepsErr');
  if (errBtn) errBtn.addEventListener('click', () => { stepsError = null; renderToday(); });

  const runBtn = root.querySelector('#logRunBtn');
  if (runBtn) runBtn.addEventListener('click', openRunModal);

  const lightBtn = root.querySelector('#lightBtn');
  if (lightBtn) {
    lightBtn.addEventListener('click', () => {
      store.set('lightDay', store.get('lightDay', '') === today ? '' : today);
      renderToday();
    });
  }

  root.querySelectorAll('[data-guide]').forEach((b) => {
    b.addEventListener('click', () => openGuideFor(b.dataset.guide));
  });

  root.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', () => {
      const kind = b.dataset.act;
      const list = getSessions();
      const at = list.findIndex((s) => s.date === today && s.type === 'activity' && s.kind === kind);
      if (at >= 0) list.splice(at, 1); else list.push({ date: today, type: 'activity', kind });
      store.set('sessions', list);
      renderToday();
    });
  });
}

// ── 걸음 수 입력 ────────────────────────────────────────────
// iOS는 홈 화면 웹 앱과 Safari의 저장소를 분리한다. 단축어의 "URL 열기"는
// Safari를 열기 때문에 홈 화면 앱에는 값이 들어오지 않는다. 그래서 클립보드를
// 경유하는 경로와 직접 입력을 둔다.
function openStepsModal() {
  const today = todayStr();
  const current = getSteps()[today];

  openModal(`
    <label class="field">
      <span>오늘 걸음 수</span>
      <input type="text" id="spInput" inputmode="numeric" autocomplete="off"
             placeholder="예: 9240" value="${Number.isFinite(current) ? current : ''}">
    </label>
    <button class="btn" id="spPaste" type="button">클립보드에서 붙여넣기</button>
    <p class="muted" style="margin:10px 0 0;font-size:12px">
      단축어가 걸음 수를 클립보드에 복사하도록 만들면 여기서 한 번에 넣을 수 있습니다.
      설정 → 걸음 수 연동을 참고하세요.
    </p>
    <div id="spMsg"></div>
  `, (modal) => {
    const input = modal.querySelector('#spInput');
    const msg = modal.querySelector('#spMsg');

    const say = (text, bad) => {
      msg.innerHTML = `<div class="block ${bad ? 'warn' : 'ok'}" style="margin-top:10px">
        <div class="muted">${escapeHtml(text)}</div></div>`;
    };

    modal.querySelector('#spPaste').addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        const n = parseStepsValue(text);
        if (n === null) { say(`클립보드 내용을 숫자로 읽지 못했습니다: ${text.slice(0, 40)}`, true); return; }
        input.value = n;
        say(`${n.toLocaleString('ko-KR')}보를 가져왔습니다. 저장을 누르세요.`);
      } catch {
        say('클립보드를 읽지 못했습니다. 숫자를 직접 입력해주세요.', true);
      }
    });

    modal.querySelector('#spCancel').addEventListener('click', closeModal);
    modal.querySelector('#spSave').addEventListener('click', () => {
      const n = parseStepsValue(input.value);
      if (n === null) { say('0 이상의 숫자를 입력해주세요.', true); return; }
      const steps = getSteps();
      steps[today] = n;
      store.set('steps', steps);
      stepsError = null;
      closeModal();
      renderToday();
      if (!document.getElementById('tab-log').classList.contains('hidden')) renderLog();
    });
  }, {
    footer: `
      <button class="btn btn-ghost" id="spCancel" type="button">취소</button>
      <button class="btn btn-primary" id="spSave" type="button">저장</button>`,
  });
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
      const distRaw = Number(modal.querySelector('#rmDist').value);
      if (!Number.isFinite(distRaw) || distRaw <= 0) {
        alert('뛴 거리를 입력해주세요.');
        return;
      }
      const distanceKm = Math.min(distRaw, 100);
      const hadPain = painEl.checked;
      const onsetEl = modal.querySelector('#rmOnset');
      const onsetRaw = onsetEl.value === '' ? NaN : Number(onsetEl.value);
      if (hadPain && !Number.isFinite(onsetRaw)) {
        alert('통증이 시작된 거리를 입력해주세요. 처음부터 아팠다면 0을 넣으세요.');
        return;
      }
      const session = {
        date: today,
        type: 'run',
        level: settings.runLevel,
        distanceKm,
        hadPain,
        // 0은 유효한 값이다 — 첫 걸음부터 아팠다는 뜻.
        painOnsetKm: hadPain ? Math.min(Math.max(onsetRaw, 0), distanceKm) : undefined,
        painScore: hadPain ? Number(scoreEl.value) : 0,
        memo: modal.querySelector('#rmMemo').value || '',
      };

      const list = getSessions();
      list.push(session);
      store.set('sessions', list);

      const decided = nextLevel(settings.runLevel, list.filter((s) => s.type === 'run'), RUN_LADDER.length);
      store.set('settings', {
        ...settings,
        runLevel: decided.level,
        painOnsetKm: painFreeKm(session),
        pausedUntil: decided.paused ? toDateStr(addDays(parseLocalDate(today), PAUSE_DAYS)) : null,
      });

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
// opts.fullscreen: 딤 없이 화면을 채운다. opts.footer: 스크롤과 무관하게 하단 고정.
// opts.title: 전체화면일 때 상단에 남는 제목.
function openModal(html, wire, opts = {}) {
  const root = document.getElementById('modal-root');
  const full = Boolean(opts.fullscreen);

  root.innerHTML = `
    <div class="modal-backdrop${full ? ' full' : ''}">
      <div class="modal${full ? ' full' : ''}" role="dialog" aria-modal="true">
        ${full && opts.title ? `<div class="modal-head"><h2>${escapeHtml(opts.title)}</h2></div>` : ''}
        <div class="modal-body">${html}</div>
        ${opts.footer ? `<div class="modal-foot">${opts.footer}</div>` : ''}
      </div>
    </div>`;

  // 전체화면 뒤에서 페이지가 같이 스크롤되면 어디를 만지는지 알 수 없어진다.
  document.body.classList.add('modal-open');

  if (!full) {
    const backdrop = root.querySelector('.modal-backdrop');
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  }
  if (wire) wire(root.querySelector('.modal'));
}

function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
  document.body.classList.remove('modal-open');
}

// ── 헤더 글리프 ─────────────────────────────────────────────
// 날짜 시드가 아니라 진짜 무작위. 새로고침마다 바뀌어야 재미가 있다.
function renderHeaderGlyph() {
  const slot = document.getElementById('headerGlyph');
  const g = randomGlyph();
  if (!slot || !g) return;
  slot.innerHTML = g.svg;
  slot.setAttribute('title', g.title);
}

// ── 당겨서 새로고침 ─────────────────────────────────────────
function bindPullToRefresh() {
  const bar = document.getElementById('ptr');
  const fill = bar.querySelector('.bar i');
  const text = document.getElementById('ptrText');
  let y0 = 0, pulling = false, armed = false;

  const reset = () => {
    bar.style.transform = 'translateY(-100%)';
    bar.classList.remove('spin');
    fill.style.width = '0';
    text.textContent = '당겨서 새로고침'; // 남겨두면 다음 당김에 옛 문구가 번쩍인다
    pulling = false;
    armed = false;
  };

  document.addEventListener('touchstart', (e) => {
    // 맨 위에서만, 모달이 없을 때만. 모달 중 새로고침은 입력을 날린다.
    if (e.touches.length !== 1) return;
    if (window.scrollY > 0) return;
    if (document.getElementById('modal-root').firstChild) return;
    y0 = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - y0;
    const p = pullProgress(dy, PULL_THRESHOLD);
    if (p === 0) { reset(); return; }
    armed = shouldRefresh(dy, PULL_THRESHOLD);
    bar.style.transform = `translateY(${-100 + p * 100}%)`;
    fill.style.width = `${p * 100}%`;
    text.textContent = armed ? '놓으면 새로고침' : '당겨서 새로고침';
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!pulling) return;
    if (!armed) { reset(); return; }
    bar.style.transform = 'translateY(0)';
    bar.classList.add('spin');
    text.textContent = '새로고침 중…';
    location.reload();
  }, { passive: true });

  window.addEventListener('pageshow', reset);
}

// ── 탭 스와이프 ─────────────────────────────────────────────
// 캐러셀 같은 가로 스크롤 영역 안에서 시작한 제스처는 그쪽이 먹어야 한다.
function startedInsideScroller(target) {
  return Boolean(target.closest && target.closest('.track'));
}

function bindTabSwipe() {
  const main = document.querySelector('main');
  let x0 = 0, y0 = 0, skip = false;

  main.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { skip = true; return; }
    skip = startedInsideScroller(e.target);
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
  }, { passive: true });

  main.addEventListener('touchend', (e) => {
    if (skip || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    const next = adjacentTab(TABS, currentTab, swipeIntent(dx, dy));
    if (next) activateTab(next, dx < 0 ? 'next' : 'prev');
  }, { passive: true });
}

// ── 자정 넘김 ───────────────────────────────────────────────
// location.reload()를 쓰지 않는다 — 입력 중이던 모달 값이 날아간다.
// 모달은 #modal-root(=.app의 형제)에 있고 renderToday()는 #tab-today만 건드리므로
// 모달이 열려 있어도 다시 그려서 안전하다. 건너뛰면 날짜가 영구히 어긋난다.
let lastSeenDate = todayStr();
function checkDateRollover() {
  const now = todayStr();
  if (now === lastSeenDate) return;
  lastSeenDate = now;
  renderToday();
  if (!document.getElementById('tab-log').classList.contains('hidden')) renderLog();
}
setInterval(checkDateRollover, 60000);
// 폰에서는 앱이 백그라운드에 있는 동안 타이머가 묶인다. 복귀 시점에도 확인한다.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkDateRollover();
});
window.addEventListener('pageshow', checkDateRollover);

// ── 서비스워커 + iOS 설치 안내 ──────────────────────────────
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 무시 */ });
  });
}

// iOS는 설치를 먼저 권하지 않는다. 직접 안내해야 홈 화면에 올라간다.
function maybeShowInstallHint() {
  const slot = document.getElementById('install-hint');
  if (!slot) return;
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (standalone || !isIOS || store.get('installHintDismissed', false)) return;

  slot.innerHTML = `
    <div class="banner">
      <div>
        <b>홈 화면에 추가하세요</b><br>
        공유 버튼 → <b>홈 화면에 추가</b>. 그래야 매일 눈에 띄고 오프라인에서도 열립니다.
      </div>
      <button type="button" id="dismissHint" aria-label="닫기">×</button>
    </div>
  `;
  slot.querySelector('#dismissHint').addEventListener('click', () => {
    store.set('installHintDismissed', true);
    slot.innerHTML = '';
  });
}

// ── 부팅 ────────────────────────────────────────────────────
document.querySelectorAll('.tabbar button').forEach((b) => {
  b.addEventListener('click', () => activateTab(b.dataset.tab));
});
document.getElementById('settingsBtn').addEventListener('click', openSettings);

renderHeaderGlyph();
bindTabSwipe();
bindPullToRefresh();
absorbStepsParam();
maybeShowInstallHint();
registerServiceWorker();
renderToday();
activateTab('today');

window.__rr = { store, renderToday };
