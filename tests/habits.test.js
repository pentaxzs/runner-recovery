import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countChecks, countAnyCheckDays, countCheckDays } from '../logic.js';

const DATES = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'];
const CHECKS = {
  '2026-10-25': ['sub-1', 'desk-2', 'm-late'],
  '2026-10-26': ['m-late'],
  '2026-10-27': ['home-1', 'clamshell'],
  '2026-10-28': ['sub-3', 'desk-1', 'out-2', 'm-late'],
};

// ── 몇 개를 했나 ────────────────────────────────────────────
// 자투리는 하루에 셋까지 할 수 있어서 '며칠'이 아니라 '몇 개'가 맞는 단위다.
test('countChecks adds up every matching check, not days', () => {
  const missionIds = ['sub-1', 'sub-3', 'desk-1', 'desk-2', 'home-1', 'out-2'];
  assert.equal(countChecks(CHECKS, missionIds, DATES), 6);
});

test('countChecks ignores ids that are not asked for', () => {
  assert.equal(countChecks(CHECKS, ['clamshell'], DATES), 1);
});

test('countChecks ignores days outside the window', () => {
  assert.equal(countChecks(CHECKS, ['m-late'], ['2026-10-26']), 1);
});

test('an empty id list counts nothing', () => {
  assert.equal(countChecks(CHECKS, [], DATES), 0);
  assert.equal(countChecks(CHECKS, null, DATES), 0);
});

test('a missing checks map counts nothing', () => {
  assert.equal(countChecks({}, ['sub-1'], DATES), 0);
  assert.equal(countChecks(null, ['sub-1'], DATES), 0);
});

// ── 며칠이나 했나 ───────────────────────────────────────────
// 추가 운동은 그날 뭘 했든 '한 날'로 세는 게 읽기 쉽다.
test('countAnyCheckDays counts a day once however many matched', () => {
  const missionIds = ['sub-1', 'sub-3', 'desk-1', 'desk-2', 'home-1', 'out-2'];
  // 10-25에 둘, 10-28에 셋을 했어도 각각 하루다
  assert.equal(countAnyCheckDays(CHECKS, missionIds, DATES), 3);
});

test('countAnyCheckDays is zero when nothing matches', () => {
  assert.equal(countAnyCheckDays(CHECKS, ['plank'], DATES), 0);
});

test('countAnyCheckDays handles empty inputs', () => {
  assert.equal(countAnyCheckDays(CHECKS, [], DATES), 0);
  assert.equal(countAnyCheckDays(null, ['sub-1'], DATES), 0);
  assert.equal(countAnyCheckDays(CHECKS, ['sub-1'], []), 0);
});

// 기존 함수와 어긋나지 않아야 한다 — 하나짜리 목록은 같은 답을 준다
test('one id agrees with countCheckDays', () => {
  assert.equal(countAnyCheckDays(CHECKS, ['m-late'], DATES), countCheckDays(CHECKS, 'm-late', DATES));
});
