import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cheerStage, pickCheer } from '../logic.js';

// ── 어떤 말을 할 차례인가 ───────────────────────────────────
test('with more than one left, the cheer is plain progress', () => {
  assert.equal(cheerStage(1, 3), 'progress');
});

test('one short of the total is its own moment', () => {
  assert.equal(cheerStage(2, 3), 'almost');
});

test('filling the last one is the payoff', () => {
  assert.equal(cheerStage(3, 3), 'complete');
});

// 토요일은 필수가 선택이라 할 일이 0개일 수 있다. 셀 게 없으면 말도 없다.
test('nothing to fill means nothing to say', () => {
  assert.equal(cheerStage(0, 0), null);
  assert.equal(cheerStage(1, 0), null);
});

test('a single item goes straight from almost to complete', () => {
  assert.equal(cheerStage(0, 1), 'almost');
  assert.equal(cheerStage(1, 1), 'complete');
});

// ── 같은 말이 연달아 나오지 않게 ────────────────────────────
test('pickCheer returns an item and the index it came from', () => {
  const pool = ['a', 'b', 'c'];
  const got = pickCheer(pool, () => 0, -1);
  assert.equal(got.cheer, 'a');
  assert.equal(got.index, 0);
});

test('the previous pick is never repeated back to back', () => {
  const pool = ['a', 'b', 'c'];
  // rand가 0을 돌려줘 'a'를 가리켜도, 직전이 'a'였으면 다른 걸 준다.
  const got = pickCheer(pool, () => 0, 0);
  assert.notEqual(got.index, 0);
});

test('every slot is still reachable across many picks', () => {
  const pool = ['a', 'b', 'c', 'd'];
  const seen = new Set();
  let last = -1;
  for (let i = 0; i < 200; i++) {
    const got = pickCheer(pool, Math.random, last);
    assert.notEqual(got.index, last);
    last = got.index;
    seen.add(got.cheer);
  }
  assert.equal(seen.size, 4);
});

// 풀이 하나뿐이면 반복을 피할 방법이 없다. 아무것도 안 주는 것보다 낫다.
test('a one-item pool repeats rather than going silent', () => {
  const got = pickCheer(['only'], Math.random, 0);
  assert.equal(got.cheer, 'only');
  assert.equal(got.index, 0);
});

test('an empty pool yields nothing', () => {
  assert.equal(pickCheer([], Math.random, -1), null);
  assert.equal(pickCheer(null, Math.random, -1), null);
});

// rand가 1.0을 돌려줘도 배열 밖을 가리키지 않아야 한다.
test('a rand of exactly 1 stays inside the pool', () => {
  const got = pickCheer(['a', 'b', 'c'], () => 1, -1);
  assert.ok(got.index >= 0 && got.index < 3);
  assert.ok(got.cheer);
});

// ── 명언은 하루에 하나 ──────────────────────────────────────
import { pickTip } from '../logic.js';

test('the same day gives the same quote however often you look', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const first = pickTip(pool, '2026-10-18', 'quote:');
  for (let i = 0; i < 20; i++) {
    assert.equal(pickTip(pool, '2026-10-18', 'quote:'), first);
  }
});

test('the quote salt does not track the meal tip', () => {
  // 소금을 안 주면 그날의 식사 팁과 같은 자리를 집어, 두 문구가 늘 붙어 다닌다.
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const days = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'];
  const same = days.filter((d) => pickTip(pool, d) === pickTip(pool, d, 'quote:')).length;
  assert.ok(same < days.length, '두 시드가 매일 같은 항목을 고르면 소금이 듣지 않는 것');
});

test('quotes move across days', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const seen = new Set();
  for (let d = 1; d <= 28; d++) {
    seen.add(pickTip(pool, `2026-11-${String(d).padStart(2, '0')}`, 'quote:'));
  }
  assert.ok(seen.size >= 6, `28일 동안 ${seen.size}종류만 나왔다`);
});
