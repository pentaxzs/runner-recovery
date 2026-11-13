import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportWindow } from '../logic.js';

// 2026-11-15가 일요일. 그 주는 11-09(월)에 시작한다.
const at = (iso) => new Date(`${iso}T00:00:00`);
const atHour = (iso, h) => new Date(`${iso}T${String(h).padStart(2, '0')}:00:00`);

// ── 일요일 저녁에 열린다 ────────────────────────────────────
test('the window opens on Sunday evening', () => {
  const w = reportWindow(atHour('2026-11-15', 18));
  assert.equal(w.weekStartStr, '2026-11-09');
  assert.equal(w.isLastWeek, false);
});

test('Sunday afternoon is too early — the week is not done', () => {
  assert.equal(reportWindow(atHour('2026-11-15', 13)), null);
});

// ── 월요일부터 수요일까지 지난주를 보여준다 ─────────────────
// 2시간짜리 창은 놓치기 쉽다. 저녁 세 번은 걸려야 한다.
test('Monday still shows it, now as last week', () => {
  const w = reportWindow(atHour('2026-11-16', 9));
  assert.equal(w.weekStartStr, '2026-11-09');
  assert.equal(w.isLastWeek, true);
});

test('Wednesday night is the last chance', () => {
  const w = reportWindow(atHour('2026-11-18', 23));
  assert.equal(w.weekStartStr, '2026-11-09');
  assert.equal(w.isLastWeek, true);
});

test('by Thursday the new week is underway and it closes', () => {
  assert.equal(reportWindow(atHour('2026-11-19', 9)), null);
  assert.equal(reportWindow(at('2026-11-20')), null);
  assert.equal(reportWindow(at('2026-11-21')), null);
});

// 월요일 0시는 일요일 23시 바로 다음이다. 같은 주를 가리켜야 한다.
test('midnight into Monday keeps pointing at the week that just ended', () => {
  const sun = reportWindow(atHour('2026-11-15', 23));
  const mon = reportWindow(atHour('2026-11-16', 0));
  assert.equal(sun.weekStartStr, mon.weekStartStr);
});

test('the window spans more than three days', () => {
  let open = 0;
  for (let d = 15; d <= 21; d++) {
    for (let h = 0; h < 24; h++) {
      if (reportWindow(atHour(`2026-11-${d}`, h))) open++;
    }
  }
  assert.ok(open >= 24 * 3, `열린 시간이 ${open}시간뿐이다`);
});
