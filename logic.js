// 순수 로직. DOM을 참조하지 않는다 — node --test가 그대로 import한다.

const pad = (n) => String(n).padStart(2, '0');

export function toDateStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(now = new Date()) {
  return toDateStr(now);
}

export function parseLocalDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function mondayOf(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=일
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseLocalDate(s);
  return !Number.isNaN(d.getTime()) && toDateStr(d) === s;
}

// ── 연속 기록 ────────────────────────────────────────────────
const SATURDAY = 6;

export function calcStreak(checks, essentialIds, today) {
  const done = (dateStr) => {
    const list = checks[dateStr];
    return Array.isArray(list) && essentialIds.every((id) => list.includes(id));
  };

  let streak = 0;
  let cursor = parseLocalDate(today);
  const missAt = []; // 미완료가 발생한 "검사 순번"
  let examined = 0;

  for (let guard = 0; guard < 400; guard++) {
    const dateStr = toDateStr(cursor);
    if (cursor.getDay() !== SATURDAY) {
      examined++;
      if (done(dateStr)) {
        streak++;
      } else {
        const recentMisses = missAt.filter((i) => examined - i < 7).length;
        if (recentMisses >= 1) break; // 두 번째 미완료 → 종료
        missAt.push(examined);        // 첫 미완료는 용서, 증가는 없음
      }
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// ── 사다리 진행 ──────────────────────────────────────────────

// 통증이 없었다면 "그날 뛴 거리까지는 괜찮았다"는 하한값으로 쓴다.
// painOnsetKm만 쓰면 가장 잘 풀린 날 그래프에 구멍이 뚫린다.
//
// 통증이 있었는데 시작 거리를 모르면 0이다. 거리로 대체하면 첫 걸음부터
// 아팠던 러닝이 그 주의 최고 기록으로 찍힌다 — 그래프의 의미가 뒤집힌다.
export function painFreeKm(session) {
  if (!session) return 0;
  const dist = Number.isFinite(session.distanceKm) ? session.distanceKm : 0;
  if (!session.hadPain) return dist;
  if (!Number.isFinite(session.painOnsetKm)) return 0;
  return Math.min(Math.max(session.painOnsetKm, 0), dist); // 거리보다 긴 onset은 잘라낸다
}

// 지금 레벨에서 연속으로 통증 없이 끝낸 횟수.
// session.level은 그 러닝을 수행한 레벨이라, 승급 직후 카운트가 리셋된다.
function cleanRunsAtLevel(runs, level) {
  let n = 0;
  for (let i = runs.length - 1; i >= 0; i--) {
    const s = runs[i];
    if (s.hadPain || s.level !== level) break;
    // 가볍게 한 날은 세지 않는다 — 줄인 볼륨으로 올라가면 사다리가 거짓말을 한다.
    // 다만 그 앞의 기록을 무효로 만들지도 않으므로 break가 아니라 continue.
    if (s.light) continue;
    n++;
  }
  return n;
}

const CLEAN_RUNS_TO_PROMOTE = 2;

export function nextLevel(currentLevel, runSessions, ladderLength) {
  const runs = (runSessions || []).filter((s) => s.type === 'run');
  if (runs.length === 0) return { level: currentLevel, reason: '기록 없음', paused: false };

  const last3 = runs.slice(-3);
  if (last3.length === 3 && last3.every((s) => s.hadPain)) {
    return {
      level: Math.max(1, currentLevel - 1),
      reason: '통증 3회 연속 — 2주 중단 권장',
      paused: true,
    };
  }

  const last = runs[runs.length - 1];
  if (last.hadPain) {
    return {
      level: Math.max(1, currentLevel - 1),
      reason: '통증 발생 — 한 단계 내립니다',
      paused: false,
    };
  }

  // 마지막 2회가 아니라 "이 레벨에서" 2회여야 한다. 슬라이딩 윈도우로 보면
  // 승급 후 매 러닝마다 또 승급해 부하가 설계보다 두 배로 빨리 오른다.
  if (cleanRunsAtLevel(runs, currentLevel) >= CLEAN_RUNS_TO_PROMOTE) {
    return {
      level: Math.min(ladderLength, currentLevel + 1),
      reason: '통증 없이 2회 연속 — 한 단계 올립니다',
      paused: false,
    };
  }

  return { level: currentLevel, reason: '한 번 더 통증 없이 끝내면 올립니다', paused: false };
}

// 리포트용. nextLevel()은 러닝을 저장할 때 이미 적용되므로, 여기서 다시 부르면
// 같은 승급을 두 번 센다. 이 함수는 상태를 바꾸지 않고 "다음에 뭐가 오는지"만 말한다.
export function nextStepHint(currentLevel, runSessions, ladderLength) {
  const runs = (runSessions || []).filter((s) => s.type === 'run');
  const last3 = runs.slice(-3);
  if (last3.length === 3 && last3.every((s) => s.hadPain)) {
    return { level: currentLevel, reason: '통증이 계속됩니다 — 2주 쉬고 걷기·강화만', paused: true };
  }
  if (runs.length === 0) {
    return { level: currentLevel, reason: '첫 러닝을 기록해보세요', paused: false };
  }
  const clean = cleanRunsAtLevel(runs, currentLevel);
  const need = CLEAN_RUNS_TO_PROMOTE - clean;
  const reason = need <= 0
    ? `다음 러닝에서 Lv${Math.min(ladderLength, currentLevel + 1)}로 올립니다`
    : need === 1
      ? `한 번 더 통증 없이 끝내면 Lv${Math.min(ladderLength, currentLevel + 1)}`
      : '이 단계를 통증 없이 두 번 끝내면 올립니다';
  return { level: currentLevel, reason, paused: false };
}

// ── 자투리 미션 선택 ────────────────────────────────────────
const WEEKDAY_CONTEXTS = ['subway', 'desk', 'lunch', 'home'];
const WEEKEND_CONTEXTS = ['home', 'outdoor'];
export const MAX_STEPS = 100000;

function dateSeed(dateStr) {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 날짜를 시드로 쓰므로 같은 날은 항상 같은 미션, 다음 날이면 바뀐다.
export function pickMissions(pool, dateStr, count) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const day = parseLocalDate(dateStr).getDay();
  const allowed = day === 0 || day === 6 ? WEEKEND_CONTEXTS : WEEKDAY_CONTEXTS;
  const candidates = pool.filter((m) => allowed.includes(m.context));
  if (candidates.length === 0) return [];

  const rand = mulberry32(dateSeed(dateStr));
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) { // Fisher-Yates
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ── 걸음 수 쿼리 파라미터 (iOS 단축어) ──────────────────────
// URL 파라미터와 직접 입력/붙여넣기가 같은 규칙을 쓰도록 여기로 모았다.
export function parseStepsValue(raw) {
  if (typeof raw !== 'string') return null;
  // 단축어 합계는 "9,240" 처럼 구분자가 붙거나 "9240 걸음" 처럼 단위를 달고 온다.
  // 꼬리에 숫자나 점이 남으면 "1e9" 같은 다른 형식이므로 통째로 거부한다.
  const m = raw.replace(/[,\s\u00a0_]/g, '').match(/^(\d+(?:\.\d+)?)([^\d.]*)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0 || n > MAX_STEPS) return null;
  return Math.round(n);
}

export function parseStepsParam(search, today) {
  let params;
  try { params = new URLSearchParams(search); } catch { return null; }

  const rawSteps = params.get('steps');
  if (rawSteps === null || rawSteps.trim() === '') return null;
  const steps = parseStepsValue(rawSteps);
  if (steps === null) return null;

  const rawDate = params.get('date');
  const date = rawDate === null ? today : rawDate;
  if (!isValidDateStr(date)) return null;
  if (date > today) return null; // 미래 날짜 거부

  return { date, steps };
}

// ── 주간 리포트 ──────────────────────────────────────────────
const round1 = (n) => Math.round(n * 10) / 10;

function runsBetween(sessions, startStr, endStr) {
  return (sessions || []).filter(
    (s) => s.type === 'run' && s.date >= startStr && s.date <= endStr);
}

export function weeklyReport({ checks = {}, sessions = [], steps = {}, essentialIds = [] }, weekStartStr) {
  const start = parseLocalDate(weekStartStr);
  const days = Array.from({ length: 7 }, (_, i) => toDateStr(addDays(start, i)));
  const endStr = days[6];
  const prevStart = toDateStr(addDays(start, -7));
  const prevEnd = toDateStr(addDays(start, -1));

  const runs = runsBetween(sessions, weekStartStr, endStr);
  const prevRuns = runsBetween(sessions, prevStart, prevEnd);

  const best = runs.length ? Math.max(...runs.map(painFreeKm)) : 0;
  const prevBest = prevRuns.length ? Math.max(...prevRuns.map(painFreeKm)) : 0;

  const stepDays = days.map((d) => steps[d]).filter((n) => Number.isFinite(n));
  const avgSteps = stepDays.length
    ? Math.round(stepDays.reduce((a, b) => a + b, 0) / stepDays.length)
    : 0;

  const essentialDone = days.filter((d) => {
    const list = checks[d];
    return Array.isArray(list) && essentialIds.every((id) => list.includes(id));
  }).length;

  return {
    essentialDone,
    essentialTarget: 7,
    runCount: runs.length,
    totalKm: round1(runs.reduce((sum, s) => sum + (Number(s.distanceKm) || 0), 0)),
    bestPainFreeKm: round1(best),
    prevBestPainFreeKm: round1(prevBest),
    delta: round1(best - prevBest),
    avgSteps,
    hasData: runs.length > 0 || essentialDone > 0 || stepDays.length > 0,
  };
}

// ── HTML 이스케이프 ─────────────────────────────────────────
// 사용자가 쓴 메모가 마크업으로 해석되지 않게 한다.
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── 차트 좌표 ───────────────────────────────────────────────
export function chartPoints(sessions, width, height) {
  const runs = (sessions || [])
    .filter((s) => s.type === 'run')
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (runs.length === 0) return { points: [], maxKm: 0, minKm: 0 };

  const values = runs.map(painFreeKm);
  const rawMax = Math.max(...values);
  const rawMin = Math.min(...values);
  // 값이 전부 같으면 span이 0이 되어 y가 NaN이 된다. 위아래로 1km씩 벌린다.
  const maxKm = rawMax === rawMin ? rawMax + 1 : rawMax;
  const minKm = rawMax === rawMin ? Math.max(0, rawMin - 1) : rawMin;
  const span = maxKm - minKm;

  const points = runs.map((s, i) => {
    const km = painFreeKm(s);
    const x = runs.length === 1 ? width / 2 : (i / (runs.length - 1)) * width;
    const y = height - ((km - minKm) / span) * height;
    return { x, y, km, date: s.date, hadPain: !!s.hadPain };
  });

  return { points, maxKm, minKm };
}


// ── 식사 ────────────────────────────────────────────────────
// 미션과 같은 시드를 쓰면 둘이 항상 붙어 움직인다. salt로 떼어놓는다.
const TIP_SALT = 'meal:';

export function pickTip(pool, dateStr) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const rand = mulberry32(dateSeed(TIP_SALT + dateStr));
  return pool[Math.floor(rand() * pool.length)];
}

export function mealChecksFor(dateStr, weekday, weekend) {
  const day = parseLocalDate(dateStr).getDay();
  return day === 0 || day === 6 ? weekend : weekday;
}

// ── 체중 추이 ───────────────────────────────────────────────
export function weightTrend(weights, today, windowDays) {
  const from = toDateStr(addDays(parseLocalDate(today), -(windowDays - 1)));
  const entries = Object.entries(weights || {})
    .filter(([d, v]) => d >= from && d <= today && Number.isFinite(v))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  if (entries.length === 0) return { latest: null, first: null, delta: 0, count: 0, entries: [] };
  const first = entries[0][1];
  const latest = entries[entries.length - 1][1];
  return {
    latest,
    first,
    delta: Math.round((latest - first) * 10) / 10,
    count: entries.length,
    entries: entries.map(([date, kg]) => ({ date, kg })),
  };
}

// ── 시작 단계 ───────────────────────────────────────────────
// 통증 시작 거리의 80%를 목표로 잡되 상한을 둔다. 사다리는 통증 없이 2회면
// 올라가므로 낮게 시작해도 1~2주 손해지만, 높게 시작했다가 재발하면 몇 주를 잃는다.
export const MAX_START_LEVEL = 2;

export function startingLevel(painKm, ladder) {
  const km = Number(painKm);
  if (!Number.isFinite(km) || km <= 0) return 1;
  const target = km * 0.8;
  let level = 1;
  for (let i = ladder.length - 1; i >= 0; i--) {
    if (ladder[i].approxKm <= target) { level = ladder[i].level; break; }
  }
  return Math.min(level, MAX_START_LEVEL);
}

// ── 탭 스와이프 ─────────────────────────────────────────────
export const SWIPE_MIN_PX = 50;
const SWIPE_RATIO = 1.5; // 가로가 세로보다 이만큼은 커야 한다

// 세로 스크롤을 가로채면 앱을 못 쓰게 되므로 판정을 보수적으로 둔다.
export function swipeIntent(dx, dy) {
  if (Math.abs(dx) < SWIPE_MIN_PX) return null;
  if (Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return null;
  return dx < 0 ? 'next' : 'prev';
}

export function adjacentTab(tabs, current, intent) {
  const i = tabs.indexOf(current);
  if (i < 0 || !intent) return null;
  const j = intent === 'next' ? i + 1 : i - 1;
  return j >= 0 && j < tabs.length ? tabs[j] : null; // 끝에서 순환하지 않는다
}

// ── 당겨서 새로고침 ─────────────────────────────────────────
export const PULL_THRESHOLD = 72;

export function pullProgress(dy, threshold = PULL_THRESHOLD) {
  if (!(dy > 0)) return 0; // 위로 미는 건 평범한 스크롤
  return Math.min(1, dy / threshold);
}

export function shouldRefresh(dy, threshold = PULL_THRESHOLD) {
  return dy >= threshold;
}

// ── 단계별 처방 ─────────────────────────────────────────────
// 장경인대는 엉덩이 근력 부족이 원인인 경우가 많다. 그래서 재활 초기에
// 줄여야 하는 건 러닝이지 강화 운동이 아니다. 오히려 초기엔 매일 한다.
export const PHASES = {
  early: {
    label: '재활 초기',
    frequency: '강화는 매일',
    note: '러닝은 줄이되 강화는 매일 합니다. 약한 엉덩이가 원인이라 여기서 빼면 회복이 늦어집니다.',
  },
  mid: {
    label: '복귀 중기',
    frequency: '강화 주 5회',
    note: '세트를 하나씩 늘려 부하를 올립니다. 러닝 다음 날도 거르지 마세요.',
  },
  late: {
    label: '유지기',
    frequency: '강화 주 3회',
    note: '재발 방지 단계입니다. 횟수보다 꾸준함이 중요합니다.',
  },
};

export function phaseFor(runLevel, paused) {
  if (paused) return 'early'; // 통증으로 멈춘 상태에 중기 처방을 주면 안 된다
  if (runLevel >= 8) return 'late';
  if (runLevel >= 4) return 'mid';
  return 'early';
}

export function doseFor(task, phase) {
  const p = PHASES[phase] ? phase : 'early';
  const base = task.dose;
  // 필수 2개는 매일 하는 최소선이라 늘리지 않는다. 회복 운동도 늘릴 대상이 아니다.
  const escalates = task.tier === 'recommended' && (p === 'mid' || p === 'late');
  const sets = escalates ? base.sets + 1 : base.sets;
  const totalSec = sets * base.perSetSec + (sets - 1) * base.restSec;

  return {
    reps: base.reps,
    sets,
    tempo: base.tempo,
    restSec: base.restSec,
    totalSec,
    caution: task.provocative && p === 'early'
      ? '통증이 없는 날에만. 무릎이 30도쯤 굽을 때가 장경인대에 가장 민감한 구간입니다.'
      : null,
  };
}

export function fmtDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s}초`;
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

// ── 홈 통계 ─────────────────────────────────────────────────
export const STRIDE_M = 0.7; // 보폭 가정. 걷기 거리는 어디까지나 추정치다.

// 그리드 한 칸의 상태. 토요일은 'rest' — 쉬는 날이 실패로 보이면
// 쉬어야 할 날에 억지로 하게 된다.
export function dayStatus(dateStr, { checks = {}, essentialIds = [], startedAt, today }) {
  if (dateStr > today) return 'future';
  if (startedAt && dateStr < startedAt) return 'before';

  const list = checks[dateStr];
  const done = Array.isArray(list) ? essentialIds.filter((id) => list.includes(id)).length : 0;
  const isSat = parseLocalDate(dateStr).getDay() === SATURDAY;

  if (isSat) return done === essentialIds.length ? 'restDone' : 'rest';
  if (done === 0) return 'none';
  return done === essentialIds.length ? 'full' : 'partial';
}

export function lastNDays(today, n) {
  const end = parseLocalDate(today);
  return Array.from({ length: n }, (_, i) => toDateStr(addDays(end, i - (n - 1))));
}

// 현재 streak 계산을 과거 각 날짜에 적용해 최댓값을 찾는다. 유예 규칙까지
// 그대로 따라가므로 두 숫자가 어긋나지 않는다.
export function longestStreak(checks, essentialIds, today, lookbackDays = 365) {
  let best = 0;
  for (const d of lastNDays(today, lookbackDays)) {
    const s = calcStreak(checks, essentialIds, d);
    if (s > best) best = s;
  }
  return best;
}

export function weeklyRunGoal(settings, sessions, weekStartStr, today) {
  const start = parseLocalDate(weekStartStr);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const runDays = settings.runDays || [];
  const target = days.filter((d) => d.getDay() === 0 || runDays.includes(d.getDay())).length;

  const endStr = toDateStr(days[6]);
  const ran = new Set(
    (sessions || [])
      .filter((s) => s.type === 'run' && s.date >= weekStartStr && s.date <= endStr)
      .map((s) => s.date)); // 같은 날 두 번 뛰어도 하루로 센다
  return { done: ran.size, target, today };
}

export function cumulativeStats(sessions, steps) {
  const runs = (sessions || []).filter((s) => s.type === 'run');
  const runKm = round1(runs.reduce((a, s) => a + (Number(s.distanceKm) || 0), 0));

  const activities = {};
  for (const s of sessions || []) {
    if (s.type !== 'activity') continue;
    activities[s.kind] = (activities[s.kind] || 0) + 1;
  }

  const values = Object.values(steps || {}).filter((n) => Number.isFinite(n));
  const stepTotal = values.reduce((a, b) => a + b, 0);

  return {
    runCount: runs.length,
    runKm,
    activities,
    stepTotal,
    hasSteps: values.length > 0,
    walkKm: round1((stepTotal * STRIDE_M) / 1000),
  };
}

export function bestPainFreeIn(sessions, fromStr, toStr) {
  const runs = (sessions || [])
    .filter((s) => s.type === 'run' && s.date >= fromStr && s.date <= toStr);
  return runs.length ? round1(Math.max(...runs.map(painFreeKm))) : 0;
}
