import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyReport } from '../logic.js';

const ESS = ['clamshell', 'bridge'];
const EMPTY = { checks: {}, sessions: [], steps: {}, essentialIds: ESS };

test('an empty week reports hasData false and no NaN', () => {
  const r = weeklyReport(EMPTY, '2026-10-12');
  assert.equal(r.hasData, false);
  assert.equal(r.runCount, 0);
  assert.equal(r.totalKm, 0);
  assert.equal(r.avgSteps, 0);
  assert.equal(r.essentialDone, 0);
  for (const v of Object.values(r)) assert.ok(!Number.isNaN(v), 'NaN leaked into the report');
});

test('counts only sessions inside the week', () => {
  const data = { ...EMPTY, sessions: [
    { date: '2026-10-11', type: 'run', hadPain: false, distanceKm: 9 },
    { date: '2026-10-13', type: 'run', hadPain: false, distanceKm: 2.4 },
    { date: '2026-10-18', type: 'run', hadPain: true, distanceKm: 3, painOnsetKm: 2.1 },
    { date: '2026-10-19', type: 'run', hadPain: false, distanceKm: 9 },
  ]};
  const r = weeklyReport(data, '2026-10-12');
  assert.equal(r.runCount, 2);
  assert.equal(r.totalKm, 5.4);
});

test('bestPainFreeKm takes the max of the week and compares to the previous week', () => {
  const data = { ...EMPTY, sessions: [
    { date: '2026-10-07', type: 'run', hadPain: false, distanceKm: 2.0 },
    { date: '2026-10-13', type: 'run', hadPain: true, distanceKm: 3, painOnsetKm: 2.6 },
    { date: '2026-10-15', type: 'run', hadPain: false, distanceKm: 2.9 },
  ]};
  const r = weeklyReport(data, '2026-10-12');
  assert.equal(r.bestPainFreeKm, 2.9);
  assert.equal(r.prevBestPainFreeKm, 2.0);
  assert.ok(Math.abs(r.delta - 0.9) < 1e-9);
});

test('essentialDone counts fully-complete days in the week', () => {
  const data = { ...EMPTY, checks: {
    '2026-10-12': ['clamshell', 'bridge'],
    '2026-10-13': ['clamshell'],
    '2026-10-14': ['clamshell', 'bridge'],
    '2026-10-19': ['clamshell', 'bridge'],
  }};
  assert.equal(weeklyReport(data, '2026-10-12').essentialDone, 2);
});

test('avgSteps averages only days that have step data', () => {
  const data = { ...EMPTY, steps: { '2026-10-12': 8000, '2026-10-13': 10000, '2026-10-19': 50 } };
  assert.equal(weeklyReport(data, '2026-10-12').avgSteps, 9000);
});

test('golf and walk sessions are excluded from run stats', () => {
  const data = { ...EMPTY, sessions: [
    { date: '2026-10-13', type: 'golf' },
    { date: '2026-10-14', type: 'walk', distanceKm: 4 },
    { date: '2026-10-15', type: 'run', hadPain: false, distanceKm: 2.4 },
  ]};
  const r = weeklyReport(data, '2026-10-12');
  assert.equal(r.runCount, 1);
  assert.equal(r.totalKm, 2.4);
});
