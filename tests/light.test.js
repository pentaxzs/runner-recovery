import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextLevel } from '../logic.js';
import { RUN_LADDER } from '../data.js';

const LEN = RUN_LADDER.length;
const clean = (level) => ({ type: 'run', hadPain: false, distanceKm: 2, level });
const light = (level) => ({ type: 'run', hadPain: false, distanceKm: 1, level, light: true });
const hurt = (level) => ({ type: 'run', hadPain: true, distanceKm: 2, painOnsetKm: 1, level });

test('a light session does not count toward promotion', () => {
  // 줄인 볼륨으로 승급하면 사다리가 거짓말을 한다.
  assert.equal(nextLevel(2, [clean(2), light(2)], LEN).level, 2);
});

test('two light sessions still do not promote', () => {
  assert.equal(nextLevel(2, [light(2), light(2)], LEN).level, 2);
});

test('a light session does not reset progress toward promotion either', () => {
  // 가볍게 한 날이 그 전의 깨끗한 러닝을 무효로 만들면 안 된다.
  assert.equal(nextLevel(2, [clean(2), light(2), clean(2)], LEN).level, 3);
});

test('pain on a light session still demotes', () => {
  assert.equal(nextLevel(4, [{ ...hurt(4), light: true }], LEN).level, 3);
});

test('three painful sessions pause even if some were light', () => {
  const runs = [hurt(4), { ...hurt(4), light: true }, hurt(3)];
  assert.equal(nextLevel(3, runs, LEN).paused, true);
});

test('full sessions alone still promote normally', () => {
  assert.equal(nextLevel(2, [clean(2), clean(2)], LEN).level, 3);
});
