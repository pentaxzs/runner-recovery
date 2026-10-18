import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickMissions } from '../logic.js';
import { MICRO_MISSIONS } from '../data.js';

test('same date gives the same picks every call', () => {
  const a = pickMissions(MICRO_MISSIONS, '2026-10-19', 3);
  const b = pickMissions(MICRO_MISSIONS, '2026-10-19', 3);
  assert.deepEqual(a.map((m) => m.id), b.map((m) => m.id));
});

test('different dates give different picks at least sometimes', () => {
  const week = ['19','20','21','22','23'].map((d) => pickMissions(MICRO_MISSIONS, `2026-10-${d}`, 3));
  const signatures = new Set(week.map((p) => p.map((m) => m.id).join(',')));
  assert.ok(signatures.size > 1, '5일 내내 같은 미션이 나왔다');
});

test('picks are distinct within a day', () => {
  const p = pickMissions(MICRO_MISSIONS, '2026-10-19', 3);
  assert.equal(new Set(p.map((m) => m.id)).size, p.length);
});

test('weekdays only draw from subway/desk/lunch/home', () => {
  const p = pickMissions(MICRO_MISSIONS, '2026-10-19', 3);
  for (const m of p) assert.ok(['subway', 'desk', 'lunch', 'home'].includes(m.context));
});

test('weekends only draw from home/outdoor', () => {
  for (const d of ['2026-10-17', '2026-10-18']) {
    for (const m of pickMissions(MICRO_MISSIONS, d, 3)) {
      assert.ok(['home', 'outdoor'].includes(m.context), `${d}: ${m.context}`);
    }
  }
});

test('asking for more than the pool returns the whole pool, not duplicates', () => {
  const p = pickMissions(MICRO_MISSIONS, '2026-10-17', 99);
  assert.equal(new Set(p.map((m) => m.id)).size, p.length);
});

test('an empty pool returns an empty array', () => {
  assert.deepEqual(pickMissions([], '2026-10-19', 3), []);
});
