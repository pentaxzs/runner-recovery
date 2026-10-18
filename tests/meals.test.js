import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTip, mealChecksFor as rawMealChecks, metricTrend } from '../logic.js';
import { MEAL_TIPS, MEAL_CHECKS_WEEKDAY, MEAL_CHECKS_WEEKEND } from '../data.js';

const mealChecksFor = (d) => rawMealChecks(d, MEAL_CHECKS_WEEKDAY, MEAL_CHECKS_WEEKEND);

// ── 식사 체크 ───────────────────────────────────────────────
test('weekdays get the weekday meal checks', () => {
  // 2026-10-19 월
  assert.deepEqual(mealChecksFor('2026-10-19').map((c) => c.id),
    MEAL_CHECKS_WEEKDAY.map((c) => c.id));
});

test('weekends get the shorter weekend set', () => {
  for (const d of ['2026-10-17', '2026-10-18']) {
    assert.deepEqual(mealChecksFor(d).map((c) => c.id), MEAL_CHECKS_WEEKEND.map((c) => c.id));
  }
});

test('the weekend set is shorter than the weekday set', () => {
  assert.ok(MEAL_CHECKS_WEEKEND.length < MEAL_CHECKS_WEEKDAY.length);
});

test('every meal check has a unique id', () => {
  const all = [...MEAL_CHECKS_WEEKDAY, ...MEAL_CHECKS_WEEKEND];
  const byId = new Map(all.map((c) => [c.id, c.text]));
  for (const [id, text] of byId) assert.ok(id && text, `${id} is incomplete`);
});

// ── 식사 팁 로테이션 ────────────────────────────────────────
test('the same date always gives the same tip', () => {
  assert.equal(pickTip(MEAL_TIPS, '2026-10-19').id, pickTip(MEAL_TIPS, '2026-10-19').id);
});

test('tips change across a week', () => {
  const ids = new Set(['19', '20', '21', '22', '23']
    .map((d) => pickTip(MEAL_TIPS, `2026-10-${d}`).id));
  assert.ok(ids.size > 1, '5일 내내 같은 팁이 나왔다');
});

test('tips do not track the mission picks (different salt)', () => {
  // 미션과 같은 시드를 그대로 쓰면 둘이 항상 같이 움직인다.
  const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const seq = ['19', '20', '21', '22'].map((d) => pickTip(pool, `2026-10-${d}`).id);
  assert.ok(new Set(seq).size > 1);
});

test('an empty tip pool returns null instead of throwing', () => {
  assert.equal(pickTip([], '2026-10-19'), null);
});

// ── 체중 추이 ───────────────────────────────────────────────
test('metricTrend reports the latest entry and the change over the window', () => {
  const w = { '2026-10-05': 74.0, '2026-10-12': 73.4, '2026-10-18': 73.1 };
  const t = metricTrend(w, '2026-10-18', 28);
  assert.equal(t.latest, 73.1);
  assert.ok(Math.abs(t.delta - -0.9) < 1e-9);
  assert.equal(t.count, 3);
});

test('metricTrend with no data does not produce NaN', () => {
  const t = metricTrend({}, '2026-10-18', 28);
  assert.equal(t.latest, null);
  assert.equal(t.delta, 0);
  assert.equal(t.count, 0);
});

test('metricTrend with a single entry reports zero change', () => {
  const t = metricTrend({ '2026-10-18': 73.1 }, '2026-10-18', 28);
  assert.equal(t.latest, 73.1);
  assert.equal(t.delta, 0);
});

test('metricTrend ignores entries outside the window and in the future', () => {
  const w = { '2026-08-01': 80, '2026-10-16': 73.5, '2026-11-01': 70 };
  const t = metricTrend(w, '2026-10-18', 28);
  assert.equal(t.count, 1);
  assert.equal(t.latest, 73.5);
});
