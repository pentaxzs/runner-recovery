import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceTimer } from '../logic.js';

const plan = { runSec: 60, walkSec: 120, continueSets: false };
const at = (phase, left) => ({ phase, left, ...plan });

// ── 한 구간 안에서 ──────────────────────────────────────────
test('time comes off the current phase', () => {
  const s = advanceTimer(at('run', 60), 5);
  assert.equal(s.phase, 'run');
  assert.equal(s.left, 55);
  assert.equal(s.completedSet, false);
});

// ── 뛰기가 끝나면 멈추지 않고 걷기로 ────────────────────────
test('running rolls straight into walking', () => {
  const s = advanceTimer(at('run', 3), 3);
  assert.equal(s.phase, 'walk');
  assert.equal(s.left, 120);
  assert.equal(s.completedSet, false);
});

// 화면이 잠기거나 탭이 가려지면 한 번에 긴 시간이 들어온다. 넘친 만큼은
// 다음 구간에서 빠져야 실제 경과와 어긋나지 않는다.
test('an overshoot carries into the walk instead of being lost', () => {
  const s = advanceTimer(at('run', 2), 10);
  assert.equal(s.phase, 'walk');
  assert.equal(s.left, 112);
});

// ── 마지막 세트의 걷기가 끝나면 거기서 선다 ─────────────────
test('finishing the last walk ends the set and stops', () => {
  const s = advanceTimer(at('walk', 4), 4);
  assert.equal(s.phase, 'rest');
  assert.equal(s.left, 0);
  assert.equal(s.completedSet, true);
});

test('overshooting the walk still stops at zero, not below', () => {
  const s = advanceTimer(at('walk', 2), 90);
  assert.equal(s.phase, 'rest');
  assert.equal(s.left, 0);
  assert.equal(s.completedSet, true);
});

// 한 세트는 뛰기 하나 걷기 하나다. 아무리 긴 시간이 한 번에 들어와도
// 두 세트가 올라가면 안 된다 — 다음 세트는 직접 눌러서 시작한다.
test('one long tick never banks more than one set', () => {
  const s = advanceTimer(at('run', 60), 3600);
  assert.equal(s.phase, 'rest');
  assert.equal(s.completedSet, true);
});

// ── 안 도는 상태 ────────────────────────────────────────────
test('a stopped timer ignores the clock', () => {
  for (const phase of ['rest', 'idle']) {
    const s = advanceTimer(at(phase, 0), 30);
    assert.equal(s.phase, phase);
    assert.equal(s.left, 0);
    assert.equal(s.completedSet, false);
  }
});

test('a tick of zero changes nothing', () => {
  const s = advanceTimer(at('run', 41), 0);
  assert.equal(s.phase, 'run');
  assert.equal(s.left, 41);
});

// 시계가 뒤로 가는 기기가 있다. 음수가 들어와도 시간이 늘어나면 안 된다.
test('a negative tick does not hand back time', () => {
  const s = advanceTimer(at('run', 41), -10);
  assert.equal(s.left, 41);
});

// ── 세트는 쭉 이어진다 ──────────────────────────────────────
// 세트 사이에 서는 건 통증 때문에 끊을 자리를 만들려던 것이었는데, 이제
// 멈추기가 그 일을 한다. 남은 세트가 있으면 걷기 끝에서 다음 뛰기로 넘어간다.
const chained = (phase, left) => ({ phase, left, runSec: 60, walkSec: 120, continueSets: true });

test('with sets left, the walk rolls into the next run', () => {
  const s = advanceTimer(chained('walk', 4), 4);
  assert.equal(s.phase, 'run');
  assert.equal(s.left, 60);
  assert.equal(s.completedSet, true);
});

test('the overshoot carries into the next set too', () => {
  const s = advanceTimer(chained('walk', 2), 9);
  assert.equal(s.phase, 'run');
  assert.equal(s.left, 53);
  assert.equal(s.completedSet, true);
});

// 한 번의 경과로 세트가 둘 오르면 안 된다. 화면이 오래 잠겨 있었다고 해서
// 하지 않은 세트가 기록되는 건 거짓이다.
test('even when chaining, one tick banks at most one set', () => {
  const s = advanceTimer(chained('walk', 5), 3600);
  assert.equal(s.completedSet, true);
  assert.equal(s.phase, 'rest');
});

test('chaining does not change how a run becomes a walk', () => {
  const s = advanceTimer(chained('run', 3), 3);
  assert.equal(s.phase, 'walk');
  assert.equal(s.left, 120);
  assert.equal(s.completedSet, false);
});
