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

// ============================================================
// Algorithmic chord generator
// ============================================================

/** Standard tuning: open string MIDI notes [e, B, G, D, A, E] */
const OPEN_STRINGS = [64, 59, 55, 50, 45, 40]; // high to low

/** Note names to semitone offset from C */
const NOTE_TO_SEMI = {
  'C': 0, 'C#': 1, 'D♭': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'E♭': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'G♭': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'A♭': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'B♭': 10, 'Bb': 10,
  'B': 11,
};

/**
 * Parse a chord name into { root (semitone), bassNote (semitone|null), intervals (Set of semitones) }.
 * Handles: major, minor, 7, maj7, m7, dim, aug, sus2, sus4, add9, add11, add13,
 * 6, 9, 11, 13, dim7, m7b5 (half-dim), aug7, and arbitrary combinations.
 */
function parseChordName(name) {
  if (!name) return null;

  // Normalize
  let n = name.charAt(0).toUpperCase() + name.slice(1);
  n = n.replace(/♭/g, 'b').replace(/♯/g, '#');

  // Extract root note
  let root = null;
  let rest = '';
  if (n.length >= 2 && (n[1] === '#' || n[1] === 'b')) {
    root = NOTE_TO_SEMI[n.substring(0, 2)];
    rest = n.substring(2);
  } else {
    root = NOTE_TO_SEMI[n.substring(0, 1)];
    rest = n.substring(1);
  }
  if (root === undefined) return null;

  // Extract bass note (slash chord)
  let bassNote = null;
  const slashIdx = rest.indexOf('/');
  if (slashIdx !== -1) {
    const bassStr = rest.substring(slashIdx + 1);
    bassNote = NOTE_TO_SEMI[bassStr.charAt(0).toUpperCase() + bassStr.slice(1)];
    if (bassNote === undefined) bassNote = null;
    rest = rest.substring(0, slashIdx);
  }

  rest = rest.toLowerCase();

  // Validate: rest must be composed entirely of recognized chord tokens.
  // Recognized tokens (order matters — longer matches first):
  const VALID_TOKENS = [
    'maj7', 'maj9', 'maj11', 'maj13', 'maj',
    'min7', 'min9', 'min',
    'add9', 'add11', 'add13',
    'dim7', 'dim',
    'aug7', 'aug',
    'sus2', 'sus4', 'sus',
    'm7b5', 'm7', 'm9', 'm11', 'm13', 'm6', 'm',
    'b5', '#5', 'b9', '#9', '#11', 'b13',
    '7', '9', '11', '13', '6', '5',
  ];

  let remaining = rest;
  while (remaining.length > 0) {
    let matched = false;
    for (const token of VALID_TOKENS) {
      if (remaining.startsWith(token)) {
        remaining = remaining.substring(token.length);
        matched = true;
        break;
      }
    }
    if (!matched) return null; // unrecognized text in chord name
  }

  // Build intervals as semitones above root
  // Start with root
  const intervals = new Set([0]);

  // Determine third
  let hasMinor = false;
  let hasMajor3 = true;
  let hasSus = false;

  if (rest.includes('dim')) {
    hasMinor = true;
    hasMajor3 = false;
  } else if (rest.includes('aug')) {
    // augmented has major third
  } else if (rest.startsWith('m') && !rest.startsWith('maj')) {
    hasMinor = true;
    hasMajor3 = false;
  } else if (rest.includes('sus2')) {
    hasSus = true;
    hasMajor3 = false;
    intervals.add(2); // major 2nd
  } else if (rest.includes('sus4')) {
    hasSus = true;
    hasMajor3 = false;
    intervals.add(5); // perfect 4th
  } else if (rest.includes('sus')) {
    hasSus = true;
    hasMajor3 = false;
    intervals.add(5); // sus defaults to sus4
  }

  if (hasMinor) intervals.add(3);    // minor third
  else if (hasMajor3) intervals.add(4); // major third

  // Determine fifth
  if (rest.includes('dim')) {
    intervals.add(6);  // diminished fifth
  } else if (rest.includes('aug')) {
    intervals.add(8);  // augmented fifth
  } else if (rest.includes('b5')) {
    intervals.add(6);
  } else if (rest.includes('#5')) {
    intervals.add(8);
  } else if (!rest.match(/^5$/)) {
    intervals.add(7);  // perfect fifth (unless power chord "5")
  }

  // Seventh
  if (rest.includes('maj7') || rest.includes('maj9') || rest.includes('maj11') || rest.includes('maj13')) {
    intervals.add(11); // major seventh
  } else if (rest.includes('dim7')) {
    intervals.add(9);  // diminished seventh
  } else if (rest.includes('7') || rest.includes('9') || rest.includes('11') || rest.includes('13')) {
    if (!rest.includes('maj')) {
      intervals.add(10); // dominant (minor) seventh
    }
  }

  // Extensions
  if (rest.includes('6') || rest.includes('13')) intervals.add(9);    // 6th / 13th
  if (rest.includes('9') || rest.includes('add9')) intervals.add(14); // 9th (= 2nd + octave)
  if (rest.includes('11') || rest.includes('add11')) intervals.add(17); // 11th (= 4th + octave)
  if (rest.includes('13') || rest.includes('add13')) intervals.add(21); // 13th (= 6th + octave)

  // Alterations
  if (rest.includes('b9')) { intervals.delete(14); intervals.add(13); }
  if (rest.includes('#9')) { intervals.delete(14); intervals.add(15); }
  if (rest.includes('#11')) { intervals.delete(17); intervals.add(18); }
  if (rest.includes('b13')) { intervals.delete(21); intervals.add(20); }

  // Power chord: only root + 5th
  if (rest === '5') {
    intervals.clear();
    intervals.add(0);
    intervals.add(7);
  }

  return { root, bassNote, intervals };
}

