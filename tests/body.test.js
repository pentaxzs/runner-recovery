import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  metricTrend, countCheckDays, bodyFatPercent, bodyVerdict, BODY_NOISE_KG,
} from '../logic.js';

// ── 측정 추이 (체중·골격근량·체지방량 공용) ─────────────────
test('metricTrend works for any numeric series, not just weight', () => {
  const fat = { '2026-09-20': 20.1, '2026-10-05': 19.3, '2026-10-18': 18.6 };
  const t = metricTrend(fat, '2026-10-18', 56);
  assert.equal(t.latest, 18.6);
  assert.ok(Math.abs(t.delta - -1.5) < 1e-9);
  assert.equal(t.count, 3);
});

test('an empty series yields no NaN', () => {
  const t = metricTrend({}, '2026-10-18', 28);
  assert.equal(t.latest, null);
  assert.equal(t.delta, 0);
  assert.equal(t.count, 0);
});

test('entries outside the window are ignored', () => {
  const t = metricTrend({ '2026-01-01': 95, '2026-10-17': 86 }, '2026-10-18', 28);
  assert.equal(t.count, 1);
  assert.equal(t.delta, 0);
});

// 체지방량 kg에는 90cm 같은 임상 기준선이 없다. 의미를 주는 건 자기 첫
// 측정값뿐이므로, 체성분 추이는 창을 두지 않고 전체 기록을 본다.
test('metricTrend without a window measures against the very first entry', () => {
  const fat = { '2026-01-01': 22.4, '2026-09-20': 20.1, '2026-10-18': 18.6 };
  const t = metricTrend(fat, '2026-10-18', null);
  assert.equal(t.first, 22.4);
  assert.equal(t.latest, 18.6);
  assert.ok(Math.abs(t.delta - -3.8) < 1e-9);
  assert.equal(t.count, 3);
});

test('a windowless trend still ignores entries in the future', () => {
  const t = metricTrend({ '2026-10-18': 18.6, '2026-12-25': 17.0 }, '2026-10-18', null);
  assert.equal(t.count, 1);
  assert.equal(t.latest, 18.6);
});

// ── 체지방률은 계산값 ───────────────────────────────────────
// 인바디 결과지에 찍혀 나오지만 체지방량÷체중이라 두 번 적을 이유가 없다.
test('bodyFatPercent is derived from fat mass and weight', () => {
  assert.equal(bodyFatPercent(18.6, 73.1), 25.4);
});

test('bodyFatPercent needs both numbers', () => {
  assert.equal(bodyFatPercent(18.6, null), null);
  assert.equal(bodyFatPercent(null, 73.1), null);
  assert.equal(bodyFatPercent(18.6, 0), null);
});

// ── 체지방량이 추세선, 골격근량이 대조군 ────────────────────
test('fat down on its own is the result we want', () => {
  const fat = { '2026-09-20': 20.1, '2026-10-18': 18.6 };
  const muscle = { '2026-09-20': 32.0, '2026-10-18': 32.1 };
  const v = bodyVerdict(metricTrend(fat, '2026-10-18', null), metricTrend(muscle, '2026-10-18', null));
  assert.equal(v, 'fat-down');
});

test('fat and muscle falling together means the deficit is eating muscle', () => {
  const fat = { '2026-09-20': 20.1, '2026-10-18': 18.6 };
  const muscle = { '2026-09-20': 32.0, '2026-10-18': 31.0 };
  const v = bodyVerdict(metricTrend(fat, '2026-10-18', null), metricTrend(muscle, '2026-10-18', null));
  assert.equal(v, 'fat-down-muscle-down');
});

test('fat going up is reported as such', () => {
  const fat = { '2026-09-20': 18.6, '2026-10-18': 20.1 };
  const v = bodyVerdict(metricTrend(fat, '2026-10-18', null), metricTrend({}, '2026-10-18', null));
  assert.equal(v, 'fat-up');
});

// 생체전기저항은 수분에 흔들린다. 눈금 아래의 움직임을 변화라고 부르면
// 매주 없는 신호를 쫓게 된다.
test('a change smaller than the measurement noise is called flat', () => {
  const fat = { '2026-09-20': 18.6, '2026-10-18': 18.4 };
  assert.ok(0.2 < BODY_NOISE_KG);
  const v = bodyVerdict(metricTrend(fat, '2026-10-18', null), metricTrend({}, '2026-10-18', null));
  assert.equal(v, 'flat');
});

test('one measurement is not a trend', () => {
  const fat = { '2026-10-18': 18.6 };
  assert.equal(bodyVerdict(metricTrend(fat, '2026-10-18', null), metricTrend({}, '2026-10-18', null)), null);
  assert.equal(bodyVerdict(metricTrend({}, '2026-10-18', null), metricTrend({}, '2026-10-18', null)), null);
});

// ── 식사 실행률 ─────────────────────────────────────────────
test('countCheckDays counts only the days that have the check', () => {
  const checks = {
    '2026-10-15': ['m-late', 'clamshell'],
    '2026-10-16': ['clamshell'],
    '2026-10-17': ['m-late'],
  };
  const dates = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
  assert.equal(countCheckDays(checks, 'm-late', dates), 2);
});

test('countCheckDays is zero when nothing matches', () => {
  assert.equal(countCheckDays({}, 'm-late', ['2026-10-18']), 0);
});
