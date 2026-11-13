import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysSinceLastRun } from '../logic.js';

const run = (date) => ({ date, type: 'run', distanceKm: 1.8, hadPain: false });

// ── 마지막 러닝이 며칠 전인가 ───────────────────────────────
test('a run yesterday is one day ago', () => {
  assert.equal(daysSinceLastRun([run('2026-11-12')], '2026-11-13'), 1);
});

test('a run today is zero days ago', () => {
  assert.equal(daysSinceLastRun([run('2026-11-13')], '2026-11-13'), 0);
});

test('it reports the most recent run, not the first', () => {
  const sessions = [run('2026-11-01'), run('2026-11-10'), run('2026-11-12')];
  assert.equal(daysSinceLastRun(sessions, '2026-11-13'), 1);
});

test('order in the array does not matter', () => {
  const sessions = [run('2026-11-12'), run('2026-11-01'), run('2026-11-10')];
  assert.equal(daysSinceLastRun(sessions, '2026-11-13'), 1);
});

// 앞으로 기록된 러닝은 세지 않는다 — 날짜를 잘못 고친 경우가 있다
test('runs dated in the future are ignored', () => {
  assert.equal(daysSinceLastRun([run('2026-11-20')], '2026-11-13'), null);
  assert.equal(daysSinceLastRun([run('2026-11-20'), run('2026-11-10')], '2026-11-13'), 3);
});

test('활동은 러닝이 아니다', () => {
  const sessions = [{ date: '2026-11-12', type: 'activity', kind: 'badminton' }];
  assert.equal(daysSinceLastRun(sessions, '2026-11-13'), null);
});

test('no runs at all yields null', () => {
  assert.equal(daysSinceLastRun([], '2026-11-13'), null);
  assert.equal(daysSinceLastRun(null, '2026-11-13'), null);
});

// 달을 넘어가도 날짜 계산이 맞아야 한다
test('it counts across a month boundary', () => {
  assert.equal(daysSinceLastRun([run('2026-10-31')], '2026-11-02'), 2);
});
