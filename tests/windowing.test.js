import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFixedMetrics, createVariableMetrics, computeWindow, scrollTopForIndex, moveActive,
} from '../src/windowing.js';

test('fixed metrics: offsets, total height and index lookup', () => {
  const m = createFixedMetrics(10000, 40);
  assert.equal(m.totalHeight, 400000);
  assert.equal(m.offsetOf(25), 1000);
  assert.equal(m.indexAt(1000), 25);
  assert.equal(m.indexAt(1039), 25);
  assert.equal(m.indexAt(-5), 0);
  assert.equal(m.indexAt(1e9), 9999);
});

test('fixed metrics reject invalid heights and handle empty lists', () => {
  assert.throws(() => createFixedMetrics(10, 0), RangeError);
  const empty = createFixedMetrics(0, 20);
  assert.equal(empty.totalHeight, 0);
  assert.equal(empty.indexAt(100), 0);
});

test('variable metrics: prefix sums and binary search agree with a linear scan', () => {
  const heights = Array.from({ length: 1000 }, (_, i) => 20 + (i * 7) % 31);
  const m = createVariableMetrics(heights);
  assert.equal(m.totalHeight, heights.reduce((a, b) => a + b, 0));
  let acc = 0;
  for (let i = 0; i < heights.length; i++) {
    assert.equal(m.offsetOf(i), acc);
    assert.equal(m.indexAt(acc), i);
    assert.equal(m.indexAt(acc + heights[i] - 1), i);
    acc += heights[i];
  }
  assert.equal(m.indexAt(acc + 50), heights.length - 1);
});

test('variable metrics validate input', () => {
  assert.throws(() => createVariableMetrics([10, 0, 5]), RangeError);
  assert.equal(createVariableMetrics([]).totalHeight, 0);
});

test('computeWindow at the top, middle and bottom with overscan', () => {
  const m = createFixedMetrics(10000, 40);
  const top = computeWindow(m, { scrollTop: 0, viewportHeight: 400, overscan: 3 });
  assert.deepEqual(top, { start: 0, end: 13, offsetTop: 0 }); // rows 0..9 visible + 3 overscan
  const mid = computeWindow(m, { scrollTop: 4000, viewportHeight: 400, overscan: 3 });
  assert.deepEqual(mid, { start: 97, end: 113, offsetTop: 3880 });
  const bottom = computeWindow(m, { scrollTop: 400000 - 400, viewportHeight: 400, overscan: 3 });
  assert.equal(bottom.end, 10000);
  assert.equal(bottom.start, 9987);
});

test('computeWindow clamps overscrolled positions and handles partial rows', () => {
  const m = createFixedMetrics(100, 50);
  const over = computeWindow(m, { scrollTop: 999999, viewportHeight: 300, overscan: 0 });
  assert.equal(over.end, 100);
  assert.equal(over.start, 94);
  const partial = computeWindow(m, { scrollTop: 25, viewportHeight: 100, overscan: 0 });
  assert.deepEqual([partial.start, partial.end], [0, 3]);
});

test('computeWindow never renders more than viewport/rowHeight + 2*overscan + 1 rows', () => {
  const m = createFixedMetrics(1_000_000, 32);
  for (const scrollTop of [0, 12345, 5_000_017, 31_999_000]) {
    const w = computeWindow(m, { scrollTop, viewportHeight: 640, overscan: 5 });
    assert.ok(w.end - w.start <= 20 + 1 + 10, `rendered ${w.end - w.start}`);
  }
});

test('computeWindow with variable heights keeps offsetTop aligned to the first row', () => {
  const heights = Array.from({ length: 500 }, (_, i) => (i % 3 === 0 ? 76 : 56));
  const m = createVariableMetrics(heights);
  const w = computeWindow(m, { scrollTop: 7000, viewportHeight: 500, overscan: 2 });
  assert.equal(w.offsetTop, m.offsetOf(w.start));
  assert.ok(m.offsetOf(w.start) <= 7000);
  assert.ok(m.offsetOf(w.end) >= 7500);
});

test('computeWindow on empty list or zero viewport', () => {
  assert.deepEqual(computeWindow(createFixedMetrics(0, 10), { scrollTop: 0, viewportHeight: 100 }), { start: 0, end: 0, offsetTop: 0 });
  assert.deepEqual(computeWindow(createFixedMetrics(10, 10), { scrollTop: 0, viewportHeight: 0 }), { start: 0, end: 0, offsetTop: 0 });
});

test('scrollTopForIndex supports start, center and nearest alignment', () => {
  const m = createFixedMetrics(1000, 40);
  assert.equal(scrollTopForIndex(m, 50, { viewportHeight: 400 }), 2000);
  assert.equal(scrollTopForIndex(m, 50, { viewportHeight: 400, align: 'center' }), 2000 - 180);
  assert.equal(scrollTopForIndex(m, 50, { viewportHeight: 400, scrollTop: 1900, align: 'nearest' }), 1900);
  assert.equal(scrollTopForIndex(m, 50, { viewportHeight: 400, scrollTop: 0, align: 'nearest' }), 2040 - 400);
  assert.equal(scrollTopForIndex(m, 5, { viewportHeight: 400, scrollTop: 2000, align: 'nearest' }), 200);
});

test('scrollTopForIndex clamps to the scrollable range', () => {
  const m = createFixedMetrics(100, 40);
  assert.equal(scrollTopForIndex(m, 99, { viewportHeight: 400 }), 4000 - 400);
  assert.equal(scrollTopForIndex(m, 0, { viewportHeight: 400, align: 'center' }), 0);
  assert.equal(scrollTopForIndex(m, 9999, { viewportHeight: 400 }), 3600);
  assert.equal(scrollTopForIndex(createFixedMetrics(0, 10), 3, { viewportHeight: 100 }), 0);
});

test('moveActive handles arrows, paging, home/end and bounds', () => {
  const opts = { count: 100, pageSize: 10 };
  assert.equal(moveActive(-1, 'ArrowDown', opts), 0);
  assert.equal(moveActive(5, 'ArrowDown', opts), 6);
  assert.equal(moveActive(99, 'ArrowDown', opts), 99);
  assert.equal(moveActive(0, 'ArrowUp', opts), 0);
  assert.equal(moveActive(50, 'PageDown', opts), 60);
  assert.equal(moveActive(95, 'PageDown', opts), 99);
  assert.equal(moveActive(3, 'PageUp', opts), 0);
  assert.equal(moveActive(42, 'Home', opts), 0);
  assert.equal(moveActive(42, 'End', opts), 99);
  assert.equal(moveActive(42, 'x', opts), 42);
  assert.equal(moveActive(0, 'ArrowDown', { count: 0, pageSize: 5 }), -1);
});
