/**
 * Tests for identifying a chord name from a hand-edited voicing.
 * Fret arrays are [e, B, G, D, A, E] (high to low); null = string not played.
 */

import { identifyChord, lookupChord, CHORD_DB } from '../../js/model/chords.js';

describe('identifyChord: basic triads', () => {
  const cases = [
    ['C', [0, 1, 0, 2, 3, null]],
    ['Am', [0, 1, 2, 2, 0, null]],
    ['E', [0, 0, 1, 2, 2, 0]],
    ['Em', [0, 0, 0, 2, 2, 0]],
    ['G', [3, 0, 0, 0, 2, 3]],
    ['D', [2, 3, 2, 0, null, null]],
    ['A', [0, 2, 2, 2, 0, null]],
    ['F', [1, 1, 2, 3, null, null]],
  ];

  for (const [name, frets] of cases) {
    test(`${name} is identified`, () => {
      expect(identifyChord(frets)).toBe(name);
    });
  }
});

describe('identifyChord: slash chords', () => {
  test('C with a G bass is C/G', () => {
    expect(identifyChord([0, 1, 0, 2, 3, 3])).toBe('C/G');
  });

  test('C with an E bass is C/E', () => {
    expect(identifyChord([0, 1, 0, 2, 3, 0])).toBe('C/E');
  });

  test('D with an F# bass is D/F#', () => {
    expect(identifyChord([2, 3, 2, 0, null, 2])).toBe('D/F#');
  });

  test('G with a B bass is G/B', () => {
    expect(identifyChord([3, 0, 0, 0, 2, null])).toBe('G/B');
  });

  test('E with a G# bass spells the bass as a sharp', () => {
    expect(identifyChord([0, 0, 1, 2, 2, 4])).toBe('E/G#');
  });

  test('Am with a C bass is Am/C, not C6 without a fifth', () => {
    expect(identifyChord([0, 1, 2, 2, 3, null])).toBe('Am/C');
  });

  test('Em with a G bass is Em/G, not G6 without a fifth', () => {
    expect(identifyChord([0, 0, 0, 2, null, 3])).toBe('Em/G');
  });
});

describe('identifyChord: sevenths and extensions', () => {
  test('A7', () => {
    expect(identifyChord([0, 2, 0, 2, 0, null])).toBe('A7');
  });

  test('Am7', () => {
    expect(identifyChord([0, 1, 0, 2, 0, null])).toBe('Am7');
  });

  test('Cmaj7', () => {
    expect(identifyChord([0, 0, 0, 2, 3, null])).toBe('Cmaj7');
  });

  test('Dsus4', () => {
    expect(identifyChord([3, 3, 2, 0, null, null])).toBe('Dsus4');
  });

  test('Dsus2', () => {
    expect(identifyChord([0, 3, 2, 0, null, null])).toBe('Dsus2');
  });

  test('Cadd9', () => {
    expect(identifyChord([0, 3, 0, 2, 3, null])).toBe('Cadd9');
  });

  test('A6 keeps its name when A is in the bass', () => {
    expect(identifyChord([2, 2, 2, 2, 0, null])).toBe('A6');
  });

  test('Am6 and F#m7b5 share notes; the bass decides', () => {
    // A C E F#
    expect(identifyChord([2, 1, 2, 2, 0, null])).toBe('Am6');
    expect(identifyChord([2, 1, 2, 2, 0, 2])).toBe('F#m7b5');
  });

  test('E7#9 (the Hendrix chord)', () => {
    expect(identifyChord([null, 8, 7, 6, 7, null])).toBe('E7#9');
  });

  test('Cdim7', () => {
    expect(identifyChord([null, 4, 2, 4, 3, null])).toBe('Cdim7');
  });

  test('Caug', () => {
    expect(identifyChord([0, 1, 1, 2, 3, null])).toBe('Caug');
  });

  test('a power chord is named with 5', () => {
    expect(identifyChord([null, null, null, 2, 2, 0])).toBe('E5');
  });

  test('a dominant ninth voicing that drops the fifth', () => {
    // C E B♭ D
    expect(identifyChord([3, 3, 3, 2, 3, null])).toBe('C9');
  });
});

describe('identifyChord: unidentifiable voicings', () => {
  test('no strings played returns null', () => {
    expect(identifyChord([null, null, null, null, null, null])).toBeNull();
  });

  test('a single note returns null', () => {
    expect(identifyChord([null, null, null, null, 3, null])).toBeNull();
  });

  test('octaves of one note return null', () => {
    expect(identifyChord([null, null, 5, null, 3, null])).toBeNull();
  });

  test('a chromatic cluster returns null', () => {
    expect(identifyChord([0, 1, 2, 3, 4, 5])).toBeNull();
  });
});

describe('identifyChord: names round-trip through lookupChord', () => {
  const voicings = [
    [0, 1, 0, 2, 3, 3],
    [2, 3, 2, 0, null, 2],
    [0, 1, 2, 2, 3, null],
    [null, 8, 7, 6, 7, null],
    [2, 1, 2, 2, 0, 2],
    [3, 3, 3, 2, 3, null],
  ];

  for (const frets of voicings) {
    const name = identifyChord(frets);
    test(`${name} is a recognized chord name`, () => {
      expect(name).not.toBeNull();
      expect(lookupChord(name)).not.toBeNull();
    });
  }
});

describe('lookupChord does not alias the chord database', () => {
  test('editing a looked-up voicing leaves CHORD_DB untouched', () => {
    const original = [...CHORD_DB['C'].frets];
    const chord = lookupChord('C');
    chord.frets[5] = 3;
    expect(CHORD_DB['C'].frets).toEqual(original);
  });
});
