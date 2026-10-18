import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES, HIGH_LOAD_IDS, ACTIVITY_LABELS } from '../data.js';

test('activity ids are unique', () => {
  assert.equal(new Set(ACTIVITIES.map((a) => a.id)).size, ACTIVITIES.length);
});

test('badminton is flagged high load', () => {
  // 좌우 감속이 장경인대를 직접 때린다. 러닝과 같은 날이면 경고해야 한다.
  assert.ok(HIGH_LOAD_IDS.includes('badminton'));
});

test('table tennis is not flagged high load', () => {
  assert.ok(!HIGH_LOAD_IDS.includes('tabletennis'));
});

test('a full golf round is high load but range practice is not', () => {
  assert.ok(HIGH_LOAD_IDS.includes('golf-round'));
  assert.ok(!HIGH_LOAD_IDS.includes('golf'));
});

test('every activity has a label and a known load', () => {
  for (const a of ACTIVITIES) {
    assert.ok(ACTIVITY_LABELS[a.id], `${a.id} has no label`);
    assert.ok(['high', 'low'].includes(a.load), `${a.id} has load ${a.load}`);
  }
});
