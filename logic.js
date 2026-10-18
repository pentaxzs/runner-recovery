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
export function parseStepsParam(search, today) {
  let params;
  try { params = new URLSearchParams(search); } catch { return null; }

  const rawSteps = params.get('steps');
  if (rawSteps === null || rawSteps.trim() === '') return null;
  const steps = Number(rawSteps);
  if (!Number.isFinite(steps) || steps < 0 || steps > MAX_STEPS) return null;

  const rawDate = params.get('date');
  const date = rawDate === null ? today : rawDate;
  if (!isValidDateStr(date)) return null;
  if (date > today) return null; // 미래 날짜 거부

  return { date, steps: Math.round(steps) };
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
