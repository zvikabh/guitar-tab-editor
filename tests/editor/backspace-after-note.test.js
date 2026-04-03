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
    // D line should contain the note 0
    const dLineBefore = linesBefore[3];
    expect(dLineBefore).toContain('0');

    // "Click to the right of the written note" — cursor should be right after the note+spacing
    // (insertFret already advances the cursor past the note)
    // Now press Backspace
    mode._deleteAtCursor(true);

    // The note should be deleted, not the leading rest
    const linesAfter = getEditorLineTexts(block);
    const dLineAfter = linesAfter[3];

    // The note '0' should be gone
    expect(dLineAfter).not.toContain('0');

    // The repeat start should still be there
    expect(linesAfter[0]).toMatch(/‖:/);
  });
});
