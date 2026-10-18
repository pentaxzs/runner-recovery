import { test } from 'node:test';
import assert from 'node:assert/strict';
import { painFreeKm, nextLevel } from '../logic.js';
import { RUN_LADDER } from '../data.js';

const LEN = RUN_LADDER.length;
// level은 그 러닝을 수행한 사다리 칸. 승급 판정이 이걸 본다.
const clean = (km, level = 3) => ({ type: 'run', hadPain: false, distanceKm: km, level });
const hurt = (km, onset, level = 3) => ({ type: 'run', hadPain: true, distanceKm: km, painOnsetKm: onset, level });

test('painFreeKm uses the full distance when there was no pain', () => {
  assert.equal(painFreeKm(clean(3.4)), 3.4);
});

test('painFreeKm uses the onset distance when there was pain', () => {
  assert.equal(painFreeKm(hurt(3.4, 2.1)), 2.1);
});

test('painFreeKm claims nothing when a painful run has no onset', () => {
  // 거리로 대체하면 첫 걸음부터 아팠던 러닝이 최고 기록으로 찍힌다.
  assert.equal(painFreeKm({ type: 'run', hadPain: true, distanceKm: 3.0 }), 0);
});

test('two clean sessions at the current level promote one level', () => {
  const r = nextLevel(3, [clean(2.9, 3), clean(2.9, 3)], LEN);
  assert.equal(r.level, 4);
  assert.equal(r.paused, false);
});

test('a single clean session holds the level', () => {
  assert.equal(nextLevel(3, [hurt(2.9, 2.0, 3), clean(2.9, 3)], LEN).level, 3);
});

test('pain demotes one level', () => {
  assert.equal(nextLevel(4, [clean(3.4, 4), hurt(3.4, 2.2, 4)], LEN).level, 3);
});

test('demotion never goes below level 1', () => {
  assert.equal(nextLevel(1, [hurt(2.0, 1.2, 1)], LEN).level, 1);
});

test('promotion never goes past the top of the ladder', () => {
  assert.equal(nextLevel(LEN, [clean(9, LEN), clean(9, LEN)], LEN).level, LEN);
});

test('three painful sessions in a row pause running', () => {
  const r = nextLevel(4, [hurt(3, 2, 4), hurt(3, 1.9, 4), hurt(3, 1.5, 4)], LEN);
  assert.equal(r.paused, true);
});

test('no sessions holds the level and does not pause', () => {
  const r = nextLevel(2, [], LEN);
  assert.equal(r.level, 2);
  assert.equal(r.paused, false);
});
