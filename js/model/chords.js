/**
 * Chord database: maps chord names to standard open voicings.
 * Frets array: [e, B, G, D, A, E] (high to low). null = not played.
 *
 * The chord table is 12 columns × 4 rows.
 * Rows 1-2: major/minor for each root.
 * Rows 3-4 under rare sharp/flat columns hold overflow variants from neighboring naturals.
 */

/** @typedef {{ name: string, frets: (number|null)[] }} ChordVoicing */

/** All chord voicings, keyed by name. */
export const CHORD_DB = {
  // === C family ===
  'C':      { frets: [0, 1, 0, 2, 3, null] },
  'Cm':     { frets: [3, 4, 5, 5, 3, null] },
  'C7':     { frets: [0, 1, 3, 2, 3, null] },
  'Cmaj7':  { frets: [0, 0, 0, 2, 3, null] },

  // === C# / D♭ (rows 3-4 = C overflow) ===
  'C#':     { frets: [null, 2, 1, 3, 4, null] },
  'C#m':    { frets: [null, 2, 1, 2, 4, null] },
  'Cadd9':  { frets: [0, 3, 0, 2, 3, null] },
  'Csus4':  { frets: [1, 1, 0, 3, 3, null] },

  // === D family ===
  'D':      { frets: [2, 3, 2, 0, null, null] },
  'Dm':     { frets: [1, 3, 2, 0, null, null] },
  'D7':     { frets: [2, 1, 2, 0, null, null] },
  'Dm7':    { frets: [1, 1, 2, 0, null, null] },

  // === E♭ / D# (rows 3-4 = D overflow) ===
  'E♭':     { frets: [null, 4, 3, 5, 6, null] },
  'E♭m':    { frets: [null, 4, 3, 4, 6, null] },
  'Dsus2':  { frets: [0, 3, 2, 0, null, null] },
  'Dsus4':  { frets: [3, 3, 2, 0, null, null] },

  // === E family ===
  'E':      { frets: [0, 0, 1, 2, 2, 0] },
  'Em':     { frets: [0, 0, 0, 2, 2, 0] },
  'E7':     { frets: [0, 0, 1, 0, 2, 0] },
  'Em7':    { frets: [0, 0, 0, 0, 2, 0] },

  // === F family ===
  'F':      { frets: [1, 1, 2, 3, null, null] },
  'Fm':     { frets: [1, 1, 1, 3, null, null] },
  'Fmaj7':  { frets: [0, 1, 2, 3, null, null] },
  'Fadd9':  { frets: [3, 1, 2, 3, null, null] },

  // === F# / G♭ (rows 3-4 = D/F# + Esus4) ===
  'F#':     { frets: [2, 2, 3, 4, 4, 2] },
  'F#m':    { frets: [2, 2, 2, 4, 4, 2] },
  'D/F#':   { frets: [2, 3, 2, 0, null, 2] },
  'Esus4':  { frets: [0, 0, 2, 2, 2, 0] },

  // === G family ===
  'G':      { frets: [3, 0, 0, 0, 2, 3] },
  'Gm':     { frets: [3, 3, 3, 5, 5, 3] },
  'G7':     { frets: [1, 0, 0, 0, 2, 3] },
  'Gsus4':  { frets: [3, 1, 0, 0, 3, 3] },

  // === A♭ / G# (rows 3-4 = G overflow) ===
  'A♭':     { frets: [4, 4, 5, 6, 4, null] },
  'G#m':    { frets: [4, 4, 4, 6, 4, null] },
  'G/B':    { frets: [3, 0, 0, 0, 2, null] },
  'Am/G':   { frets: [0, 1, 2, 2, 0, 3] },

  // === A family ===
  'A':      { frets: [0, 2, 2, 2, 0, null] },
  'Am':     { frets: [0, 1, 2, 2, 0, null] },
  'A7':     { frets: [0, 2, 0, 2, 0, null] },
  'Am7':    { frets: [0, 1, 0, 2, 0, null] },

  // === B♭ / A# (rows 3-4 = A overflow) ===
  'B♭':     { frets: [1, 3, 3, 3, 1, null] },
  'B♭m':    { frets: [1, 2, 3, 3, 1, null] },
  'Asus2':  { frets: [0, 0, 2, 2, 0, null] },
  'Asus4':  { frets: [0, 3, 2, 2, 0, null] },

  // === B family ===
  'B':      { frets: [2, 4, 4, 4, 2, null] },
  'Bm':     { frets: [2, 3, 4, 4, 2, null] },
  'B7':     { frets: [2, 0, 2, 1, 2, null] },
  'Bm7':    { frets: [2, 0, 2, 2, 2, null] },
};

/**
 * The chord table layout: 12 columns × 4 rows.
 * Each entry is a chord name (key into CHORD_DB) or null for empty cells.
 */
export const CHORD_TABLE_COLUMNS = [
  'C', 'C#', 'D', 'E♭', 'E', 'F', 'F#', 'G', 'A♭', 'A', 'B♭', 'B',
];

export const CHORD_TABLE = [
  // Row 1: Major
  ['C', 'C#', 'D', 'E♭', 'E', 'F', 'F#', 'G', 'A♭', 'A', 'B♭', 'B'],
  // Row 2: Minor
  ['Cm', 'C#m', 'Dm', 'E♭m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'B♭m', 'Bm'],
  // Row 3: Variant (overflow for sharp/flat columns)
  ['C7', 'Cadd9', 'D7', 'Dsus2', 'E7', 'Fmaj7', 'D/F#', 'G7', 'G/B', 'A7', 'Asus2', 'B7'],
  // Row 4: Variant (overflow for sharp/flat columns)
  ['Cmaj7', 'Csus4', 'Dm7', 'Dsus4', 'Em7', 'Fadd9', 'Esus4', 'Gsus4', 'Am/G', 'Am7', 'Asus4', 'Bm7'],
];

/**
 * Look up a chord by name. Accepts common aliases (e.g., "Db" → "E♭" won't match,
 * but "Eb" → "E♭" will if we normalize).
 * @param {string} name
 * @returns {ChordVoicing|null}
 */
export function lookupChord(name) {
  if (!name) return null;

  // Normalize: uppercase first letter, then try various substitutions
  let n = name.charAt(0).toUpperCase() + name.slice(1);

  // Direct match
  if (CHORD_DB[n]) return { name: n, ...CHORD_DB[n] };

  // Try normalizing b → ♭ (but not at the start — "b" is the note B)
  const withFlat = n.replace(/([A-G])b(?!$)/g, (_, note) => note + '♭');
  if (CHORD_DB[withFlat]) return { name: withFlat, ...CHORD_DB[withFlat] };

  // Also try: the second character 'b' as flat when it's the only modifier
  // e.g., "Eb" → "E♭", "Bb" → "B♭", "Ab" → "A♭"
  const withFlat2 = n.replace(/^([A-G])b(.*)$/, (_, note, rest) => note + '♭' + rest);
  if (CHORD_DB[withFlat2]) return { name: withFlat2, ...CHORD_DB[withFlat2] };

  return null;
}

/**
 * Get the fret for a specific string given a chord voicing.
 * @param {string} chordName
 * @param {number} stringIdx - 0=e, 1=B, ..., 5=E
 * @returns {number|null} Fret number or null if string is not played
 */
export function getChordFret(chordName, stringIdx) {
  const chord = lookupChord(chordName);
  if (!chord) return null;
  return chord.frets[stringIdx];
}
