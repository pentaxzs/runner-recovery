import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../logic.js';

test('escapes the characters that break markup', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'),
    '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  assert.equal(escapeHtml('"q" \'p\''), '&quot;q&quot; &#39;p&#39;');
});

test('ampersand is escaped first so entities are not double-built', () => {
  assert.equal(escapeHtml('&lt;'), '&amp;lt;');
});

test('handles non-string input without throwing', () => {
  for (const v of [null, undefined, 42, {}]) {
    assert.equal(typeof escapeHtml(v), 'string');
  }
});
