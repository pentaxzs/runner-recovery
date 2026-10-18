import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStepsValue, MAX_STEPS } from '../logic.js';

test('a plain number is accepted', () => {
  assert.equal(parseStepsValue('9240'), 9240);
});

test('clipboard text from Shortcuts is accepted', () => {
  // 단축어가 복사하는 값은 쉼표나 단위를 달고 올 수 있다.
  assert.equal(parseStepsValue('9,240'), 9240);
  assert.equal(parseStepsValue('9240 걸음'), 9240);
  assert.equal(parseStepsValue(' 9240\n'), 9240);
});

test('a decimal is rounded', () => {
  assert.equal(parseStepsValue('9240.6'), 9241);
});

test('junk is rejected', () => {
  for (const bad of ['', '   ', 'abc', '걸음 9240', '-5', '1e9', null, undefined]) {
    assert.equal(parseStepsValue(bad), null, `expected null for ${bad}`);
  }
});

test('an implausible count is rejected', () => {
  assert.equal(parseStepsValue(String(MAX_STEPS + 1)), null);
  assert.equal(parseStepsValue(String(MAX_STEPS)), MAX_STEPS);
});

test('zero is a real value, not junk', () => {
  // 하루 종일 안 걸은 날도 기록할 수 있어야 한다.
  assert.equal(parseStepsValue('0'), 0);
});
