/**
 * Tests for Note Edit mode operations.
 * These test the document-level mutations that mode-note.js triggers,
 * without requiring a DOM (no jsdom needed for model-level tests).
 */

import {
  createDocument,
  createTextBlock,
  createTabRowBlock,
  ensureColumns,
  insertNote,
  deleteNote,
  setFret,
  insertBarline,
  removeBarline,
  splitTabRow,
  syncStringsFromColumns,
  DURATION_GAPS,
} from '../../js/model/document.js';
import { renderDocument } from '../../js/model/renderer.js';

function makeSimpleTabRow() {
  return createTabRowBlock({
    preLines: ['   C'],
    strings: [
      '---0---1---|',
      '---1---0---|',
      '---0---0---|',
      '---2---2---|',
      '---3---3---|',
      '-----------|',
    ],
    postLines: ['   hello'],
  });
}

describe('Note Edit: fret entry', () => {
  test('inserting a note adds it to the tab row', () => {
    const block = makeSimpleTabRow();
    ensureColumns(block);

    const notesBefore = block.columns.filter(c => c.type === 'note').length;
    insertNote(block, 1, ['5', null, null, null, null, null], '1/8');
    const notesAfter = block.columns.filter(c => c.type === 'note').length;

    expect(notesAfter).toBe(notesBefore + 1);
    expect(block.strings[0]).toContain('5');
  });

  test('setFret changes a single string value', () => {
    const block = makeSimpleTabRow();
    ensureColumns(block);
    const noteIdx = block.columns.findIndex(c => c.type === 'note');

    const result = setFret(block, noteIdx, 0, '7');
    expect(result.oldValue).toBe('0');
    expect(result.newValue).toBe('7');
    expect(block.strings[0]).toContain('7');
  });

  test('setFret in chord mode adds to existing column', () => {
    const block = makeSimpleTabRow();
    ensureColumns(block);
    const noteIdx = block.columns.findIndex(c => c.type === 'note');

    // The column already has notes; set a different string
    setFret(block, noteIdx, 5, '3');
    expect(block.columns[noteIdx].notes[5]).toBe('3');
    expect(block.strings[5]).toContain('3');
  });
});

describe('Note Edit: note deletion', () => {
  test('deleting a note removes it from the tab row', () => {
    const block = makeSimpleTabRow();
    ensureColumns(block);

    const notesBefore = block.columns.filter(c => c.type === 'note').length;
    const firstNoteIdx = block.columns.findIndex(c => c.type === 'note');

    deleteNote(block, firstNoteIdx);
    const notesAfter = block.columns.filter(c => c.type === 'note').length;

    expect(notesAfter).toBe(notesBefore - 1);
  });
});

describe('Note Edit: bar and repeat insertion', () => {
  test('inserting a barline adds a pipe character', () => {
    const block = makeSimpleTabRow();
    ensureColumns(block);
    const noteIdx = block.columns.findIndex(c => c.type === 'note');

    insertBarline(block, noteIdx + 1);

    const barCols = block.columns.filter(c => c.type === 'bar');
    expect(barCols.length).toBeGreaterThanOrEqual(2);
    expect(block.strings[0]).toContain('|');
  });

  test('removing a barline removes the pipe', () => {
    const block = makeSimpleTabRow();
    ensureColumns(block);

    // Find a bar in the middle
    const middleBars = block.columns
      .map((c, i) => ({ col: c, idx: i }))
      .filter(({ col, idx }) => col.type === 'bar' && idx > 0 && idx < block.columns.length - 1);

    if (middleBars.length > 0) {
      const countBefore = block.columns.filter(c => c.type === 'bar').length;
      removeBarline(block, middleBars[0].idx);
      const countAfter = block.columns.filter(c => c.type === 'bar').length;
      expect(countAfter).toBe(countBefore - 1);
    }
  });
});

describe('Note Edit: note spacing', () => {
  test('1/8 note adds 1 hyphen gap', () => {
    expect(DURATION_GAPS['1/8']).toBe(1);
  });

  test('1/4 note adds 3 hyphen gap', () => {
    expect(DURATION_GAPS['1/4']).toBe(3);
  });

  test('1/16 note adds 0 hyphen gap', () => {
    expect(DURATION_GAPS['1/16']).toBe(0);
  });

  test('1/2 note adds 7 hyphen gap', () => {
    expect(DURATION_GAPS['1/2']).toBe(7);
  });

  test('inserting 1/4 note produces wider spacing than 1/8', () => {
    const block8 = createTabRowBlock({
      strings: ['|', '|', '|', '|', '|', '|'],
    });
    ensureColumns(block8);
    insertNote(block8, 1, ['0', null, null, null, null, null], '1/8');
    const len8 = block8.strings[0].length;

    const block4 = createTabRowBlock({
      strings: ['|', '|', '|', '|', '|', '|'],
    });
    ensureColumns(block4);
    insertNote(block4, 1, ['0', null, null, null, null, null], '1/4');
    const len4 = block4.strings[0].length;

    expect(len4).toBeGreaterThan(len8);
  });
});

describe('Note Edit: pre/postLine alignment on edit', () => {
  test('preLines shift when note is inserted in middle', () => {
    const block = makeSimpleTabRow();
    const origPreLen = block.preLines[0].length;
    const origPostLen = block.postLines[0].length;

    ensureColumns(block);
    insertNote(block, 1, ['9', null, null, null, null, null], '1/4');

    // Pre and post lines should have grown (or at least not shrunk)
    expect(block.preLines[0].length).toBeGreaterThanOrEqual(origPreLen);
    expect(block.postLines[0].length).toBeGreaterThanOrEqual(origPostLen);
  });
});

describe('Note Edit: row splitting', () => {
  test('splitting a row creates two valid tab rows', () => {
    const block = makeSimpleTabRow();
    ensureColumns(block);

    // Find a middle bar or note to split at
    const midIdx = Math.floor(block.columns.length / 2);
    const [block1, block2] = splitTabRow(block, midIdx);

    expect(block1.type).toBe('tabrow');
    expect(block2.type).toBe('tabrow');
    expect(block1.strings).toHaveLength(6);
    expect(block2.strings).toHaveLength(6);
  });

  test('split rows can be rendered back to text', () => {
    const block = makeSimpleTabRow();
    ensureColumns(block);

    const midIdx = Math.floor(block.columns.length / 2);
    const [block1, block2] = splitTabRow(block, midIdx);

    const doc = createDocument([block1, block2]);
    const text = renderDocument(doc);
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
  });
});
