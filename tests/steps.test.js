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
