/**
 * Tests for the algorithmic chord generator.
 */

import { lookupChord, CHORD_DB } from '../../js/model/chords.js';

describe('Chord generator: complex chords', () => {
  test('Cmaj7add11 is resolved', () => {
    const chord = lookupChord('Cmaj7add11');
    expect(chord).not.toBeNull();
    expect(chord.frets).toHaveLength(6);
  });

  test('Cmaj7add9 is resolved', () => {
    const chord = lookupChord('Cmaj7add9');
    expect(chord).not.toBeNull();
  });

  test('Dm7b5 (half diminished) is resolved', () => {
    const chord = lookupChord('Dm7b5');
    expect(chord).not.toBeNull();
  });

  test('G#aug7 is resolved', () => {
    const chord = lookupChord('G#aug7');
    expect(chord).not.toBeNull();
  });

  test('F#m7b5 is resolved', () => {
    const chord = lookupChord('F#m7b5');
    expect(chord).not.toBeNull();
  });

  test('Bbmaj9 is resolved', () => {
    const chord = lookupChord('Bbmaj9');
    expect(chord).not.toBeNull();
  });

  test('Eb13 is resolved', () => {
    const chord = lookupChord('Eb13');
    expect(chord).not.toBeNull();
  });

  test('Asus4add9 is resolved', () => {
    const chord = lookupChord('Asus4add9');
    expect(chord).not.toBeNull();
  });

  test('Cdim7 is resolved', () => {
    const chord = lookupChord('Cdim7');
    expect(chord).not.toBeNull();
  });

  test('E7#9 (Hendrix chord) is resolved', () => {
    const chord = lookupChord('E7#9');
    expect(chord).not.toBeNull();
  });

  test('Am11 is resolved', () => {
    const chord = lookupChord('Am11');
    expect(chord).not.toBeNull();
  });

  test('D/F# from table still works', () => {
    const chord = lookupChord('D/F#');
    expect(chord).not.toBeNull();
    expect(chord.frets).toEqual([2, 3, 2, 0, null, 2]);
  });

  test('Fmaj7add9 is resolved', () => {
    const chord = lookupChord('Fmaj7add9');
    expect(chord).not.toBeNull();
  });
});

describe('Chord generator: generated chords have valid frets', () => {
  const testChords = [
    'C', 'Cm', 'C7', 'Cmaj7', 'Cm7', 'Cdim', 'Caug', 'Csus2', 'Csus4',
    'C6', 'C9', 'Cmaj9', 'Cm9', 'Cdim7', 'Caug7', 'C11', 'C13',
    'Cmaj7add11', 'Cmaj7add9', 'Cm7b5',
    'D', 'E', 'F', 'G', 'A', 'B',
    'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm',
  ];

  for (const name of testChords) {
    test(`${name} resolves with valid fret numbers`, () => {
      const chord = lookupChord(name);
      expect(chord).not.toBeNull();
      expect(chord.frets).toHaveLength(6);
      for (const f of chord.frets) {
        if (f !== null) {
          expect(f).toBeGreaterThanOrEqual(0);
          expect(f).toBeLessThanOrEqual(24);
        }
      }
    });
  }
});

describe('Chord generator: table chords take precedence', () => {
  test('C from table has the standard open voicing', () => {
    const chord = lookupChord('C');
    expect(chord.frets).toEqual(CHORD_DB['C'].frets);
  });

  test('Am from table has the standard open voicing', () => {
    const chord = lookupChord('Am');
    expect(chord.frets).toEqual(CHORD_DB['Am'].frets);
  });
});
