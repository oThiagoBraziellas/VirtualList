import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterRows, highlightSegments, normalize } from '../src/search.js';
import { generateRows, rowHeight } from '../src/data.js';

const rows = [
  { id: 1, name: 'João Silva', email: 'joao@example.com', city: 'Lisboa', note: 'VIP' },
  { id: 2, name: 'Maria Souza', email: 'maria@example.com', city: 'São Paulo', note: 'New' },
  { id: 3, name: 'Ana Silva', email: 'ana@example.com', city: 'Porto', note: 'VIP customer' },
];

test('normalize removes accents and case', () => {
  assert.equal(normalize('SÃO Paulo'), 'sao paulo');
});

test('filterRows requires every token and ignores accents', () => {
  assert.deepEqual(filterRows(rows, 'silva').map((r) => r.id), [1, 3]);
  assert.deepEqual(filterRows(rows, 'silva vip').map((r) => r.id), [1, 3]);
  assert.deepEqual(filterRows(rows, 'silva porto').map((r) => r.id), [3]);
  assert.deepEqual(filterRows(rows, 'joao').map((r) => r.id), [1]);
  assert.deepEqual(filterRows(rows, 'sao').map((r) => r.id), [2]);
  assert.deepEqual(filterRows(rows, 'zzz'), []);
});

test('filterRows returns the same array for an empty query', () => {
  assert.equal(filterRows(rows, ''), rows);
  assert.equal(filterRows(rows, '   '), rows);
});

test('filterRows does not match across field boundaries', () => {
  const r = [{ id: 1, name: 'ab', email: 'cd', city: 'x', note: 'y' }];
  assert.equal(filterRows(r, 'bc').length, 0);
});

test('highlightSegments marks matches and preserves the original text', () => {
  const segs = highlightSegments('João Silva', 'joao silva');
  assert.deepEqual(segs, [{ text: 'João', match: true }, { text: ' ', match: false }, { text: 'Silva', match: true }]);
  assert.equal(segs.map((s) => s.text).join(''), 'João Silva');
});

test('highlightSegments handles multiple, adjacent and absent matches', () => {
  assert.deepEqual(highlightSegments('banana', 'an'), [
    { text: 'b', match: false }, { text: 'anan', match: true }, { text: 'a', match: false },
  ]);
  assert.deepEqual(highlightSegments('hello', 'zzz'), [{ text: 'hello', match: false }]);
  assert.deepEqual(highlightSegments('hello', ''), [{ text: 'hello', match: false }]);
  assert.deepEqual(highlightSegments('', 'a'), [{ text: '', match: false }]);
});

test('generateRows is deterministic, sized correctly and has unique ids', () => {
  const a = generateRows(10000);
  assert.equal(a.length, 10000);
  assert.deepEqual(a.slice(0, 5), generateRows(5));
  assert.equal(new Set(a.map((r) => r.id)).size, 10000);
  assert.ok(a.every((r) => /^[^\s@]+@example\.com$/.test(r.email)));
});

test('rowHeight depends on note length', () => {
  assert.equal(rowHeight({ note: 'VIP' }), 56);
  assert.equal(rowHeight({ note: 'x'.repeat(100) }), 76);
});

test('filtering 100,000 rows stays fast', () => {
  const big = generateRows(100000);
  const start = performance.now();
  const hits = filterRows(big, 'lisboa vip');
  const ms = performance.now() - start;
  assert.ok(hits.length > 0 && hits.length < big.length);
  assert.ok(ms < 3000, `took ${ms}ms`);
});
