/** Deterministic fake rows so the demo (and tests) are reproducible. */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Felipe', 'Gabriela', 'Hugo', 'Isabel', 'João', 'Karen', 'Lucas', 'Marina', 'Nuno', 'Olivia', 'Paulo'];
const LAST = ['Almeida', 'Barros', 'Cardoso', 'Dias', 'Esteves', 'Ferraz', 'Gomes', 'Henriques', 'Lima', 'Machado', 'Neves', 'Oliveira', 'Pires', 'Queiroz', 'Ribeiro', 'Souza'];
const CITIES = ['Lisboa', 'São Paulo', 'Porto', 'Recife', 'Curitiba', 'Braga', 'Salvador', 'Coimbra'];
const NOTES = [
  'Prefers email contact.',
  'Requested a callback after the quarterly review, please schedule it for the first week of next month.',
  'VIP account.',
  'Open ticket about billing: waiting on documents from the customer before we can proceed with the refund.',
  'New customer.',
  'Renewal due soon.',
];

export function generateRows(count, seed = 7) {
  const rand = rng(seed);
  const rows = new Array(count);
  for (let i = 0; i < count; i++) {
    const first = FIRST[Math.floor(rand() * FIRST.length)];
    const last = LAST[Math.floor(rand() * LAST.length)];
    rows[i] = {
      id: i + 1,
      name: `${first} ${last}`,
      email: `${first}.${last}${i + 1}@example.com`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
      city: CITIES[Math.floor(rand() * CITIES.length)],
      note: NOTES[Math.floor(rand() * NOTES.length)],
    };
  }
  return rows;
}

/** Row height depends on how many lines the note needs (two lines for long notes). */
export function rowHeight(row, { base = 56, extra = 20, longNote = 40 } = {}) {
  return row.note.length > longNote ? base + extra : base;
}
