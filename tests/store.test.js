import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_PREFIX } from '../store.js';

function fakeBackend(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

test('set then get round-trips an object', () => {
  const s = createStore(fakeBackend());
  s.set('checks', { '2026-10-18': ['clamshell'] });
  assert.deepEqual(s.get('checks', {}), { '2026-10-18': ['clamshell'] });
});

test('keys are namespaced with the v3 prefix', () => {
  const b = fakeBackend();
  createStore(b).set('checks', {});
  assert.ok(b._map.has(`${STORAGE_PREFIX}checks`));
});

test('get returns the fallback for a missing key', () => {
  assert.deepEqual(createStore(fakeBackend()).get('sessions', []), []);
});

test('get returns the fallback for corrupted JSON', () => {
  const b = fakeBackend({ [`${STORAGE_PREFIX}sessions`]: '{not json' });
  assert.deepEqual(createStore(b).get('sessions', []), []);
});

test('v2 keys are never read', () => {
  const b = fakeBackend({ runner_tracker_state_v2: '{"2026-01-01__0":true}' });
  assert.deepEqual(createStore(b).get('checks', {}), {});
});

test('a throwing backend falls back to memory instead of crashing', () => {
  const hostile = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); },
    removeItem() { throw new Error('SecurityError'); },
  };
  const s = createStore(hostile);
  assert.doesNotThrow(() => s.set('checks', { a: 1 }));
  assert.deepEqual(s.get('checks', {}), { a: 1 });
});

test('remove deletes the key', () => {
  const s = createStore(fakeBackend());
  s.set('steps', { '2026-10-18': 100 });
  s.remove('steps');
  assert.deepEqual(s.get('steps', {}), {});
});
