import { generateRows, rowHeight } from './data.js';
import { filterRows, highlightSegments } from './search.js';
import { createFixedMetrics, createVariableMetrics } from './windowing.js';
import { VirtualList } from './virtual-list.js';

const $ = (s) => document.querySelector(s);
const els = {
  size: $('#size'), query: $('#query'), variable: $('#variable'), jump: $('#jump'), jumpForm: $('#jump-form'),
  list: $('#list'), stats: $('#stats'), empty: $('#empty'), perf: $('#perf'),
};

let allRows = [];
let rows = [];
let list = null;

function highlighted(parent, text, query) {
  for (const seg of highlightSegments(text, query)) {
    if (seg.match) {
      const m = document.createElement('mark');
      m.textContent = seg.text;
      parent.append(m);
    } else {
      parent.append(document.createTextNode(seg.text));
    }
  }
}

function renderRow(i) {
  const row = rows[i];
  const q = els.query.value;
  const node = document.createElement('div');
  node.className = 'row';
  const id = document.createElement('span');
  id.className = 'id';
  id.textContent = `#${row.id}`;
  const body = document.createElement('div');
  body.className = 'body';
  const name = document.createElement('strong');
  highlighted(name, row.name, q);
  const meta = document.createElement('span');
  meta.className = 'meta';
  highlighted(meta, `${row.email} · ${row.city}`, q);
  body.append(name, meta);
  if (els.variable.checked && row.note.length > 40) {
    const note = document.createElement('span');
    note.className = 'note';
    highlighted(note, row.note, q);
    body.append(note);
  }
  node.append(id, body);
  node.addEventListener('click', () => list.setActive(i));
  return node;
}

function buildMetrics() {
  return els.variable.checked
    ? createVariableMetrics(rows.map((r) => rowHeight(r)))
    : createFixedMetrics(rows.length, 56);
}

function refresh({ keepScroll = false } = {}) {
  rows = filterRows(allRows, els.query.value);
  els.empty.hidden = rows.length > 0;
  const metrics = buildMetrics();
  if (list) list.setMetrics(metrics, { keepScroll });
  else {
    list = new VirtualList(els.list, {
      metrics,
      renderRow,
      onRender: ({ start, end, domNodes, count }) => {
        els.stats.textContent = count === 0
          ? 'No rows'
          : `${count.toLocaleString('en-US')} rows · rendering ${start + 1}–${end} · ${domNodes} DOM nodes`;
      },
    });
  }
}

function load() {
  const count = Number(els.size.value);
  const t0 = performance.now();
  allRows = generateRows(count);
  const t1 = performance.now();
  refresh();
  els.perf.textContent = `Built ${count.toLocaleString('en-US')} rows in ${(t1 - t0).toFixed(0)} ms, first render in ${(performance.now() - t1).toFixed(0)} ms`;
}

let timer;
els.query.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => refresh(), 150); });
els.size.addEventListener('change', load);
els.variable.addEventListener('change', () => refresh());
els.jumpForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const n = Number(els.jump.value);
  if (Number.isInteger(n) && n >= 1 && n <= rows.length) {
    list.scrollToIndex(n - 1, { align: 'center' });
    list.setActive(n - 1);
  }
});

load();
