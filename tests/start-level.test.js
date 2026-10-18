import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startingLevel, MAX_START_LEVEL } from '../logic.js';
import { RUN_LADDER } from '../data.js';

test('no pain distance starts at level 1', () => {
  assert.equal(startingLevel(0, RUN_LADDER), 1);
  assert.equal(startingLevel(NaN, RUN_LADDER), 1);
  assert.equal(startingLevel(undefined, RUN_LADDER), 1);
});

test('a short pain distance starts at level 1', () => {
  assert.equal(startingLevel(1.2, RUN_LADDER), 1);
});

test('the start is capped so nobody begins mid-ladder', () => {
  // 복귀 초기에는 낮게 시작해 사다리가 올려주는 편이 안전하다.
  assert.equal(startingLevel(2.8, RUN_LADDER), MAX_START_LEVEL);
  assert.equal(startingLevel(8.0, RUN_LADDER), MAX_START_LEVEL);
  assert.equal(startingLevel(50, RUN_LADDER), MAX_START_LEVEL);
});

test('the cap is low enough to stay in the one-minute interval range', () => {
  const entry = RUN_LADDER[MAX_START_LEVEL - 1];
  assert.ok(entry.runMin <= 1, `start level runs ${entry.runMin}분 continuously`);
});

test('a negative distance is treated as unknown', () => {
  assert.equal(startingLevel(-3, RUN_LADDER), 1);
});
