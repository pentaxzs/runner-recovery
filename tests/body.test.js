import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metricTrend, countCheckDays, waistNote, WAIST_CUTOFF_M } from '../logic.js';

// ── 측정 추이 (체중·허리둘레·체지방률 공용) ─────────────────
test('metricTrend works for any numeric series, not just weight', () => {
  const waist = { '2026-09-20': 88.0, '2026-10-05': 87.2, '2026-10-18': 86.5 };
  const t = metricTrend(waist, '2026-10-18', 56);
  assert.equal(t.latest, 86.5);
  assert.ok(Math.abs(t.delta - -1.5) < 1e-9);
  assert.equal(t.count, 3);
});

test('an empty series yields no NaN', () => {
  const t = metricTrend({}, '2026-10-18', 28);
  assert.equal(t.latest, null);
  assert.equal(t.delta, 0);
  assert.equal(t.count, 0);
});

test('entries outside the window are ignored', () => {
  const t = metricTrend({ '2026-01-01': 95, '2026-10-17': 86 }, '2026-10-18', 28);
  assert.equal(t.count, 1);
  assert.equal(t.delta, 0);
});

// ── 식사 실행률 ─────────────────────────────────────────────
test('countCheckDays counts only the days that have the check', () => {
  const checks = {
    '2026-10-15': ['m-late', 'clamshell'],
    '2026-10-16': ['clamshell'],
    '2026-10-17': ['m-late'],
  };
  const dates = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
  assert.equal(countCheckDays(checks, 'm-late', dates), 2);
});

test('countCheckDays is zero when nothing matches', () => {
  assert.equal(countCheckDays({}, 'm-late', ['2026-10-18']), 0);
});

// ── 허리둘레 기준 ───────────────────────────────────────────
test('the male abdominal-obesity cutoff is the documented 90cm', () => {
  assert.equal(WAIST_CUTOFF_M, 90);
});

test('waistNote reports distance from the cutoff', () => {
  const over = waistNote(94);
  assert.equal(over.over, true);
  assert.equal(over.diff, 4);

  const under = waistNote(86.5);
  assert.equal(under.over, false);
  assert.equal(under.diff, 3.5);
});

test('waistNote handles a missing measurement', () => {
  assert.equal(waistNote(null), null);
  assert.equal(waistNote(undefined), null);
});
