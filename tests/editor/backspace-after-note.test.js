/**
 * @jest-environment jsdom
 */

if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

import {
  createDocument,
  createTextBlock,
  createTabRowBlock,
  ensureColumns,
  insertRepeatStart,
} from '../../js/model/document.js';
import { UndoManager } from '../../js/model/undo.js';
import { BaseTabEditMode } from '../../js/modes/mode-base-tab.js';
import { Editor } from '../../js/editor/editor.js';

function getEditorLineTexts(block) {
  const container = document.createElement('div');
  const editor = new Editor(container, createDocument([block]));
  editor.renderAll();
  const lines = container.querySelectorAll('.line-tab');
  return Array.from(lines).map(el => el.textContent);
}

function createMockApp() {
  const block = createTabRowBlock({
    strings: ['---|', '---|', '---|', '---|', '---|', '---|'],
  });
  const doc = createDocument([createTextBlock(['']), block]);
  const container = document.createElement('div');
  return {
    document: doc,
    undoManager: new UndoManager(),
    noteLength: '1/8',
    chordMode: false,
    timeSigEnabled: false,
    timeSigBeats: 4,
    timeSigBeatValue: 4,
    _dirty: false,
    cursor: {
      blockIndex: 1, columnIndex: 0, charIndex: 0, stringIndex: 0, lineIndex: 0,
      getState() { return { ...this }; },
      setState(s) { Object.assign(this, s); },
    },
    editor: new Editor(container, doc),
    notePanel: null,
    ensureCursorOnTabRow() {
      if (this.document.blocks[this.cursor.blockIndex]?.type === 'tabrow') return true;
      for (let i = 0; i < this.document.blocks.length; i++) {
        if (this.document.blocks[i].type === 'tabrow') {
          this.cursor.blockIndex = i;
          this.cursor.columnIndex = 0;
          return true;
        }
      }
      return false;
    },
    renderBlock() {},
    updateCursor() {},
    updateUndoRedoButtons() {},
  };
}

describe('Backspace after inserting a note deletes the note, not the leading rest', () => {
  test('Repeat Start, D chord fret 0, click right of note, Backspace', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    // Click "Repeat Start"
    mode._insertRepeatStartAtCursor();

    // Insert D string fret 0 (chord D, press 4)
    mode.insertFret(3, 0);

    // Record what we have before backspace
    const block = app.document.blocks[1];
    const linesBefore = getEditorLineTexts(block);
    const dLineBefore = linesBefore[3];
    expect(dLineBefore).toContain('0');

    // insertFret advances cursor past note+spacing.
    // Now press Backspace — should delete the note+spacing, not the leading rest.
    mode._deleteAtCursor(true);

    const linesAfter = getEditorLineTexts(block);
    const dLineAfter = linesAfter[3];
    expect(dLineAfter).not.toContain('0');
    expect(linesAfter[0]).toMatch(/‖:/);
  });

  test('exact scenario: Repeat Start, D fret 0, simulate click right of note, Backspace', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    // Click "Repeat Start"
    mode._insertRepeatStartAtCursor();

    // Insert D string fret 0
    mode.insertFret(3, 0);

    const block = app.document.blocks[1];
    ensureColumns(block);

    // Verify the column structure
    const colTypes = block.columns.map(c => c.type);

    // "Click to the right of the written note"
    // Find the note column
    const noteIdx = block.columns.findIndex(c => c.type === 'note');
    expect(noteIdx).toBeGreaterThanOrEqual(0);

    // "Right of the note" means one column past the note
    // Simulate clicking right of the note: set cursor to noteIdx + 1
    app.cursor.columnIndex = noteIdx + 1;

    // Now press Backspace
    mode._deleteAtCursor(true);

    const linesAfter = getEditorLineTexts(block);
    const dLineAfter = linesAfter[3];

    // The note should be deleted
    expect(dLineAfter).not.toContain('0');

    // The repeat start and leading rest should still be there
    expect(linesAfter[0]).toMatch(/‖:/);
    // Should still have the leading hyphen after ‖:
    expect(linesAfter[0]).toMatch(/‖:-/);
  });
});

describe('Label width calculation for repeat-start rows', () => {
  test('label width is 1 (not 2) when content starts with ‖:', () => {
    const block = createTabRowBlock({
      strings: ['---|', '---|', '---|', '---|', '---|', '---|'],
    });
    ensureColumns(block);
    insertRepeatStart(block, 0);

    // Content now starts with ‖:
    expect(block.strings[0].startsWith('‖:')).toBe(true);

    // The rendered line is "e‖:..." (label "e" + no separator + content "‖:...")
    // So labelWidth should be 1 (just "e"), not 2 ("e" + "|")
    const content = block.strings[0];
    const hasSep = !(content.startsWith('‖:') || content.startsWith(':‖'));
    const labelWidth = block.labels[0].length + (hasSep ? 1 : 0);
    expect(labelWidth).toBe(1);
  });

  test('label width is 2 for normal rows (with |)', () => {
    const block = createTabRowBlock({
      strings: ['---|', '---|', '---|', '---|', '---|', '---|'],
    });

    const content = block.strings[0];
    const hasSep = !(content.startsWith('‖:') || content.startsWith(':‖'));
    const labelWidth = block.labels[0].length + (hasSep ? 1 : 0);
    expect(labelWidth).toBe(2);
  });

  test('backspace on repeat-start row deletes note not leading rest', () => {
    // This test verifies the EXACT bug: with wrong labelWidth=2, clicking
    // after the note would target the wrong column, and backspace would
    // delete the leading rest instead of the note.
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    mode._insertRepeatStartAtCursor();
    mode.insertFret(3, 0); // D string fret 0

    const block = app.document.blocks[1];
    ensureColumns(block);

    // Rendered D line: "D‖:-0-|"
    // With correct labelWidth=1: clicking on '-' after '0' gives contentCharIdx=4
    //   → column 3 (rest@4). Backspace deletes note at column 2. ✓
    // With WRONG labelWidth=2: clicking on '-' after '0' gives contentCharIdx=3
    //   → column 2 (note@3). Backspace deletes column 1 (leading rest). ✗

    // Simulate correct cursor position: right after the note (on the spacing rest)
    const noteIdx = block.columns.findIndex(c => c.type === 'note');
    app.cursor.columnIndex = noteIdx + 1; // rest after the note

    mode._deleteAtCursor(true); // backspace

    const linesAfter = getEditorLineTexts(block);
    // Note should be deleted
    expect(linesAfter[3]).not.toContain('0');
    // Leading rest and repeat start should still be there
    expect(linesAfter[3]).toMatch(/‖:-/);
  });
});
