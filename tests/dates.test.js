import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayStr, toDateStr, parseLocalDate, addDays, mondayOf, isValidDateStr } from '../logic.js';

test('toDateStr uses local time, not UTC', () => {
  const d = new Date(2026, 9, 18, 0, 30);
  assert.equal(toDateStr(d), '2026-10-18');
});

test('toDateStr pads single digits', () => {
  assert.equal(toDateStr(new Date(2026, 0, 5)), '2026-01-05');
});

test('parseLocalDate round-trips with toDateStr', () => {
  assert.equal(toDateStr(parseLocalDate('2026-03-09')), '2026-03-09');
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(toDateStr(addDays(parseLocalDate('2026-10-31'), 1)), '2026-11-01');
  assert.equal(toDateStr(addDays(parseLocalDate('2026-12-31'), 1)), '2027-01-01');
  assert.equal(toDateStr(addDays(parseLocalDate('2026-01-01'), -1)), '2025-12-31');
});

test('mondayOf returns Monday for every day of the week', () => {
  for (const day of ['12','13','14','15','16','17','18']) {
    assert.equal(toDateStr(mondayOf(parseLocalDate(`2026-10-${day}`))), '2026-10-12');
  }
});

test('todayStr accepts an injected clock', () => {
  assert.equal(todayStr(new Date(2026, 4, 3, 23, 59)), '2026-05-03');
});

test('isValidDateStr rejects malformed input', () => {
  assert.equal(isValidDateStr('2026-10-18'), true);
  for (const bad of ['2026-13-01', '2026-10-32', '20261018', 'abc', '', null, undefined, '2026-2-3']) {
    assert.equal(isValidDateStr(bad), false, `expected ${bad} to be invalid`);
  }
});