/**
 * Generate a guitar voicing for a set of intervals from a root.
 * Returns frets: [e, B, G, D, A, E] or null for unplayable.
 */
function generateVoicing(root, intervals, bassNote) {
  // Convert intervals to target MIDI notes (in any octave)
  const targetPitchClasses = new Set();
  for (const interval of intervals) {
    targetPitchClasses.add((root + interval) % 12);
  }

  // Try to find a playable voicing within the first 5 frets, then expand
  for (let maxFret = 4; maxFret <= 7; maxFret++) {
    const voicing = _findVoicing(targetPitchClasses, root, bassNote, 0, maxFret);
    if (voicing) return voicing;
  }

  // Try barre chord positions
  for (let startFret = 1; startFret <= 9; startFret++) {
    const voicing = _findVoicing(targetPitchClasses, root, bassNote, startFret, startFret + 4);
    if (voicing) return voicing;
  }

  return null;
}

function _findVoicing(targetPCs, root, bassNote, minFret, maxFret) {
  const frets = [null, null, null, null, null, null];
  let matchedPCs = new Set();

  // For each string, find the best fret
  for (let s = 5; s >= 0; s--) { // low to high
    const openNote = OPEN_STRINGS[s];
    let bestFret = null;
    let bestPC = null;

    for (let f = minFret; f <= maxFret; f++) {
      const midi = openNote + f;
      const pc = midi % 12;
      if (targetPCs.has(pc)) {
        // Prefer: bass note on lowest strings, root on low strings
        if (s >= 4 && bassNote !== null && pc === bassNote % 12 && bestFret === null) {
          bestFret = f;
          bestPC = pc;
          break;
        }
        if (s >= 4 && pc === root % 12 && bestFret === null) {
          bestFret = f;
          bestPC = pc;
          break;
        }
        if (bestFret === null) {
          bestFret = f;
          bestPC = pc;
        }
      }
    }

    if (bestFret !== null) {
      frets[s] = bestFret;
      matchedPCs.add(bestPC);
    }
  }

  // Check: must have at least root + one other interval
  if (!matchedPCs.has(root % 12)) return null;
  if (matchedPCs.size < 2) return null;

  // Check: must cover most target pitch classes
  const coverage = [...targetPCs].filter(pc => matchedPCs.has(pc)).length;
  if (coverage < Math.min(targetPCs.size, 4)) return null;

  // Mute strings that don't match any target
  for (let s = 0; s < 6; s++) {
    if (frets[s] !== null) {
      const pc = (OPEN_STRINGS[s] + frets[s]) % 12;
      if (!targetPCs.has(pc)) {
        frets[s] = null;
      }
    }
  }

  // Ensure bass note is lowest if specified
  if (bassNote !== null) {
    let lowestPlayedString = -1;
    for (let s = 5; s >= 0; s--) {
      if (frets[s] !== null) { lowestPlayedString = s; break; }
    }
    if (lowestPlayedString >= 0) {
      const lowestPC = (OPEN_STRINGS[lowestPlayedString] + frets[lowestPlayedString]) % 12;
      if (lowestPC !== bassNote % 12) {
        // Try to fix by muting higher bass strings
        for (let s = 5; s > lowestPlayedString; s--) {
          if (frets[s] !== null) {
            const pc = (OPEN_STRINGS[s] + frets[s]) % 12;
            if (pc !== bassNote % 12) frets[s] = null;
          }
        }
      }
    }
  }

  return frets;
}

