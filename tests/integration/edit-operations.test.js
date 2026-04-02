/**
 * Integration tests: multi-step edit sequences with undo/redo verification.
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
  splitTabRow,
  cloneDocument,
} from '../../js/model/document.js';
import { parseTabText } from '../../js/model/parser.js';
import { renderDocument } from '../../js/model/renderer.js';
import { UndoManager } from '../../js/model/undo.js';

function makeDoc() {
  return createDocument([
    createTextBlock(['Test Song']),
    createTabRowBlock({
      preLines: ['   Am'],
      strings: ['|', '|', '|', '|', '|', '|'],
      postLines: ['   la la'],
    }),
  ]);
}

describe('Multi-step edit with undo/redo', () => {
  test('insert 3 notes, undo 2, redo 1', () => {
    const doc = makeDoc();
    const um = new UndoManager();
    const block = doc.blocks[1];

    // Insert note 1
    um.pushSnapshot(doc);
    ensureColumns(block);
    insertNote(block, 0, ['0', null, null, null, null, null], '1/8');
    expect(block.strings[0]).toContain('0');

    // Insert note 2
    um.pushSnapshot(doc);
    insertNote(block, 2, ['2', null, null, null, null, null], '1/8');
    expect(block.strings[0]).toContain('2');

    // Insert note 3
    um.pushSnapshot(doc);
    insertNote(block, 4, ['3', null, null, null, null, null], '1/8');
    expect(block.strings[0]).toContain('3');

    // Undo once → note 3 should be gone
    const r1 = um.undo(doc);
    expect(r1).not.toBeNull();
    const b1 = r1.doc.blocks[1];
    ensureColumns(b1);
    const notes1 = b1.columns.filter(c => c.type === 'note');
    expect(notes1).toHaveLength(2);

    // Undo again → note 2 gone
    const r2 = um.undo(r1.doc);
    const b2 = r2.doc.blocks[1];
    ensureColumns(b2);
    const notes2 = b2.columns.filter(c => c.type === 'note');
    expect(notes2).toHaveLength(1);

    // Redo → note 2 back
    const r3 = um.redo(r2.doc);
    const b3 = r3.doc.blocks[1];
    ensureColumns(b3);
    const notes3 = b3.columns.filter(c => c.type === 'note');
    expect(notes3).toHaveLength(2);
  });

  test('insert note, set fret, delete note, undo all', () => {
    const doc = makeDoc();
    const um = new UndoManager();
    const block = doc.blocks[1];

    // Insert
    um.pushSnapshot(doc);
    ensureColumns(block);
    insertNote(block, 0, ['5', null, null, null, null, null], '1/8');

    // Change fret
    um.pushSnapshot(doc);
    const noteIdx = block.columns.findIndex(c => c.type === 'note');
    setFret(block, noteIdx, 0, '7');
    expect(block.columns[noteIdx].notes[0]).toBe('7');

    // Delete
    um.pushSnapshot(doc);
    deleteNote(block, noteIdx);
    const notesAfter = block.columns.filter(c => c.type === 'note');
    expect(notesAfter).toHaveLength(0);

    // Undo delete → note back with fret 7
    const r1 = um.undo(doc);
    const b1 = r1.doc.blocks[1];
    ensureColumns(b1);
    const restoredNote = b1.columns.find(c => c.type === 'note');
    expect(restoredNote).toBeTruthy();
    expect(restoredNote.notes[0]).toBe('7');

    // Undo setFret → fret back to 5
    const r2 = um.undo(r1.doc);
    const b2 = r2.doc.blocks[1];
    ensureColumns(b2);
    const note2 = b2.columns.find(c => c.type === 'note');
    expect(note2.notes[0]).toBe('5');

    // Undo insert → no notes
    const r3 = um.undo(r2.doc);
    const b3 = r3.doc.blocks[1];
    ensureColumns(b3);
    expect(b3.columns.filter(c => c.type === 'note')).toHaveLength(0);
  });

  test('split row and undo restores original', () => {
    const doc = makeDoc();
    const um = new UndoManager();
    const block = doc.blocks[1];

    // Insert a few notes first
    ensureColumns(block);
    insertNote(block, 0, ['0', '1', '0', '2', '3', null], '1/8');
    insertNote(block, 2, ['3', '0', '0', '0', '2', '3'], '1/8');
    insertNote(block, 4, ['0', '1', '2', '2', '0', null], '1/8');

    const beforeSplit = cloneDocument(doc);

    // Split
    um.pushSnapshot(doc);
    ensureColumns(block);
    const midIdx = Math.floor(block.columns.length / 2);
    const [b1, b2] = splitTabRow(block, midIdx);
    doc.blocks.splice(1, 1, b1, b2);

    expect(doc.blocks.filter(b => b.type === 'tabrow')).toHaveLength(2);

    // Undo → single row restored
    const r = um.undo(doc);
    expect(r.doc.blocks.filter(b => b.type === 'tabrow')).toHaveLength(1);
  });
});

describe('Roundtrip after edits', () => {
  test('parse → edit → render → parse roundtrips consistently', () => {
    const input = [
      'Test Song',
      '',
      '   Am',
      'e|---0---1---|',
      'B|---1---0---|',
      'G|---2---0---|',
      'D|---2---2---|',
      'A|---0---3---|',
      'E|-----------|',
      '   hello world',
      '',
    ].join('\n') + '\n';

    const doc = parseTabText(input);
    const text1 = renderDocument(doc);

    // Parse the rendered text and render again
    const doc2 = parseTabText(text1);
    const text2 = renderDocument(doc2);

    expect(text2).toBe(text1);
  });
});

describe('Edge cases', () => {
  test('empty document parses and renders', () => {
    const doc = parseTabText('\n');
    expect(doc.blocks.length).toBeGreaterThanOrEqual(0);
    const text = renderDocument(doc);
    expect(typeof text).toBe('string');
  });

  test('document with only text (no tabs)', () => {
    const input = 'Just some text\nNo tabs here\n';
    const doc = parseTabText(input);
    expect(doc.blocks.every(b => b.type === 'text')).toBe(true);
    const text = renderDocument(doc);
    expect(text).toBe(input);
  });

  test('tab with single note', () => {
    const input = [
      'e|0|',
      'B|-|',
      'G|-|',
      'D|-|',
      'A|-|',
      'E|-|',
    ].join('\n') + '\n';

    const doc = parseTabText(input);
    expect(doc.blocks.some(b => b.type === 'tabrow')).toBe(true);
    const text = renderDocument(doc);
    expect(text).toBe(input);
  });

  test('handles double-digit fret numbers', () => {
    const block = createTabRowBlock({
      strings: ['|', '|', '|', '|', '|', '|'],
    });
    ensureColumns(block);
    insertNote(block, 0, ['12', null, null, null, null, null], '1/8');

    expect(block.strings[0]).toContain('12');
    // Other strings should be padded to match width
    expect(block.strings[1].indexOf('--')).toBeGreaterThanOrEqual(0);
  });
});
