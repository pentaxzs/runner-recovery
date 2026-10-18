import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phaseFor, doseFor, PHASES } from '../logic.js';
import { TASKS } from '../data.js';

const byId = (id) => TASKS.find((t) => t.id === id);

// ── 단계 판정 ───────────────────────────────────────────────
test('the low rungs are the early phase', () => {
  for (const lv of [1, 2, 3]) assert.equal(phaseFor(lv, false), 'early');
});

test('the middle rungs are the mid phase', () => {
  for (const lv of [4, 5, 6, 7]) assert.equal(phaseFor(lv, false), 'mid');
});

test('continuous running is the late phase', () => {
  for (const lv of [8, 10, 12]) assert.equal(phaseFor(lv, false), 'late');
});

test('a paused program is always treated as early', () => {
  // 통증으로 러닝을 멈춘 상태에서 중기 처방을 주면 안 된다.
  assert.equal(phaseFor(9, true), 'early');
});

test('every phase has a label and a frequency', () => {
  for (const key of Object.keys(PHASES)) {
    assert.ok(PHASES[key].label, `${key} has no label`);
    assert.ok(PHASES[key].frequency, `${key} has no frequency`);
  }
});

// ── 처방 ────────────────────────────────────────────────────
test('every exercise has a dose with the fields the guide shows', () => {
  for (const t of TASKS) {
    const d = doseFor(t, 'early');
    assert.ok(d.reps, `${t.id} has no reps`);
    assert.ok(d.sets >= 1, `${t.id} has ${d.sets} sets`);
    assert.ok(d.tempo, `${t.id} has no tempo`);
    assert.ok(Number.isFinite(d.restSec), `${t.id} has no rest`);
    assert.ok(d.totalSec > 0, `${t.id} totals ${d.totalSec}s`);
  }
});

test('the mid phase adds a set to the optional work but not to the essentials', () => {
  // 필수 2개는 매일 하는 최소선이라 늘리지 않는다.
  assert.equal(doseFor(byId('clamshell'), 'mid').sets, doseFor(byId('clamshell'), 'early').sets);
  assert.ok(doseFor(byId('side-plank'), 'mid').sets > doseFor(byId('side-plank'), 'early').sets);
});

test('recovery work is never escalated', () => {
  // 폼롤러를 더 오래 하는 건 회복이 아니다.
  for (const phase of ['early', 'mid', 'late']) {
    assert.equal(doseFor(byId('foam'), phase).sets, doseFor(byId('foam'), 'early').sets);
  }
});

test('total time accounts for rest between sets but not after the last one', () => {
  const t = byId('clamshell');
  const d = doseFor(t, 'early');
  assert.equal(d.totalSec, d.sets * t.dose.perSetSec + (d.sets - 1) * d.restSec);
});

test('a provocative exercise carries a caution in the early phase', () => {
  // 스텝다운은 무릎 30도 부근을 지나 장경인대를 자극하기 쉽다.
  assert.ok(doseFor(byId('step-down'), 'early').caution);
  assert.ok(!doseFor(byId('step-down'), 'late').caution);
});

test('an unknown phase falls back to early rather than throwing', () => {
  assert.deepEqual(doseFor(byId('bridge'), 'nonsense'), doseFor(byId('bridge'), 'early'));
});
