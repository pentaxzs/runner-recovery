import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  goalProgress, bodyTargets, habitSummary, monthDaysSoFar, plannedRunDaysIn,
} from '../logic.js';

// ── 시작에서 목표까지 얼마나 왔나 ───────────────────────────
// 줄여야 하는 값에 목표÷현재를 쓰면 아무 의미가 없다. 시작점이 있어야
// "얼마나 왔나"를 말할 수 있다.
test('a shrinking metric measures distance travelled from the start', () => {
  const p = goalProgress(20.1, 18.6, 13.6);
  assert.ok(Math.abs(p - 0.2308) < 0.001, `${p}`);
});

test('a growing metric uses the same formula', () => {
  assert.equal(goalProgress(0, 1.8, 2), 0.9);
});

test('reaching the target is one, never more', () => {
  assert.equal(goalProgress(20.1, 13.6, 13.6), 1);
  assert.equal(goalProgress(20.1, 11.0, 13.6), 1);
});

test('going the wrong way floors at zero, never negative', () => {
  assert.equal(goalProgress(20.1, 21.5, 13.6), 0);
});

test('a target equal to the start cannot be measured', () => {
  assert.equal(goalProgress(13.6, 13.6, 13.6), null);
});

test('missing numbers yield null, not NaN', () => {
  assert.equal(goalProgress(null, 18.6, 13.6), null);
  assert.equal(goalProgress(20.1, undefined, 13.6), null);
  assert.equal(goalProgress(20.1, 18.6, NaN), null);
});

// ── 체지방률 하나에서 나머지를 역산 ─────────────────────────
// 넷을 따로 정하면 서로 모순되는 목표가 나온다. 제지방량은 지키는 값이므로
// 거기에 목표 비율을 붙여 체지방량과 체중을 끌어낸다.
test('one target percentage produces the other two', () => {
  const t = bodyTargets(73.1, 18.6, 20);
  assert.equal(t.leanKg, 54.5);
  assert.equal(t.fatKg, 13.6);
  assert.equal(t.weightKg, 68.1);
});

test('the derived numbers actually hit the percentage', () => {
  const t = bodyTargets(73.1, 18.6, 20);
  assert.ok(Math.abs((t.fatKg / t.weightKg) * 100 - 20) < 0.2);
});

test('already under the target still computes', () => {
  const t = bodyTargets(68, 12, 20);
  assert.ok(t.fatKg > 12, '목표가 현재보다 위면 그대로 돌려준다');
});

test('bodyTargets refuses impossible input', () => {
  assert.equal(bodyTargets(73.1, 80, 20), null, '체지방이 체중보다 많다');
  assert.equal(bodyTargets(null, 18.6, 20), null);
  assert.equal(bodyTargets(73.1, 18.6, 0), null);
  assert.equal(bodyTargets(73.1, 18.6, 100), null);
});

// ── 습관 요약 ───────────────────────────────────────────────
test('habitSummary totals what was done against what was offered', () => {
  const s = habitSummary([
    { date: '2026-11-13', done: 4, possible: 8 },
    { date: '2026-11-14', done: 7, possible: 7 },
  ]);
  assert.equal(s.done, 11);
  assert.equal(s.possible, 15);
  assert.ok(Math.abs(s.rate - 11 / 15) < 1e-9);
});

// 농도는 다섯 단계. 하나도 안 한 날과 한 개라도 한 날은 반드시 달라야 한다.
test('a day with nothing is level zero and one check is not', () => {
  const s = habitSummary([{ date: 'a', done: 0, possible: 8 }, { date: 'b', done: 1, possible: 8 }]);
  assert.equal(s.levels[0].level, 0);
  assert.ok(s.levels[1].level >= 1);
});

test('a full day is the top level', () => {
  const s = habitSummary([{ date: 'a', done: 8, possible: 8 }]);
  assert.equal(s.levels[0].level, 4);
});

test('a day that offered nothing is level zero, not a crash', () => {
  const s = habitSummary([{ date: 'a', done: 0, possible: 0 }]);
  assert.equal(s.levels[0].level, 0);
  assert.equal(s.rate, 0);
});

test('an empty month yields zero, not NaN', () => {
  const s = habitSummary([]);
  assert.equal(s.rate, 0);
  assert.equal(s.possible, 0);
});

// ── 이번 달 ─────────────────────────────────────────────────
test('monthDaysSoFar runs from the first to today', () => {
  const d = monthDaysSoFar('2026-11-15');
  assert.equal(d.length, 15);
  assert.equal(d[0], '2026-11-01');
  assert.equal(d[14], '2026-11-15');
});

test('the first of the month is a single day', () => {
  assert.deepEqual(monthDaysSoFar('2026-11-01'), ['2026-11-01']);
});

// 월 목표는 계획한 요일이 그 달에 몇 번 오는지로 정해진다. 4.3주를 곱하면
// 달마다 어긋난다.
test('plannedRunDaysIn counts the planned weekdays plus every Sunday', () => {
  // 2026-11: 화요일 4번(3,10,17,24), 목요일 4번(5,12,19,26), 일요일 5번(1,8,15,22,29)
  assert.equal(plannedRunDaysIn('2026-11-15', [2, 4]), 13);
});

test('an empty plan still counts Sundays', () => {
  assert.equal(plannedRunDaysIn('2026-11-15', []), 5);
});

test('Saturday never counts even if it is in the plan', () => {
  assert.equal(plannedRunDaysIn('2026-11-15', [6]), 5);
});
