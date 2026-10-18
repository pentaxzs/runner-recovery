import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStepsParam } from '../logic.js';

const TODAY = '2026-10-18';

test('reads a valid steps and date pair', () => {
  assert.deepEqual(parseStepsParam('?steps=9240&date=2026-10-18', TODAY),
    { date: '2026-10-18', steps: 9240 });
});

test('defaults to today when date is absent', () => {
  assert.deepEqual(parseStepsParam('?steps=500', TODAY), { date: TODAY, steps: 500 });
});

test('accepts a past date', () => {
  assert.deepEqual(parseStepsParam('?steps=100&date=2026-10-17', TODAY),
    { date: '2026-10-17', steps: 100 });
});

test('rejects junk without throwing', () => {
  const bad = [
    '', '?', '?steps=', '?steps=abc', '?steps=-5', '?steps=1e9', '?steps=999999999',
    '?steps=12.5.3', '?steps=100&date=notadate', '?steps=100&date=2026-13-01',
    '?steps=100&date=2026-10-19',
    '?date=2026-10-18',
  ];
  for (const s of bad) assert.equal(parseStepsParam(s, TODAY), null, `expected null for ${s}`);
});

test('rounds a fractional step count', () => {
  assert.deepEqual(parseStepsParam('?steps=9240.7', TODAY), { date: TODAY, steps: 9241 });
});

// ── 단축어가 보내는 실제 형태 ───────────────────────────────
test('a thousands separator from Shortcuts is accepted', () => {
  // "통계 계산"의 합계가 9,240 형태로 넘어온다. 거부하면 연동이 조용히 죽는다.
  assert.deepEqual(parseStepsParam('?steps=9,240', TODAY), { date: TODAY, steps: 9240 });
  assert.deepEqual(parseStepsParam('?steps=12,345', TODAY), { date: TODAY, steps: 12345 });
});

test('stray spaces around the number are accepted', () => {
  assert.deepEqual(parseStepsParam('?steps=%209240%20', TODAY), { date: TODAY, steps: 9240 });
  assert.deepEqual(parseStepsParam('?steps=9%20240', TODAY), { date: TODAY, steps: 9240 });
});

test('a decimal sum is still rounded', () => {
  assert.deepEqual(parseStepsParam('?steps=9,240.6', TODAY), { date: TODAY, steps: 9241 });
});

test('stripping separators does not turn text into a number', () => {
  for (const bad of ['?steps=9,240보', '?steps=a,b,c', '?steps=,,,', '?steps=-,5']) {
    assert.equal(parseStepsParam(bad, TODAY), null, `expected null for ${bad}`);
  }
});
