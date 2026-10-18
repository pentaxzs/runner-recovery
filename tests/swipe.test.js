import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swipeIntent, adjacentTab, SWIPE_MIN_PX } from '../logic.js';

const TABS = ['today', 'log', 'guide'];

// ── 제스처 판정 ─────────────────────────────────────────────
test('a clear leftward drag means next', () => {
  assert.equal(swipeIntent(-120, 10), 'next');
});

test('a clear rightward drag means prev', () => {
  assert.equal(swipeIntent(120, -8), 'prev');
});

test('a vertical scroll is never a tab swipe', () => {
  // 세로 스크롤을 가로채면 앱을 쓸 수 없게 된다.
  assert.equal(swipeIntent(30, 200), null);
  assert.equal(swipeIntent(-30, -200), null);
});

test('a diagonal drag that is mostly vertical is ignored', () => {
  assert.equal(swipeIntent(-80, 90), null);
});

test('a short flick below the threshold is ignored', () => {
  assert.equal(swipeIntent(-(SWIPE_MIN_PX - 1), 0), null);
  assert.equal(swipeIntent(0, 0), null);
});

test('a drag exactly at the threshold counts', () => {
  assert.equal(swipeIntent(-SWIPE_MIN_PX, 0), 'next');
});

// ── 탭 이동 ─────────────────────────────────────────────────
test('next moves one tab right', () => {
  assert.equal(adjacentTab(TABS, 'today', 'next'), 'log');
  assert.equal(adjacentTab(TABS, 'log', 'next'), 'guide');
});

test('prev moves one tab left', () => {
  assert.equal(adjacentTab(TABS, 'guide', 'prev'), 'log');
  assert.equal(adjacentTab(TABS, 'log', 'prev'), 'today');
});

test('the ends do not wrap around', () => {
  // 끝에서 한 바퀴 돌면 어디 있는지 알 수 없어진다.
  assert.equal(adjacentTab(TABS, 'today', 'prev'), null);
  assert.equal(adjacentTab(TABS, 'guide', 'next'), null);
});

test('an unknown tab or intent yields null', () => {
  assert.equal(adjacentTab(TABS, 'nope', 'next'), null);
  assert.equal(adjacentTab(TABS, 'today', null), null);
});
