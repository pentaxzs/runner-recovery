import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayStatus, lastNDays, longestStreak, weeklyRunGoal, cumulativeStats, bestPainFreeIn, STRIDE_M,
} from '../logic.js';

const ESS = ['clamshell', 'bridge'];
const base = { checks: {}, essentialIds: ESS, startedAt: '2026-10-01', today: '2026-10-18' };

// ── 하루 상태 ───────────────────────────────────────────────
test('both essentials done is full', () => {
  const s = dayStatus('2026-10-16', { ...base, checks: { '2026-10-16': ESS } });
  assert.equal(s, 'full');
});

test('one essential done is partial', () => {
  assert.equal(dayStatus('2026-10-16', { ...base, checks: { '2026-10-16': ['clamshell'] } }), 'partial');
});

test('nothing done is none', () => {
  assert.equal(dayStatus('2026-10-16', base), 'none');
});

test('Saturday is rest, never a miss', () => {
  // 쉬는 날이 실패로 보이면 쉬어야 할 날에 억지로 하게 된다.
  assert.equal(dayStatus('2026-10-17', base), 'rest');
});

test('a Saturday that was done still reads as rest', () => {
  assert.equal(dayStatus('2026-10-17', { ...base, checks: { '2026-10-17': ESS } }), 'restDone');
});

test('days after today are future', () => {
  assert.equal(dayStatus('2026-10-19', base), 'future');
});

test('days before the program started are out of range', () => {
  assert.equal(dayStatus('2026-09-20', base), 'before');
});

// ── 30일 창 ─────────────────────────────────────────────────
test('lastNDays ends on today and runs in order', () => {
  const d = lastNDays('2026-10-18', 30);
  assert.equal(d.length, 30);
  assert.equal(d[29], '2026-10-18');
  assert.equal(d[0], '2026-09-19');
  for (let i = 1; i < d.length; i++) assert.ok(d[i] > d[i - 1]);
});

// ── 최장 연속 ───────────────────────────────────────────────
test('longest streak finds the best run in history', () => {
  const checks = {};
  for (const d of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) checks[d] = [...ESS];
  for (const d of ['2026-10-15', '2026-10-16']) checks[d] = [...ESS];
  assert.equal(longestStreak(checks, ESS, '2026-10-18', 60), 4);
});

test('longest streak is zero with no history', () => {
  assert.equal(longestStreak({}, ESS, '2026-10-18', 60), 0);
});

// ── 주간 러닝 목표 ──────────────────────────────────────────
test('the weekly target counts the chosen weekdays plus Sunday', () => {
  const g = weeklyRunGoal({ runDays: [2, 4] }, [], '2026-10-12', '2026-10-18');
  assert.equal(g.target, 3); // 화, 목, 일
});

test('completed runs this week count toward the target', () => {
  const sessions = [
    { date: '2026-10-13', type: 'run', distanceKm: 2 },
    { date: '2026-10-15', type: 'run', distanceKm: 2 },
    { date: '2026-10-05', type: 'run', distanceKm: 2 }, // 지난주
  ];
  const g = weeklyRunGoal({ runDays: [2, 4] }, sessions, '2026-10-12', '2026-10-18');
  assert.equal(g.done, 2);
  assert.equal(g.target, 3);
});

test('two runs on one day still count as one toward the target', () => {
  const sessions = [
    { date: '2026-10-13', type: 'run', distanceKm: 2 },
    { date: '2026-10-13', type: 'run', distanceKm: 1 },
  ];
  assert.equal(weeklyRunGoal({ runDays: [2, 4] }, sessions, '2026-10-12', '2026-10-18').done, 1);
});

test('an empty runDays still targets Sunday', () => {
  assert.equal(weeklyRunGoal({ runDays: [] }, [], '2026-10-12', '2026-10-18').target, 1);
});

// ── 누적 ────────────────────────────────────────────────────
test('cumulative stats add run distance and count', () => {
  const sessions = [
    { date: '2026-10-13', type: 'run', distanceKm: 2.4 },
    { date: '2026-10-15', type: 'run', distanceKm: 2.9 },
    { date: '2026-10-16', type: 'activity', kind: 'golf' },
    { date: '2026-10-17', type: 'activity', kind: 'badminton' },
  ];
  const c = cumulativeStats(sessions, {});
  assert.equal(c.runCount, 2);
  assert.equal(c.runKm, 5.3);
  assert.equal(c.activities.golf, 1);
  assert.equal(c.activities.badminton, 1);
});

test('walk distance is estimated from steps and marked as having data', () => {
  const c = cumulativeStats([], { '2026-10-17': 10000, '2026-10-18': 8000 });
  assert.equal(c.stepTotal, 18000);
  assert.ok(c.hasSteps);
  assert.equal(c.walkKm, Math.round(18000 * STRIDE_M / 1000 * 10) / 10);
});

test('with no steps the walk figure is suppressed rather than shown as zero', () => {
  const c = cumulativeStats([], {});
  assert.equal(c.hasSteps, false);
});

// ── 기간별 최고 기록 ────────────────────────────────────────
test('bestPainFreeIn takes the max inside the window only', () => {
  const sessions = [
    { date: '2026-09-10', type: 'run', hadPain: false, distanceKm: 9 },
    { date: '2026-10-13', type: 'run', hadPain: false, distanceKm: 2.4 },
    { date: '2026-10-15', type: 'run', hadPain: true, distanceKm: 4, painOnsetKm: 3.1 },
  ];
  assert.equal(bestPainFreeIn(sessions, '2026-10-01', '2026-10-18'), 3.1);
});

test('bestPainFreeIn returns zero for an empty window', () => {
  assert.equal(bestPainFreeIn([], '2026-10-01', '2026-10-18'), 0);
});
