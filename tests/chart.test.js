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
