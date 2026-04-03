/**
 * Tests for rejecting invalid chord names.
 */

import { lookupChord } from '../../js/model/chords.js';

describe('Reject invalid chord names', () => {
  test('Cma is not a valid chord', () => {
    expect(lookupChord('Cma')).toBeNull();
  });

  test('Cfqpj is not a valid chord', () => {
    expect(lookupChord('Cfqpj')).toBeNull();
  });

  test('Xyz is not a valid chord', () => {
    expect(lookupChord('Xyz')).toBeNull();
  });

  test('Cminor is not a valid chord (use Cm)', () => {
    expect(lookupChord('Cminor')).toBeNull();
  });

  test('Cmajor is not a valid chord (use C)', () => {
    expect(lookupChord('Cmajor')).toBeNull();
  });

  test('C# is valid', () => {
    expect(lookupChord('C#')).not.toBeNull();
  });

  test('Cmadd9 is valid', () => {
    expect(lookupChord('Cmadd9')).not.toBeNull();
  });

  test('Cabc is not a valid chord', () => {
    expect(lookupChord('Cabc')).toBeNull();
  });

  test('Gblah is not a valid chord', () => {
    expect(lookupChord('Gblah')).toBeNull();
  });

  test('C## is not a valid chord', () => {
    expect(lookupChord('C##')).toBeNull();
  });

  test('empty string returns null', () => {
    expect(lookupChord('')).toBeNull();
  });

  test('single letter H is not a valid chord', () => {
    expect(lookupChord('H')).toBeNull();
  });

  test('Am7 is valid', () => {
    expect(lookupChord('Am7')).not.toBeNull();
  });

  test('Dsus4 is valid', () => {
    expect(lookupChord('Dsus4')).not.toBeNull();
  });

  test('Cmaj7add11 is valid', () => {
    expect(lookupChord('Cmaj7add11')).not.toBeNull();
  });

  test('Cm7b5 is valid', () => {
    expect(lookupChord('Cm7b5')).not.toBeNull();
  });
});
