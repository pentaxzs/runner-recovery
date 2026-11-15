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
