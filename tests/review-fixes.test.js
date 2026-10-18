import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_PREFIX } from '../store.js';
import { painFreeKm, nextLevel, nextStepHint } from '../logic.js';
import { RUN_LADDER } from '../data.js';

const LEN = RUN_LADDER.length;

// ── #1 quota: getItem works, setItem throws ────────────────
test('a write-only-failing backend still reads back from memory', () => {
  const map = new Map();
  const quotaFull = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),   // 읽기는 정상
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: (k) => map.delete(k),
  };
  const s = createStore(quotaFull);
  s.set('sessions', [{ date: '2026-10-18', type: 'run' }]);
  assert.deepEqual(s.get('sessions', []), [{ date: '2026-10-18', type: 'run' }]);
});

test('a readable backend still wins over a stale memory entry', () => {
  const map = new Map([[`${STORAGE_PREFIX}checks`, '{"2026-10-18":["clamshell"]}']]);
  const backend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  assert.deepEqual(createStore(backend).get('checks', {}), { '2026-10-18': ['clamshell'] });
});

// ── #5 painful run with no usable onset ─────────────────────
test('a painful run with a missing onset claims no pain-free distance', () => {
  assert.equal(painFreeKm({ type: 'run', hadPain: true, distanceKm: 4.0 }), 0);
});

test('a painful run with onset 0 claims no pain-free distance', () => {
  assert.equal(painFreeKm({ type: 'run', hadPain: true, distanceKm: 4.0, painOnsetKm: 0 }), 0);
});

test('a painful run still uses a valid onset', () => {
  assert.equal(painFreeKm({ type: 'run', hadPain: true, distanceKm: 4.0, painOnsetKm: 2.2 }), 2.2);
});

test('an onset longer than the run is clamped to the distance', () => {
  assert.equal(painFreeKm({ type: 'run', hadPain: true, distanceKm: 3.0, painOnsetKm: 5.0 }), 3.0);
});

// ── #7 promotion needs two clean runs at the SAME level ─────
const clean = (level) => ({ type: 'run', hadPain: false, distanceKm: 2, level });
const hurt = (level) => ({ type: 'run', hadPain: true, distanceKm: 2, painOnsetKm: 1, level });

test('two clean runs at the current level promote exactly once', () => {
  assert.equal(nextLevel(1, [clean(1), clean(1)], LEN).level, 2);
});

test('a third clean run at the new level does not promote again', () => {
  // Lv1에서 2회 → Lv2 승급. Lv2에서의 첫 러닝은 유지해야 한다.
  assert.equal(nextLevel(2, [clean(1), clean(1), clean(2)], LEN).level, 2);
});

test('ten clean runs advance five levels, not nine', () => {
  const runs = [];
  let level = 1;
  for (let i = 0; i < 10; i++) {
    runs.push(clean(level));
    level = nextLevel(level, runs, LEN).level;
  }
  assert.equal(level, 6); // 1 + 10/2
});

test('runs at an older level do not count toward the current level', () => {
  assert.equal(nextLevel(3, [clean(2), clean(2), clean(3)], LEN).level, 3);
});

test('pain still demotes regardless of level bookkeeping', () => {
  assert.equal(nextLevel(4, [clean(4), hurt(4)], LEN).level, 3);
});

test('three painful runs still pause', () => {
  assert.equal(nextLevel(4, [hurt(4), hurt(3), hurt(3)], LEN).paused, true);
});

// ── #3 report must describe what is next, not re-apply ──────
test('nextStepHint reports the applied level, never a second promotion', () => {
  const h = nextStepHint(2, [clean(1), clean(1)], LEN);
  assert.equal(h.level, 2, 'already-applied level must not advance again');
});

test('nextStepHint says how many clean runs remain at this level', () => {
  const h = nextStepHint(2, [clean(1), clean(1), clean(2)], LEN);
  assert.equal(h.level, 2);
  assert.match(h.reason, /한 번 더/);
});

test('nextStepHint flags a paused program', () => {
  const h = nextStepHint(3, [hurt(4), hurt(4), hurt(3)], LEN);
  assert.equal(h.paused, true);
});

test('nextStepHint handles an empty history', () => {
  const h = nextStepHint(1, [], LEN);
  assert.equal(h.level, 1);
  assert.equal(h.paused, false);
});
