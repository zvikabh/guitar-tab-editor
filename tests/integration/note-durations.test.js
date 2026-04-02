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
  DURATION_GAPS,
} from '../../js/model/document.js';
import { UndoManager } from '../../js/model/undo.js';
import { BaseTabEditMode } from '../../js/modes/mode-base-tab.js';
import { Editor } from '../../js/editor/editor.js';

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

function getEditorLineTexts(block) {
  const container = document.createElement('div');
  const editor = new Editor(container, createDocument([block]));
  editor.renderAll();
  const lines = container.querySelectorAll('.line-tab');
  return Array.from(lines).map(el => el.textContent);
}

describe('Note duration spacing', () => {
  test('1/8 note: 1 hyphen gap between consecutive notes', () => {
    const app = createMockApp();
    app.noteLength = '1/8';
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    mode.insertFret(0, 3); // e string fret 3
    mode.insertFret(0, 5); // e string fret 5

    const block = app.document.blocks[1];
    const lines = getEditorLineTexts(block);
    // Should be e|-3-5-| (1 hyphen gap)
    expect(lines[0]).toBe('e|-3-5-|');
  });

  test('1/4 note: 3 hyphen gap between consecutive notes', () => {
    const app = createMockApp();
    app.noteLength = '1/4';
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    mode.insertFret(0, 3);
    mode.insertFret(0, 5);

    const block = app.document.blocks[1];
    const lines = getEditorLineTexts(block);
    // Should be e|-3---5---| (3 hyphen gap)
    expect(lines[0]).toBe('e|-3---5---|');
  });

  test('1/2 note: 7 hyphen gap between consecutive notes', () => {
    const app = createMockApp();
    app.noteLength = '1/2';
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    mode.insertFret(0, 3);
    mode.insertFret(0, 5);

    const block = app.document.blocks[1];
    const lines = getEditorLineTexts(block);
    // Should be e|-3-------5-------| (7 hyphen gap)
    expect(lines[0]).toBe('e|-3-------5-------|');
  });

  test('1/16 note: 0 hyphen gap (adjacent)', () => {
    const app = createMockApp();
    app.noteLength = '1/16';
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    mode.insertFret(0, 3);
    mode.insertFret(0, 5);

    const block = app.document.blocks[1];
    const lines = getEditorLineTexts(block);
    // Should be e|-35-| (no gap)
    expect(lines[0]).toBe('e|-35|');
  });
});
