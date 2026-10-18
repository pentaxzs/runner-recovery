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
