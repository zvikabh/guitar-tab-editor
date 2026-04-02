/**
 * @jest-environment jsdom
 */

if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

import { renderDocument } from '../../js/model/renderer.js';
import {
  createDocument,
  createTextBlock,
  createTabRowBlock,
  ensureColumns,
  insertNote,
  columnsToStrings,
  parseColumns,
} from '../../js/model/document.js';
import { UndoManager } from '../../js/model/undo.js';
import { BaseTabEditMode } from '../../js/modes/mode-base-tab.js';

function createMockApp() {
  const block = createTabRowBlock({
    strings: ['-3-5-7-|', '-1-0-2-|', '-0-0-0-|', '-2-2-0-|', '-3-3-2-|', '-------|'],
  });
  const doc = createDocument([createTextBlock(['']), block]);
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
    editor: {
      document: doc,
      containerEl: document.createElement('div'),
      renderAll() {},
      renderBlock() {},
      getBlockElement() { return null; },
    },
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

describe('Tab mode selection', () => {
  test('shift+right extends selection', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    const block = app.document.blocks[1];
    ensureColumns(block);

    // Start at column 0
    app.cursor.columnIndex = 0;

    // Shift+right twice
    mode._moveCursorRight(true);
    mode._moveCursorRight(true);

    expect(mode._hasSelection()).toBe(true);
    const range = mode._getSelectionRange();
    expect(range.startCol).toBe(0);
    expect(range.endCol).toBeGreaterThan(0);
  });

  test('selection cleared on non-shift arrow', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    ensureColumns(app.document.blocks[1]);
    app.cursor.columnIndex = 0;

    mode._moveCursorRight(true); // extend
    expect(mode._hasSelection()).toBe(true);

    mode._moveCursorRight(false); // no shift — clears
    expect(mode._hasSelection()).toBe(false);
  });

  test('getSelectedText returns tab text for selected columns', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    const block = app.document.blocks[1];
    ensureColumns(block);

    // Select first two meaningful columns
    app.cursor.columnIndex = 0;
    mode._ensureSelAnchor();
    // Move cursor to column 4 (past a couple notes)
    app.cursor.columnIndex = 4;

    const text = mode._getSelectedText();
    expect(text).toBeTruthy();
    expect(text.split('\n')).toHaveLength(6); // 6 tab lines
    expect(text).toContain('e|');
  });

  test('deleteSelection removes selected columns', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    const block = app.document.blocks[1];
    ensureColumns(block);
    const colsBefore = block.columns.length;

    // Select columns 1 through 3
    app.cursor.columnIndex = 1;
    mode._ensureSelAnchor();
    app.cursor.columnIndex = 4;

    mode._deleteSelection();

    ensureColumns(block);
    expect(block.columns.length).toBeLessThan(colsBefore);
    expect(mode._hasSelection()).toBe(false);
  });

  test('backspace with selection deletes selection', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    const block = app.document.blocks[1];
    ensureColumns(block);
    const notesBefore = block.columns.filter(c => c.type === 'note').length;

    // Select a note column
    const firstNote = block.columns.findIndex(c => c.type === 'note');
    app.cursor.columnIndex = firstNote;
    mode._ensureSelAnchor();
    // Extend to include the note and its rest
    app.cursor.columnIndex = firstNote + 2;

    mode._deleteAtCursor(true); // backspace

    ensureColumns(block);
    const notesAfter = block.columns.filter(c => c.type === 'note').length;
    expect(notesAfter).toBeLessThan(notesBefore);
  });

  test('copy produces valid tab text', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    const block = app.document.blocks[1];
    ensureColumns(block);

    // Select some columns
    app.cursor.columnIndex = 0;
    mode._ensureSelAnchor();
    app.cursor.columnIndex = 4;

    const text = mode._getSelectedText();

    // Should be parseable as tab content
    const lines = text.split('\n');
    expect(lines).toHaveLength(6);
    for (const line of lines) {
      expect(line).toMatch(/^[eBGDAE]\|/);
    }
  });

  test('paste inserts columns at cursor', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    const block = app.document.blocks[1];
    ensureColumns(block);
    const colsBefore = block.columns.length;

    // Create a small tab snippet to paste
    const pasteText = 'e|-9-\nB|-8-\nG|-7-\nD|-6-\nA|-5-\nE|-4-';

    app.cursor.columnIndex = 0;
    mode._pasteTabText(pasteText);

    ensureColumns(block);
    expect(block.columns.length).toBeGreaterThan(colsBefore);
    // The pasted note should be in the strings
    expect(block.strings[0]).toContain('9');
  });

  test('paste with selection replaces selected columns', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    const block = app.document.blocks[1];
    ensureColumns(block);

    // Select first 4 columns
    app.cursor.columnIndex = 0;
    mode._ensureSelAnchor();
    app.cursor.columnIndex = 4;

    // Paste different content
    const pasteText = 'e|-9-\nB|-8-\nG|-7-\nD|-6-\nA|-5-\nE|-4-';
    mode._pasteTabText(pasteText);

    expect(block.strings[0]).toContain('9');
    expect(mode._hasSelection()).toBe(false);
  });
});
