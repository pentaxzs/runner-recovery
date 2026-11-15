import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstPaired } from '../logic.js';

// ── 두 값이 같은 날 것이어야 한다 ───────────────────────────
// 체성분은 세 칸이 각각 선택 입력이라, 체중만 적은 날이 생긴다. 체지방량의
// 첫 기록과 체중의 첫 기록을 그냥 나누면 11월 지방을 9월 체중으로 나눈다.
test('it pairs the earliest date that has both', () => {
  const fat = { '2026-11-15': 18.6 };
  const weight = { '2026-09-01': 80.0, '2026-11-15': 73.1 };
  assert.deepEqual(firstPaired(fat, weight), { date: '2026-11-15', a: 18.6, b: 73.1 });
});

test('it takes the earliest shared date, not the earliest of either', () => {
  const fat = { '2026-10-01': 20.1, '2026-11-15': 18.6 };
  const weight = { '2026-09-01': 80.0, '2026-10-01': 75.4, '2026-11-15': 73.1 };
  assert.deepEqual(firstPaired(fat, weight), { date: '2026-10-01', a: 20.1, b: 75.4 });
});

test('no shared date yields null', () => {
  assert.equal(firstPaired({ '2026-11-15': 18.6 }, { '2026-09-01': 80 }), null);
});

test('empty inputs yield null', () => {
  assert.equal(firstPaired({}, {}), null);
  assert.equal(firstPaired(null, { '2026-11-15': 73.1 }), null);
});

test('non-numbers are not a pair', () => {
  const fat = { '2026-11-15': null, '2026-11-16': 18.6 };
  const weight = { '2026-11-15': 73.1, '2026-11-16': 73.0 };
  assert.deepEqual(firstPaired(fat, weight), { date: '2026-11-16', a: 18.6, b: 73.0 });
});
