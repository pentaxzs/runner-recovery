import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ILLUSTRATIONS } from '../illustrations.js';
import { TASKS } from '../data.js';

test('every exercise has illustrations', () => {
  for (const t of TASKS) {
    assert.ok(ILLUSTRATIONS[t.id], `${t.id} has no illustrations`);
  }
});

test('every exercise has at least three frames so the carousel earns its swipe', () => {
  for (const [id, frames] of Object.entries(ILLUSTRATIONS)) {
    assert.ok(frames.length >= 3, `${id} has only ${frames.length} frames`);
  }
});

test('every frame has a caption and an svg', () => {
  for (const [id, frames] of Object.entries(ILLUSTRATIONS)) {
    frames.forEach((f, i) => {
      assert.ok(f.caption && f.caption.length > 0, `${id}[${i}] has no caption`);
      assert.ok(f.svg.startsWith('<svg'), `${id}[${i}] is not an svg`);
      assert.ok(f.svg.includes('viewBox'), `${id}[${i}] has no viewBox`);
    });
  }
});

test('illustrations carry no hardcoded colors so dark mode works', () => {
  for (const [id, frames] of Object.entries(ILLUSTRATIONS)) {
    frames.forEach((f, i) => {
      assert.ok(!/#[0-9a-fA-F]{3,6}/.test(f.svg), `${id}[${i}] hardcodes a hex color`);
      assert.ok(!/(stroke|fill)="(?!none)(?!currentColor)[a-z]+"/.test(f.svg),
        `${id}[${i}] hardcodes a named color`);
    });
  }
});

test('no illustration references an exercise that does not exist', () => {
  const ids = new Set(TASKS.map((t) => t.id));
  for (const id of Object.keys(ILLUSTRATIONS)) {
    assert.ok(ids.has(id), `${id} is not a known exercise`);
  }
});
