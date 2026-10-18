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
