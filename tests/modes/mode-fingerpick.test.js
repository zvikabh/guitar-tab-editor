/**
 * Tests for Fingerpick Edit mode and chord database.
 */

import { CHORD_DB, CHORD_TABLE, lookupChord, getChordFret } from '../../js/model/chords.js';
import {
  createTabRowBlock,
  ensureColumns,
  insertNote,
} from '../../js/model/document.js';

describe('Chord Database', () => {
  test('contains all 48 chords (12 columns × 4 rows)', () => {
    expect(Object.keys(CHORD_DB).length).toBe(48);
  });

  test('all chords have 6-element frets array', () => {
    for (const [name, chord] of Object.entries(CHORD_DB)) {
      expect(chord.frets).toHaveLength(6);
    }
  });

  test('all fret values are null or numbers 0-24', () => {
    for (const [name, chord] of Object.entries(CHORD_DB)) {
      for (const fret of chord.frets) {
        if (fret !== null) {
          expect(typeof fret).toBe('number');
          expect(fret).toBeGreaterThanOrEqual(0);
          expect(fret).toBeLessThanOrEqual(24);
        }
      }
    }
  });

  test('C major has correct voicing', () => {
    expect(CHORD_DB['C'].frets).toEqual([0, 1, 0, 2, 3, null]);
  });

  test('Am has correct voicing', () => {
    expect(CHORD_DB['Am'].frets).toEqual([0, 1, 2, 2, 0, null]);
  });

  test('G has correct voicing', () => {
    expect(CHORD_DB['G'].frets).toEqual([3, 0, 0, 0, 2, 3]);
  });

  test('E♭ uses unicode flat', () => {
    expect(CHORD_DB['E♭']).toBeDefined();
    expect(CHORD_DB['E♭'].frets).toHaveLength(6);
  });
});

describe('Chord Table Layout', () => {
  test('has 4 rows', () => {
    expect(CHORD_TABLE).toHaveLength(4);
  });

  test('each row has 12 entries', () => {
    for (const row of CHORD_TABLE) {
      expect(row).toHaveLength(12);
    }
  });

  test('row 1 is all major chords', () => {
    expect(CHORD_TABLE[0]).toEqual(
      ['C', 'C#', 'D', 'E♭', 'E', 'F', 'F#', 'G', 'A♭', 'A', 'B♭', 'B']
    );
  });

  test('row 2 is all minor chords', () => {
    expect(CHORD_TABLE[1]).toEqual(
      ['Cm', 'C#m', 'Dm', 'E♭m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'B♭m', 'Bm']
    );
  });

  test('all non-null table entries exist in CHORD_DB', () => {
    for (const row of CHORD_TABLE) {
      for (const name of row) {
        if (name) {
          expect(CHORD_DB[name]).toBeDefined();
        }
      }
    }
  });
});

describe('lookupChord', () => {
  test('finds chord by exact name', () => {
    const result = lookupChord('Am');
    expect(result).not.toBeNull();
    expect(result.name).toBe('Am');
    expect(result.frets).toEqual([0, 1, 2, 2, 0, null]);
  });

  test('normalizes b to ♭', () => {
    const result = lookupChord('Eb');
    expect(result).not.toBeNull();
    expect(result.name).toBe('E♭');
  });

  test('normalizes Bb to B♭', () => {
    const result = lookupChord('Bb');
    expect(result).not.toBeNull();
    expect(result.name).toBe('B♭');
  });

  test('returns null for unknown chord', () => {
    expect(lookupChord('Xaug7b13')).toBeNull();
  });
});

describe('getChordFret', () => {
  test('returns fret for played string', () => {
    expect(getChordFret('C', 0)).toBe(0);  // e string open
    expect(getChordFret('C', 1)).toBe(1);  // B string fret 1
    expect(getChordFret('C', 4)).toBe(3);  // A string fret 3
  });

  test('returns null for unplayed string', () => {
    expect(getChordFret('C', 5)).toBeNull();  // E string not played
  });

  test('returns null for unknown chord', () => {
    expect(getChordFret('Xdim7', 0)).toBeNull();
  });
});

describe('Fingerpick: chord-based note insertion', () => {
  test('inserting notes from Am chord produces correct fret numbers', () => {
    const block = createTabRowBlock({
      strings: ['|', '|', '|', '|', '|', '|'],
    });
    ensureColumns(block);

    // Am voicing: [0, 1, 2, 2, 0, null]
    const amFrets = CHORD_DB['Am'].frets;

    // Insert A string (index 4, fret 0)
    const notes1 = [null, null, null, null, String(amFrets[4]), null];
    insertNote(block, 0, notes1, '1/8');

    // Insert D string (index 3, fret 2)
    const notes2 = [null, null, null, String(amFrets[3]), null, null];
    insertNote(block, 2, notes2, '1/8');

    // Insert G string (index 2, fret 2)
    const notes3 = [null, null, String(amFrets[2]), null, null, null];
    insertNote(block, 4, notes3, '1/8');

    expect(block.strings[4]).toContain('0'); // A string has fret 0
    expect(block.strings[3]).toContain('2'); // D string has fret 2
    expect(block.strings[2]).toContain('2'); // G string has fret 2
  });

  test('inserting from G chord with open strings', () => {
    const block = createTabRowBlock({
      strings: ['|', '|', '|', '|', '|', '|'],
    });
    ensureColumns(block);

    // G voicing: [3, 0, 0, 0, 2, 3]
    const gFrets = CHORD_DB['G'].frets;

    // Insert low E string (index 5, fret 3)
    const notes = [null, null, null, null, null, String(gFrets[5])];
    insertNote(block, 0, notes, '1/4');

    expect(block.strings[5]).toContain('3');
    // 1/4 note should have 3-hyphen spacing
    expect(block.strings[0].indexOf('|') - block.strings[0].indexOf('-')).toBeGreaterThanOrEqual(3);
  });
});
