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

test('Saturday is skipped entirely, not counted and not breaking', () => {
  const checks = full(['2026-10-16', '2026-10-18']);
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 2);
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
