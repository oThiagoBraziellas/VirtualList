/**
 * Windowing math for virtualized lists. No DOM access.
 *
 * Metrics expose three things: count, totalHeight, offsetOf(i) (top of row i) and
 * indexAt(y) (row covering pixel y). Fixed heights are O(1); variable heights use a
 * prefix-sum array (O(n) to build, O(log n) to query).
 */

export function createFixedMetrics(count, itemHeight) {
  if (!(itemHeight > 0)) throw new RangeError('itemHeight must be positive');
  const n = Math.max(0, count | 0);
  return {
    count: n,
    totalHeight: n * itemHeight,
    heightOf: () => itemHeight,
    offsetOf: (i) => Math.min(Math.max(i, 0), n) * itemHeight,
    indexAt: (y) => (n === 0 ? 0 : Math.min(Math.max(Math.floor(y / itemHeight), 0), n - 1)),
  };
}

export function createVariableMetrics(heights) {
  const n = heights.length;
  const offsets = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    if (!(heights[i] > 0)) throw new RangeError(`height at ${i} must be positive`);
    offsets[i + 1] = offsets[i] + heights[i];
  }
  return {
    count: n,
    totalHeight: offsets[n],
    heightOf: (i) => heights[i],
    offsetOf: (i) => offsets[Math.min(Math.max(i, 0), n)],
    indexAt(y) {
      if (n === 0) return 0;
      if (y <= 0) return 0;
      if (y >= offsets[n]) return n - 1;
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (offsets[mid] <= y) lo = mid; else hi = mid - 1;
      }
      return lo;
    },
  };
}

/**
 * Which rows to render. `end` is exclusive. Overscan adds rows above and below to avoid
 * blank flashes during fast scrolling.
 */
export function computeWindow(metrics, { scrollTop, viewportHeight, overscan = 5 }) {
  const { count } = metrics;
  if (count === 0 || viewportHeight <= 0) return { start: 0, end: 0, offsetTop: 0 };
  const top = Math.max(0, Math.min(scrollTop, Math.max(0, metrics.totalHeight - viewportHeight)));
  const first = metrics.indexAt(top);
  const last = metrics.indexAt(top + viewportHeight - 1);
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, last + 1 + overscan);
  return { start, end, offsetTop: metrics.offsetOf(start) };
}

/** scrollTop that brings row `index` into view. align: 'start' | 'center' | 'nearest'. */
export function scrollTopForIndex(metrics, index, { viewportHeight, scrollTop = 0, align = 'start' }) {
  if (metrics.count === 0) return 0;
  const i = Math.min(Math.max(index, 0), metrics.count - 1);
  const top = metrics.offsetOf(i);
  const bottom = top + metrics.heightOf(i);
  const max = Math.max(0, metrics.totalHeight - viewportHeight);
  let target;
  if (align === 'center') {
    target = top - (viewportHeight - metrics.heightOf(i)) / 2;
  } else if (align === 'nearest') {
    if (top < scrollTop) target = top;
    else if (bottom > scrollTop + viewportHeight) target = bottom - viewportHeight;
    else target = scrollTop;
  } else {
    target = top;
  }
  return Math.min(Math.max(target, 0), max);
}

/** Row index after a keyboard action. */
export function moveActive(current, key, { count, pageSize }) {
  if (count === 0) return -1;
  const from = current < 0 ? 0 : current;
  switch (key) {
    case 'ArrowDown': return current < 0 ? 0 : Math.min(count - 1, from + 1);
    case 'ArrowUp': return current < 0 ? 0 : Math.max(0, from - 1);
    case 'PageDown': return Math.min(count - 1, from + pageSize);
    case 'PageUp': return Math.max(0, from - pageSize);
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return current;
  }
}
