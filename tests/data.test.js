import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TASKS, MICRO_MISSIONS, RUN_LADDER, RUN_RULES } from '../data.js';

const TIERS = new Set(['essential', 'recommended', 'recovery']);
const CONTEXTS = new Set(['subway', 'desk', 'lunch', 'home', 'outdoor']);

test('exactly two tasks are essential', () => {
  const essential = TASKS.filter((t) => t.tier === 'essential');
  assert.equal(essential.length, 2);
  assert.deepEqual(essential.map((t) => t.id).sort(), ['bridge', 'clamshell']);
});

test('task ids are unique and every tier is known', () => {
  assert.equal(new Set(TASKS.map((t) => t.id)).size, TASKS.length);
  for (const t of TASKS) {
    assert.ok(TIERS.has(t.tier), `${t.id} has unknown tier ${t.tier}`);
    assert.ok(t.title && t.detail, `${t.id} is missing title or detail`);
  }
});

test('micro-mission ids are unique and contexts are known', () => {
  assert.equal(new Set(MICRO_MISSIONS.map((m) => m.id)).size, MICRO_MISSIONS.length);
  for (const m of MICRO_MISSIONS) {
    assert.ok(CONTEXTS.has(m.context), `${m.id} has unknown context ${m.context}`);
    assert.ok(m.text.length > 0);
  }
});

test('weekday and weekend pools are both large enough to pick 3', () => {
  const weekday = MICRO_MISSIONS.filter((m) => ['subway', 'desk', 'lunch', 'home'].includes(m.context));
  const weekend = MICRO_MISSIONS.filter((m) => ['home', 'outdoor'].includes(m.context));
  assert.ok(weekday.length >= 10, `weekday pool is ${weekday.length}`);
  assert.ok(weekend.length >= 3, `weekend pool is ${weekend.length}`);
});

test('ladder levels are contiguous from 1 and increase in volume', () => {
  RUN_LADDER.forEach((l, i) => assert.equal(l.level, i + 1));
  for (let i = 1; i < RUN_LADDER.length; i++) {
    assert.ok(RUN_LADDER[i].approxKm > RUN_LADDER[i - 1].approxKm,
      `level ${i + 1} is not longer than level ${i}`);
  }
});

test('run rules mention the non-negotiables', () => {
  const all = RUN_RULES.join(' ');
  for (const kw of ['내리막', '보폭', '2']) assert.ok(all.includes(kw), `missing rule: ${kw}`);
});
