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
test('pickCheer returns an item from the pool', () => {
  assert.equal(pickCheer(['a', 'b', 'c'], () => 0, null), 'a');
});

// 직전 '값'을 피한다. 인덱스로 기억하면 풀이 걸러졌을 때 다른 걸 가리킨다.
test('the previous pick is never repeated back to back', () => {
  assert.notEqual(pickCheer(['a', 'b', 'c'], () => 0, 'a'), 'a');
});

test('every item is still reachable across many picks', () => {
  const pool = ['a', 'b', 'c', 'd'];
  const seen = new Set();
  let last = null;
  for (let i = 0; i < 200; i++) {
    const got = pickCheer(pool, Math.random, last);
    assert.notEqual(got, last);
    last = got;
    seen.add(got);
  }
  assert.equal(seen.size, 4);
});

// 풀이 하나뿐이면 반복을 피할 방법이 없다. 아무것도 안 주는 것보다 낫다.
test('a one-item pool repeats rather than going silent', () => {
  assert.equal(pickCheer(['only'], Math.random, 'only'), 'only');
});

test('an empty pool yields nothing', () => {
  assert.equal(pickCheer([], Math.random, null), null);
  assert.equal(pickCheer(null, Math.random, null), null);
});

// rand가 1.0을 돌려줘도 배열 밖을 가리키지 않아야 한다.
test('a rand of exactly 1 stays inside the pool', () => {
  assert.ok(['a', 'b', 'c'].includes(pickCheer(['a', 'b', 'c'], () => 1, null)));
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

// ── 맥락에 안 맞는 문구는 아예 후보에서 빠진다 ──────────────
import { cheersAt } from '../logic.js';

const POOL = [
  { emoji: '🔥', text: '언제나' },
  { emoji: '🌙', text: '늦은 시간에도 왔군요', after: 21 },
  { emoji: '☀️', text: '아침부터', before: 9 },
  { emoji: '👊', text: '시작이 반입니다', first: true },
];

test('a night line does not show up in the afternoon', () => {
  const texts = cheersAt(POOL, { hour: 14, done: 1 }).map((c) => c.text);
  assert.ok(!texts.includes('늦은 시간에도 왔군요'));
});

test('the night line is available late', () => {
  const texts = cheersAt(POOL, { hour: 22, done: 1 }).map((c) => c.text);
  assert.ok(texts.includes('늦은 시간에도 왔군요'));
});

test('21:00 counts as late — the hour it names is included', () => {
  assert.ok(cheersAt(POOL, { hour: 21, done: 1 }).some((c) => c.after === 21));
});

test('a morning line stays in the morning', () => {
  assert.ok(cheersAt(POOL, { hour: 7, done: 1 }).some((c) => c.before === 9));
  assert.ok(!cheersAt(POOL, { hour: 9, done: 1 }).some((c) => c.before === 9));
});

// "시작이 반"은 오늘의 첫 체크에서만 참이다
test('a first-check line only fires on the first check', () => {
  assert.ok(cheersAt(POOL, { hour: 14, done: 1 }).some((c) => c.first));
  assert.ok(!cheersAt(POOL, { hour: 14, done: 2 }).some((c) => c.first));
});

test('lines without conditions always survive', () => {
  for (const hour of [0, 9, 14, 21, 23]) {
    for (const done of [1, 2, 3]) {
      assert.ok(cheersAt(POOL, { hour, done }).some((c) => c.text === '언제나'));
    }
  }
});

// 조건을 너무 좁게 걸어 아무것도 안 남으면 응원이 사라진다. 그런 일이
// 없도록 조건 없는 문구는 항상 남아야 한다.
test('the filter never empties a pool that has unconditional lines', () => {
  for (const hour of [0, 6, 12, 18, 23]) {
    assert.ok(cheersAt(POOL, { hour, done: 5 }).length > 0);
  }
});