/** Cache for algorithmically generated voicings */
const _generatedCache = {};

/**
 * Try to generate a chord voicing from its name using music theory.
 * Returns { name, frets } or null.
 */
function generateChordFromName(name) {
  if (_generatedCache[name]) return { name, ..._generatedCache[name] };

  const parsed = parseChordName(name);
  if (!parsed) return null;

  const frets = generateVoicing(parsed.root, parsed.intervals, parsed.bassNote);
  if (!frets) return null;

  _generatedCache[name] = { frets };
  return { name, frets };
}

/**
 * Hand-curated extended chord database for common voicings that the
 * algorithm might not produce optimally.
 */
export const EXTENDED_CHORDS = {
  // === Extended major variants ===
  'Cadd9':    { frets: [0, 3, 0, 2, 3, null] },  // also in table
  'Cmaj9':    { frets: [0, 3, 0, 2, 3, null] },
  'C6':       { frets: [0, 1, 2, 2, 3, null] },
  'C9':       { frets: [0, 3, 3, 2, 3, null] },
  'Cdim':     { frets: [null, 1, 2, 1, 3, null] },
  'Caug':     { frets: [0, 1, 1, 2, 3, null] },
  'Cmaj7add9':{ frets: [0, 3, 0, 2, 3, null] },
  'C/E':      { frets: [0, 1, 0, 2, 3, 0] },
  'C/G':      { frets: [0, 1, 0, 2, 3, 3] },

  'Dadd9':    { frets: [0, 3, 2, 0, null, null] },
  'Dmaj9':    { frets: [0, 3, 2, 0, null, null] },
  'D6':       { frets: [2, 0, 2, 0, null, null] },
  'D9':       { frets: [0, 3, 2, 0, null, 2] },
  'Ddim':     { frets: [1, 0, 1, 0, null, null] },
  'Daug':     { frets: [3, 3, 2, 0, null, null] },
  'D/A':      { frets: [2, 3, 2, 0, 0, null] },

  'Eadd9':    { frets: [0, 0, 1, 4, 2, 0] },
  'E6':       { frets: [0, 2, 1, 2, 2, 0] },
  'E9':       { frets: [0, 2, 1, 2, 2, 0] },
  'Edim':     { frets: [null, 2, 0, 2, 1, null] },
  'Eaug':     { frets: [0, 0, 1, 3, 3, 0] },
  'Emaj7':    { frets: [0, 0, 1, 1, 2, 0] },

  'Fadd9':    { frets: [3, 1, 2, 3, null, null] },  // also in table
  'F6':       { frets: [1, 3, 2, 3, null, null] },
  'F9':       { frets: [1, 1, 0, 0, null, 1] },
  'Fdim':     { frets: [1, 0, 1, 2, null, null] },
  'Faug':     { frets: [1, 2, 2, 3, null, null] },
  'Fmaj7add9':{ frets: [0, 1, 0, 3, null, null] },
  'F/C':      { frets: [1, 1, 2, 3, 3, null] },

  'Gadd9':    { frets: [0, 0, 0, 0, 2, 3] },
  'G6':       { frets: [0, 0, 0, 0, 2, 3] },
  'G9':       { frets: [1, 0, 0, 0, 2, 3] },
  'Gdim':     { frets: [null, 2, 0, 2, null, 3] },
  'Gaug':     { frets: [3, 0, 1, 0, 2, 3] },
  'Gmaj7':    { frets: [2, 0, 0, 0, 2, 3] },
  'G/D':      { frets: [3, 0, 0, 0, null, null] },

  'Aadd9':    { frets: [0, 0, 4, 2, 0, null] },
  'A6':       { frets: [2, 2, 2, 2, 0, null] },
  'A9':       { frets: [0, 2, 4, 2, 0, null] },
  'Adim':     { frets: [null, 1, 2, 1, 0, null] },
  'Aaug':     { frets: [1, 2, 2, 2, 0, null] },
  'Amaj7':    { frets: [0, 2, 1, 2, 0, null] },
  'Am/E':     { frets: [0, 1, 2, 2, 0, 0] },
  'A/E':      { frets: [0, 2, 2, 2, 0, 0] },

  'Badd9':    { frets: [2, 0, 4, 4, 2, null] },
  'B6':       { frets: [null, 4, 4, 4, 2, null] },
  'B9':       { frets: [2, 2, 2, 1, 2, null] },
  'Bdim':     { frets: [null, 0, 1, 0, 2, null] },
  'Baug':     { frets: [3, 0, 0, 4, 4, null] },
  'Bmaj7':    { frets: [2, 4, 3, 4, 2, null] },

  // === Extended minor variants ===
  'Cm7':      { frets: [3, 4, 3, 5, 3, null] },
  'Cm6':      { frets: [null, 1, 2, 1, 3, null] },
  'Cm9':      { frets: [3, 3, 3, 5, 3, null] },
  'Cmadd9':   { frets: [null, 3, 1, 0, 3, null] },
  'Cdim7':    { frets: [null, 1, 2, 1, 2, null] },

  'Dm6':      { frets: [1, 0, 2, 0, null, null] },
  'Dm9':      { frets: [1, 1, 2, 0, null, null] },
  'Dmadd9':   { frets: [3, 3, 2, 0, null, null] },
  'Ddim7':    { frets: [1, 0, 1, 0, null, null] },

  'Em6':      { frets: [0, 2, 0, 2, 2, 0] },
  'Em9':      { frets: [0, 0, 0, 0, 2, 0] },
  'Edim7':    { frets: [null, 2, 0, 1, 1, null] },

  'Fm7':      { frets: [1, 1, 1, 1, null, 1] },
  'Fm6':      { frets: [1, null, 1, 1, null, 1] },
  'Fdim7':    { frets: [1, 0, 1, 0, null, null] },

  'F#7':      { frets: [2, 2, 3, 2, 4, 2] },
  'F#m7':     { frets: [2, 2, 2, 2, 4, 2] },
  'F#dim':    { frets: [null, 0, 1, 2, 1, 2] },
  'F#dim7':   { frets: [null, 0, 1, 2, 1, null] },

  'Gm7':      { frets: [3, 3, 3, 3, 5, 3] },
  'Gm6':      { frets: [3, null, 3, 3, null, 3] },
  'Gdim7':    { frets: [null, 2, 0, 1, null, null] },

  'G#7':      { frets: [4, 4, 5, 4, 4, null] },
  'G#m7':     { frets: [4, 4, 4, 4, null, 4] },
  'Abm':      { frets: [4, 4, 4, 6, 4, null] },
  'Abm7':     { frets: [4, 4, 4, 4, 4, null] },
  'Ab7':      { frets: [4, 4, 5, 4, 4, null] },
  'Abdim':    { frets: [null, 2, 0, 1, null, null] },

  'Am6':      { frets: [2, 1, 2, 2, 0, null] },
  'Am9':      { frets: [0, 1, 0, 2, 0, null] },
  'Amadd9':   { frets: [0, 0, 2, 2, 0, null] },
  'Adim7':    { frets: [null, 1, 2, 0, 2, null] },

  'B♭7':      { frets: [1, 3, 1, 3, 1, null] },
  'B♭m7':     { frets: [1, 2, 1, 3, 1, null] },
  'B♭6':      { frets: [1, 3, 3, 0, 1, null] },
  'B♭dim':    { frets: [null, 2, 3, 2, 1, null] },
  'B♭dim7':   { frets: [null, 2, 0, 2, 1, null] },
  'Bbdim':    { frets: [null, 2, 3, 2, 1, null] },

  'Bm6':      { frets: [null, 0, 4, 4, 2, null] },
  'Bm9':      { frets: [2, 2, 2, 2, 2, null] },
  'Bdim7':    { frets: [null, 0, 1, 0, 2, null] },

  // === Suspended variants ===
  'Csus2':    { frets: [0, 1, 0, 0, 3, null] },
  'Esus2':    { frets: [0, 0, 4, 2, 2, 0] },
  'Fsus2':    { frets: [1, 1, 0, 0, null, null] },
  'Fsus4':    { frets: [1, 1, 3, 3, null, null] },
  'Gsus2':    { frets: [0, 0, 0, 0, 2, 3] },
  'Bsus2':    { frets: [2, 2, 4, 4, 2, null] },
  'Bsus4':    { frets: [2, 5, 4, 4, 2, null] },
  'Asus2add9':{ frets: [0, 0, 2, 2, 0, null] },

  // === 7th variants ===
  'Cmaj7':    { frets: [0, 0, 0, 2, 3, null] },  // also in table
  'Dmaj7':    { frets: [2, 2, 2, 0, null, null] },
  'Emaj7':    { frets: [0, 0, 1, 1, 2, 0] },
  'Fmaj7':    { frets: [0, 1, 2, 3, null, null] },  // also in table
  'Gmaj7':    { frets: [2, 0, 0, 0, 2, 3] },
  'Amaj7':    { frets: [0, 2, 1, 2, 0, null] },
  'Bmaj7':    { frets: [2, 4, 3, 4, 2, null] },
  'C#7':      { frets: [null, 2, 1, 3, 4, null] },
  'C#m7':     { frets: [null, 2, 1, 2, 4, null] },
  'D#7':      { frets: [null, 4, 3, 5, 6, null] },
  'E♭7':      { frets: [null, 4, 3, 5, 6, null] },
  'E♭m7':     { frets: [null, 4, 3, 4, 6, null] },
  'F#7':      { frets: [2, 2, 3, 2, 4, 2] },
  'A♭7':      { frets: [4, 4, 5, 4, 4, null] },
  'B♭7':      { frets: [1, 3, 1, 3, 1, null] },

  // === 9th, 11th, 13th ===
  'Cmaj9':    { frets: [0, 3, 0, 2, 3, null] },
  'Dmaj9':    { frets: [0, 3, 2, 0, null, null] },
  'G11':      { frets: [1, 0, 0, 0, 2, 3] },
  'C11':      { frets: [null, 1, 3, 2, 3, null] },
  'Am11':     { frets: [0, 0, 0, 2, 0, null] },
  'E11':      { frets: [0, 0, 1, 0, 2, 0] },

  // === Power chords ===
  'C5':       { frets: [null, null, null, null, 3, null] },
  'D5':       { frets: [null, null, null, 0, null, null] },
  'E5':       { frets: [null, null, null, 2, 2, 0] },
  'F5':       { frets: [null, null, null, 3, 3, 1] },
  'G5':       { frets: [null, null, null, 0, null, 3] },
  'A5':       { frets: [null, null, null, 2, 0, null] },
  'B5':       { frets: [null, null, null, 4, 2, null] },

  // === Slash chords ===
  'Am/E':     { frets: [0, 1, 2, 2, 0, 0] },
  'Am/C':     { frets: [0, 1, 2, 2, 3, null] },
  'C/B':      { frets: [0, 1, 0, 2, null, null] },
  'Em/D':     { frets: [0, 0, 0, 2, null, null] },
  'Em/B':     { frets: [0, 0, 0, 2, 2, null] },
  'Dm/C':     { frets: [1, 3, 2, 0, 3, null] },
  'G/F#':     { frets: [3, 0, 0, 0, null, 2] },
  'A/C#':     { frets: [0, 2, 2, 2, 4, null] },
  'E/G#':     { frets: [0, 0, 1, 2, 2, 4] },

  // === Add chords ===
  'Eadd9':    { frets: [0, 0, 1, 4, 2, 0] },
  'Gadd9':    { frets: [0, 0, 0, 0, 2, 3] },
  'Fmaj7add9':{ frets: [0, 1, 0, 3, null, null] },
  'Dadd11':   { frets: [0, 3, 2, 0, null, null] },

  // === Augmented ===
  'Caug7':    { frets: [0, 1, 1, 0, 3, null] },
  'Eaug7':    { frets: [0, 0, 1, 3, 3, 0] },

  // === N.C. (No Chord) ===
  'N.C.':     { frets: [null, null, null, null, null, null] },
};

