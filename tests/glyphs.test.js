import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, randomGlyph } from '../glyphs.js';

test('there are enough glyphs for the rotation to feel varied', () => {
  assert.ok(GLYPHS.length >= 8, `only ${GLYPHS.length} glyphs`);
});

test('glyph ids are unique', () => {
  assert.equal(new Set(GLYPHS.map((g) => g.id)).size, GLYPHS.length);
});

test('every glyph is a titled svg with a viewBox', () => {
  for (const g of GLYPHS) {
    assert.ok(g.title, `${g.id} has no title`);
    assert.ok(g.svg.startsWith('<svg') && g.svg.includes('viewBox'), `${g.id} is malformed`);
  }
});

test('glyphs use currentColor so dark mode follows', () => {
  for (const g of GLYPHS) {
    assert.ok(!/#[0-9a-fA-F]{3,6}/.test(g.svg), `${g.id} hardcodes a hex color`);
    assert.ok(g.svg.includes('currentColor'), `${g.id} does not use currentColor`);
  }
});

test('glyphs are angular — no curve commands', () => {
  // 각진 디자인에 맞춰 곡선을 쓰지 않는다.
  for (const g of GLYPHS) {
    assert.ok(!/[CcSsQqTtAa]\s*[-\d]/.test(g.svg), `${g.id} contains a curve`);
    assert.ok(!g.svg.includes('<circle'), `${g.id} contains a circle`);
    assert.ok(!g.svg.includes('rx='), `${g.id} contains a rounded rect`);
  }
});

test('randomGlyph returns a member of the pool', () => {
  for (let i = 0; i < 40; i++) assert.ok(GLYPHS.includes(randomGlyph()));
});

test('randomGlyph varies across calls', () => {
  const seen = new Set(Array.from({ length: 60 }, () => randomGlyph().id));
  assert.ok(seen.size > 1, '항상 같은 글리프가 나왔다');
});

test('an empty pool returns null instead of throwing', () => {
  assert.equal(randomGlyph([]), null);
});
