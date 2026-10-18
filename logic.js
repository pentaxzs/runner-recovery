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
export function painFreeKm(session) {
  if (!session) return 0;
  if (session.hadPain && Number.isFinite(session.painOnsetKm)) return session.painOnsetKm;
  return Number.isFinite(session.distanceKm) ? session.distanceKm : 0;
}

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

  const last2 = runs.slice(-2);
  if (last2.length === 2 && last2.every((s) => !s.hadPain)) {
    return {
      level: Math.min(ladderLength, currentLevel + 1),
      reason: '통증 없이 2회 연속 — 한 단계 올립니다',
      paused: false,
    };
  }

  return { level: currentLevel, reason: '한 번 더 통증 없이 끝내면 올립니다', paused: false };
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