/**
 * Look up a chord by name. Searches CHORD_DB (table chords) first,
 * then EXTENDED_CHORDS. Accepts common aliases and normalizes flats.
 * @param {string} name
 * @returns {ChordVoicing|null}
 */
export function lookupChord(name) {
  if (!name) return null;

  // Normalize: uppercase first letter
  let n = name.charAt(0).toUpperCase() + name.slice(1);

  // Search both databases
  const dbs = [CHORD_DB, EXTENDED_CHORDS];

  for (const db of dbs) {
    if (db[n]) return { name: n, ...db[n] };
  }

  // Try normalizing b → ♭
  const withFlat = n.replace(/([A-G])b(?!$)/g, (_, note) => note + '♭');
  for (const db of dbs) {
    if (db[withFlat]) return { name: withFlat, ...db[withFlat] };
  }

  const withFlat2 = n.replace(/^([A-G])b(.*)$/, (_, note, rest) => note + '♭' + rest);
  for (const db of dbs) {
    if (db[withFlat2]) return { name: withFlat2, ...db[withFlat2] };
  }

  // Fall back to algorithmic generation
  const generated = generateChordFromName(n);
  if (generated) return generated;

  // Try with flat normalization
  const genFlat = generateChordFromName(withFlat) || generateChordFromName(withFlat2);
  if (genFlat) return genFlat;

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
