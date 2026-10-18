import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pullProgress, shouldRefresh, PULL_THRESHOLD } from '../logic.js';

test('no pull means no progress', () => {
  assert.equal(pullProgress(0), 0);
});

test('an upward drag never counts as a pull', () => {
  // 위로 미는 건 평범한 스크롤이다.
  assert.equal(pullProgress(-120), 0);
  assert.equal(shouldRefresh(-120), false);
});

test('progress rises with the drag and is clamped at 1', () => {
  assert.ok(pullProgress(PULL_THRESHOLD / 2) > 0.2);
  assert.equal(pullProgress(PULL_THRESHOLD), 1);
  assert.equal(pullProgress(PULL_THRESHOLD * 5), 1);
});

test('progress never exceeds 1 so the indicator cannot run off', () => {
  for (const dy of [0, 10, 200, 2000]) {
    const p = pullProgress(dy);
    assert.ok(p >= 0 && p <= 1, `progress ${p} out of range for ${dy}`);
  }
});

test('release refreshes only past the threshold', () => {
  assert.equal(shouldRefresh(PULL_THRESHOLD - 1), false);
  assert.equal(shouldRefresh(PULL_THRESHOLD), true);
  assert.equal(shouldRefresh(PULL_THRESHOLD + 80), true);
});

test('a tiny accidental drag does not refresh', () => {
  assert.equal(shouldRefresh(8), false);
});
