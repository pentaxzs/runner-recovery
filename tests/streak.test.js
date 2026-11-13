import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcStreak } from '../logic.js';

const ESS = ['clamshell', 'bridge'];
const full = (dates) => Object.fromEntries(dates.map((d) => [d, [...ESS]]));

test('no checks means zero', () => {
  assert.equal(calcStreak({}, ESS, '2026-10-18'), 0);
});

test('partial completion does not count', () => {
  assert.equal(calcStreak({ '2026-10-18': ['clamshell'] }, ESS, '2026-10-18'), 0);
});

test('consecutive complete days count', () => {
  const checks = full(['2026-10-15', '2026-10-16', '2026-10-18']);
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 3);
});

// 토요일은 러닝을 쉬는 날이지 엉덩이 근력 운동을 쉬는 날이 아니다. 안 해도
// 끊지 않되, 한 날은 세어준다 — 하라고 보여주고 해도 안 세면 거짓말이다.
test('a skipped Saturday still does not break the streak', () => {
  const checks = full(['2026-10-16', '2026-10-18']); // 10-17이 토요일
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 2);
});

test('a Saturday that was done counts like any other day', () => {
  const checks = full(['2026-10-16', '2026-10-17', '2026-10-18']);
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 3);
});

test('a full week counts seven, not six', () => {
  const week = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12',
    '2026-11-13', '2026-11-14', '2026-11-15'];
  assert.equal(calcStreak(full(week), ESS, '2026-11-15'), 7);
});

// 토요일을 쉰 주가 다 한 주보다 길어지면 안 된다
test('resting Saturday never beats doing it', () => {
  const week = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12',
    '2026-11-13', '2026-11-15'];
  const rested = calcStreak(full(week), ESS, '2026-11-15');
  const done = calcStreak(full([...week, '2026-11-14']), ESS, '2026-11-15');
  assert.equal(rested, 6);
  assert.ok(done > rested);
});

// 쉰 토요일은 용서 한 번을 쓰지 않는다. 그걸 쓰면 평일 하나를 더 빠뜨렸을 때
// 바로 끊긴다.
test('a rested Saturday does not spend the one-miss grace', () => {
  // 10-17(토) 쉼 + 10-15(목) 빠짐 → 용서는 목요일에만 쓰인다
  const checks = full(['2026-10-13', '2026-10-14', '2026-10-16', '2026-10-18']);
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 4);
});

test('one miss inside the recent 7 days is forgiven but not counted', () => {
  const checks = full(['2026-10-13', '2026-10-15', '2026-10-16', '2026-10-18']);
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 4);
});

test('a second miss in the same 7-day window stops the streak', () => {
  const checks = full(['2026-10-13', '2026-10-16', '2026-10-18']);
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 2);
});

test('today being incomplete still allows yesterday to count', () => {
  const checks = full(['2026-10-16']);
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 1);
});

test('extra non-essential checks do not matter', () => {
  const checks = { '2026-10-18': ['clamshell', 'bridge', 'foam'] };
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 1);
});
