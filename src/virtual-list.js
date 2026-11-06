import { computeWindow, scrollTopForIndex, moveActive } from './windowing.js';

/**
 * DOM glue for the windowing math. Rows are absolutely positioned inside a spacer whose
 * height equals the full list, so the native scrollbar and scrolling stay untouched.
 */
export class VirtualList {
  constructor(container, { metrics, renderRow, overscan = 6, onRender = () => {} }) {
    this.container = container;
    this.renderRow = renderRow;
    this.overscan = overscan;
    this.onRender = onRender;
    this.active = -1;
    this.nodes = new Map();
    this.frame = 0;

    this.spacer = document.createElement('div');
    this.spacer.className = 'vl-spacer';
    container.append(this.spacer);
    container.tabIndex = 0;
    container.setAttribute('role', 'listbox');

    this.onScroll = () => this.schedule();
    this.onKey = (e) => this.handleKey(e);
    container.addEventListener('scroll', this.onScroll, { passive: true });
    container.addEventListener('keydown', this.onKey);
    this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.schedule()) : null;
    this.resizeObserver?.observe(container);

    this.setMetrics(metrics);
  }

  setMetrics(metrics, { keepScroll = false } = {}) {
    this.metrics = metrics;
    this.spacer.style.height = `${metrics.totalHeight}px`;
    for (const node of this.nodes.values()) node.remove();
    this.nodes.clear();
    this.active = Math.min(this.active, metrics.count - 1);
    this.container.setAttribute('aria-rowcount', String(metrics.count));
    if (!keepScroll) this.container.scrollTop = 0;
    this.render();
  }

  schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.render(); });
  }

  render() {
    const { metrics } = this;
    const win = computeWindow(metrics, {
      scrollTop: this.container.scrollTop,
      viewportHeight: this.container.clientHeight,
      overscan: this.overscan,
    });
    for (const [index, node] of this.nodes) {
      if (index < win.start || index >= win.end) { node.remove(); this.nodes.delete(index); }
    }
    for (let i = win.start; i < win.end; i++) {
      let node = this.nodes.get(i);
      if (!node) {
        node = this.renderRow(i);
        node.id = `vl-row-${i}`;
        node.setAttribute('role', 'option');
        node.setAttribute('aria-posinset', String(i + 1));
        node.setAttribute('aria-setsize', String(metrics.count));
        node.style.position = 'absolute';
        node.style.left = '0';
        node.style.right = '0';
        node.style.top = `${metrics.offsetOf(i)}px`;
        node.style.height = `${metrics.heightOf(i)}px`;
        this.spacer.append(node);
        this.nodes.set(i, node);
      }
      node.setAttribute('aria-selected', String(i === this.active));
      node.classList.toggle('active', i === this.active);
    }
    this.onRender({ ...win, domNodes: this.nodes.size, count: metrics.count });
  }

  scrollToIndex(index, { align = 'start', smooth = true } = {}) {
    const top = scrollTopForIndex(this.metrics, index, {
      viewportHeight: this.container.clientHeight,
      scrollTop: this.container.scrollTop,
      align,
    });
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.container.scrollTo({ top, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }

  setActive(index) {
    this.active = index;
    if (index >= 0) this.container.setAttribute('aria-activedescendant', `vl-row-${index}`);
    this.render();
  }

  handleKey(e) {
    const pageSize = Math.max(1, this.metrics.indexAt(this.container.clientHeight) || 1);
    const next = moveActive(this.active, e.key, { count: this.metrics.count, pageSize });
    if (next === this.active && !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    this.active = next;
    this.scrollToIndex(next, { align: 'nearest', smooth: false });
    this.setActive(next);
  }

  destroy() {
    this.container.removeEventListener('scroll', this.onScroll);
    this.container.removeEventListener('keydown', this.onKey);
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.frame);
    this.spacer.remove();
  }
}
