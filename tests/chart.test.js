import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartPoints } from '../logic.js';

const S = (date, km, hadPain = false) => ({ date, type: 'run', hadPain, distanceKm: km });

test('no sessions yields no points and no NaN', () => {
  const r = chartPoints([], 300, 120);
  assert.deepEqual(r.points, []);
  assert.ok(Number.isFinite(r.maxKm) && Number.isFinite(r.minKm));
});

test('a single session is placed without dividing by zero', () => {
  const r = chartPoints([S('2026-10-18', 2.4)], 300, 120);
  assert.equal(r.points.length, 1);
  for (const p of r.points) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `NaN coord: ${JSON.stringify(p)}`);
  }
});

test('all-equal values do not divide by zero', () => {
  const r = chartPoints([S('2026-10-14', 3), S('2026-10-16', 3), S('2026-10-18', 3)], 300, 120);
  for (const p of r.points) assert.ok(Number.isFinite(p.y));
});

test('points stay inside the box and higher km sits higher on screen', () => {
  const r = chartPoints([S('2026-10-14', 2.0), S('2026-10-18', 4.0)], 300, 120);
  for (const p of r.points) {
    assert.ok(p.x >= 0 && p.x <= 300, `x out of range: ${p.x}`);
    assert.ok(p.y >= 0 && p.y <= 120, `y out of range: ${p.y}`);
  }
  assert.ok(r.points[1].y < r.points[0].y, 'larger km should have smaller y');
});

test('non-run sessions are excluded', () => {
  const sessions = [S('2026-10-14', 2), { date: '2026-10-15', type: 'golf' }];
  assert.equal(chartPoints(sessions, 300, 120).points.length, 1);
});

test('points are sorted by date regardless of input order', () => {
  const r = chartPoints([S('2026-10-18', 4), S('2026-10-14', 2)], 300, 120);
  assert.deepEqual(r.points.map((p) => p.date), ['2026-10-14', '2026-10-18']);
});

test('pain sessions are flagged so they can be drawn differently', () => {
  const r = chartPoints([{ date: '2026-10-18', type: 'run', hadPain: true, distanceKm: 3, painOnsetKm: 2.1 }], 300, 120);
  assert.equal(r.points[0].hadPain, true);
  assert.equal(r.points[0].km, 2.1);
});

// ── 축 숫자는 화면에 그대로 찍힌다 ──────────────────────────
// 러닝이 한 번뿐이거나 전부 같은 거리면 축을 위아래로 1km씩 벌리는데,
// 1.3 - 1은 부동소수점에서 0.30000000000000004다. 그게 "0.30000000000000004km"로
// 화면에 나왔다.
test('a single run does not print a floating point axis label', () => {
  const runs = [{ type: 'run', date: '2026-10-20', distanceKm: 1.3, hadPain: false }];
  const { minKm, maxKm } = chartPoints(runs, 320, 120);
  assert.equal(minKm, 0.3);
  assert.equal(maxKm, 2.3);
});

test('axis labels stay at one decimal for every ladder distance', () => {
  const oneDecimal = (n) => assert.equal(n, Math.round(n * 10) / 10, `${n}이 소수점 한 자리를 넘는다`);
  for (const km of [1.3, 1.8, 2.2, 2.4, 2.9, 3.4, 3.9, 4.3, 4.6, 5.0, 5.5, 6.1, 0.7]) {
    const { minKm, maxKm } = chartPoints(
      [{ type: 'run', date: '2026-10-20', distanceKm: km, hadPain: false }], 320, 120);
    oneDecimal(minKm);
    oneDecimal(maxKm);
  }
});

test('two runs at the same distance get the same treatment', () => {
  const runs = [
    { type: 'run', date: '2026-10-18', distanceKm: 1.3, hadPain: false },
    { type: 'run', date: '2026-10-20', distanceKm: 1.3, hadPain: false },
  ];
  const { minKm } = chartPoints(runs, 320, 120);
  assert.equal(minKm, 0.3);
});

// 거리가 다르면 실제 값이 축이 되므로 건드릴 게 없다
test('a real spread keeps the measured values', () => {
  const runs = [
    { type: 'run', date: '2026-10-18', distanceKm: 1.3, hadPain: false },
    { type: 'run', date: '2026-10-20', distanceKm: 1.8, hadPain: false },
  ];
  const { minKm, maxKm } = chartPoints(runs, 320, 120);
  assert.equal(minKm, 1.3);
  assert.equal(maxKm, 1.8);
});
