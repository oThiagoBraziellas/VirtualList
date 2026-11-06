export function normalize(text) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Every whitespace-separated token must appear somewhere in the searchable fields. */
export function filterRows(rows, query, fields = ['name', 'email', 'city', 'note']) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return rows;
  return rows.filter((row) => {
    const haystack = normalize(fields.map((f) => row[f]).join(' \u0000 '));
    return tokens.every((t) => haystack.includes(t));
  });
}

/**
 * Splits text into [{ text, match }] so the UI can highlight matches without innerHTML.
 * Matching ignores case and accents; because NFD changes length, we match per original character.
 */
export function highlightSegments(text, query) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const source = String(text ?? '');
  if (tokens.length === 0 || source === '') return [{ text: source, match: false }];

  // Build a per-character normalised string so indexes line up with the original.
  const chars = [...source];
  const norm = chars.map((c) => normalize(c));
  const flat = norm.join('');
  const owner = [];
  norm.forEach((n, i) => { for (let k = 0; k < n.length; k++) owner.push(i); });

  const marked = new Array(chars.length).fill(false);
  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const at = flat.indexOf(token, from);
      if (at === -1) break;
      for (let k = at; k < at + token.length; k++) marked[owner[k]] = true;
      from = at + token.length;
    }
  }

  const out = [];
  for (let i = 0; i < chars.length; i++) {
    const last = out[out.length - 1];
    if (last && last.match === marked[i]) last.text += chars[i];
    else out.push({ text: chars[i], match: marked[i] });
  }
  return out;
}
