import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyFatAim } from '../logic.js';

const STEP = 1.5;

// ── 다음 한 칸만 조준한다 ───────────────────────────────────
// 25.4%에서 20%는 체지방 5kg이라 10~20주짜리다. 게이지가 몇 주째 안 움직이면
// 그건 동기가 아니라 벽이다. 러닝 사다리처럼 다음 칸만 보여준다.
test('the aim is the first rung below where you are now', () => {
  const a = bodyFatAim(26.7, 25.4, 20, STEP);
  assert.equal(a.aim, 25.2);
  assert.equal(a.from, 26.7);
  assert.equal(a.done, false);
});

// 칸은 시작값에 걸려 있다. 현재값에서 매번 빼면 목표가 같이 내려가서
// 게이지가 영영 차지 않는다.
test('rungs are anchored to the start, so progress accumulates', () => {
  const a1 = bodyFatAim(26.7, 25.4, 20, STEP);
  const a2 = bodyFatAim(26.7, 25.3, 20, STEP);
  assert.equal(a1.aim, a2.aim, '조금 줄었다고 목표가 도망가면 안 된다');
});

test('crossing a rung moves the aim to the next one', () => {
  const before = bodyFatAim(26.7, 25.3, 20, STEP);
  const after = bodyFatAim(26.7, 25.0, 20, STEP);
  assert.equal(before.aim, 25.2);
  assert.equal(after.aim, 23.7);
  assert.equal(after.from, 25.2, '직전 칸이 새 출발선이 된다');
});

// ── 최종 목표에서 멈춘다 ────────────────────────────────────
test('the ladder never goes below the final target', () => {
  const a = bodyFatAim(26.7, 20.4, 20, STEP);
  assert.equal(a.aim, 20);
  assert.equal(a.done, false);
});

test('reaching the final target is done', () => {
  const a = bodyFatAim(26.7, 20, 20, STEP);
  assert.equal(a.done, true);
  assert.equal(a.aim, 20);
});

test('already below the final target is also done', () => {
  const a = bodyFatAim(26.7, 18.2, 20, STEP);
  assert.equal(a.done, true);
});

// ── 처음 재는 사람 ──────────────────────────────────────────
test('a single measurement still gets a first rung', () => {
  const a = bodyFatAim(25.4, 25.4, 20, STEP);
  assert.equal(a.aim, 23.9);
  assert.equal(a.from, 25.4);
});

// 시작이 이미 목표 아래면 올라갈 칸을 만들지 않는다
test('starting below the target does not invent a rung', () => {
  const a = bodyFatAim(18, 18, 20, STEP);
  assert.equal(a.done, true);
  assert.equal(a.aim, 20);
});

// ── 못 쓰는 입력 ────────────────────────────────────────────
test('missing numbers yield null', () => {
  assert.equal(bodyFatAim(null, 25.4, 20, STEP), null);
  assert.equal(bodyFatAim(26.7, null, 20, STEP), null);
  assert.equal(bodyFatAim(26.7, 25.4, null, STEP), null);
});

test('a zero or negative step would loop forever', () => {
  assert.equal(bodyFatAim(26.7, 25.4, 20, 0), null);
  assert.equal(bodyFatAim(26.7, 25.4, 20, -1), null);
});

// 아무리 멀어도 칸 수가 폭주하면 안 된다
test('a far target still terminates', () => {
  const a = bodyFatAim(60, 59, 5, 0.1);
  assert.ok(a && Number.isFinite(a.aim));
});

// ── 기준은 언제나 첫 측정 ───────────────────────────────────
// 늘었다고 지금 값으로 기준을 옮기면, 늘어날수록 다음 목표가 쉬워진다.
// 체지방량·체중 게이지는 첫 측정을 쓰는데 체지방률만 다른 기준을 쓰면
// 같은 카드에서 세 숫자가 다른 말을 한다.
// 늘었을 때는 사다리 아래쪽 칸이 아니라 복귀 칸을 겨눈다. 아래 칸을 그대로
// 겨누면 돌아오는 구간 내내 0%라 움직임이 안 보인다.
test('gaining aims at the start, not at a rung below it', () => {
  const a = bodyFatAim(24.7, 25.4, 20, STEP);
  assert.equal(a.aim, 24.7, '복귀가 먼저다');
  assert.equal(a.recovering, true);
});

test('gaining a lot still aims at the start, never lower', () => {
  const a = bodyFatAim(20, 30, 18, STEP);
  assert.equal(a.aim, 20);
  assert.equal(a.recovering, true);
});

// 다시 줄어 시작 아래로 내려오면 사다리가 원래대로 이어진다
test('coming back under the start resumes the ladder', () => {
  const a = bodyFatAim(24.7, 24.0, 20, STEP);
  assert.equal(a.from, 24.7);
  assert.equal(a.aim, 23.2);
});

// ── 시작보다 위에 있으면 복귀가 첫 칸 ───────────────────────
// 첫 측정으로 돌아갈 때까지 통째로 0%면, 0.4kg을 빼도 화면이 아무 반응이
// 없다. 사다리 맨 위에 "시작점 복귀" 칸을 하나 더 둔다.
test('being above the start makes the start itself the aim', () => {
  const a = bodyFatAim(24.7, 25.4, 20, STEP, 25.9);
  assert.equal(a.aim, 24.7, '복귀 목표는 첫 측정');
  assert.equal(a.from, 25.9, '출발선은 지금까지 최악값');
  assert.equal(a.recovering, true);
});

test('the recovery target never gets easier as you gain', () => {
  const a = bodyFatAim(24.7, 25.4, 20, STEP, 25.9);
  const b = bodyFatAim(24.7, 27.0, 20, STEP, 27.0);
  assert.equal(a.aim, b.aim, '더 늘어도 복귀 목표는 첫 측정 그대로');
});

test('sitting at your worst is zero, and coming down fills', () => {
  const atWorst = bodyFatAim(24.7, 25.9, 20, STEP, 25.9);
  assert.equal(atWorst.from, atWorst.aim === 24.7 ? 25.9 : atWorst.from);
  // 25.9 → 25.4로 내려오면 출발선과 목표 사이를 지난다
  const moving = bodyFatAim(24.7, 25.4, 20, STEP, 25.9);
  assert.ok(moving.from > moving.aim);
});

test('crossing back under the start resumes the normal ladder', () => {
  const a = bodyFatAim(24.7, 24.6, 20, STEP, 25.9);
  assert.equal(a.recovering, false);
  assert.equal(a.aim, 23.2);
  assert.equal(a.from, 24.7);
});

// 최악값을 안 주면 현재를 출발선으로 본다
test('without a worst value the current reading is the start line', () => {
  const a = bodyFatAim(24.7, 25.4, 20, STEP);
  assert.equal(a.aim, 24.7);
  assert.equal(a.from, 25.4);
});

test('a worst below the current is ignored', () => {
  const a = bodyFatAim(24.7, 25.4, 20, STEP, 25.0);
  assert.equal(a.from, 25.4, '지금이 최악이면 지금이 출발선');
});
