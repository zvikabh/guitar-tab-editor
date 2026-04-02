/**
 * @jest-environment jsdom
 */

// Polyfill structuredClone for jsdom
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

/**
 * Tests for editor.js DOM rendering.
 * These verify what the user SEES on screen, not just what gets saved to file.
 * Both editor._renderBlock (screen) and renderer.renderDocument (file) must agree.
 */

import { renderDocument } from '../../js/model/renderer.js';
import { BaseTabEditMode } from '../../js/modes/mode-base-tab.js';
import { UndoManager } from '../../js/model/undo.js';
import {
  createDocument,
  createTextBlock,
  createTabRowBlock,
  ensureColumns,
  insertRepeatStart,
  insertRepeatEnd,
  insertNote,
} from '../../js/model/document.js';
import { Editor } from '../../js/editor/editor.js';

function getEditorLineTexts(block) {
  // Create a temporary container and use Editor to render the block
  const container = document.createElement('div');
  const editor = new Editor(container, createDocument([block]));
  editor.renderAll();
  const lines = container.querySelectorAll('.line-tab');
  return Array.from(lines).map(el => el.textContent);
}

function getRendererLineTexts(block) {
  const doc = createDocument([block]);
  const text = renderDocument(doc);
  return text.split('\n').filter(l => /^[eBGDAE][#b♭♯]?[|‖]/.test(l));
}

describe('Editor DOM and Renderer agree on repeat markers', () => {
  test('repeat start at beginning: editor shows e‖:--- not e|‖:---', () => {
    const block = createTabRowBlock({
      strings: ['---|', '---|', '---|', '---|', '---|', '---|'],
    });
    ensureColumns(block);
    insertRepeatStart(block, 0);

    const editorLines = getEditorLineTexts(block);
    const rendererLines = getRendererLineTexts(block);

    // Editor and renderer must produce the same output
    expect(editorLines).toEqual(rendererLines);

    // Specifically: no |‖: pattern (double separator)
    for (const line of editorLines) {
      expect(line).not.toContain('|‖:');
      expect(line).toMatch(/^[eBGDAE]‖:/);
    }
  });

  test('repeat end at end: editor shows :‖ not :‖|', () => {
    const block = createTabRowBlock({
      strings: ['---|', '---|', '---|', '---|', '---|', '---|'],
    });
    ensureColumns(block);
    // Add a note first
    insertNote(block, 0, ['3', null, null, null, null, null], '1/8');
    // Add repeat end at end
    insertRepeatEnd(block, block.columns.length);

    const editorLines = getEditorLineTexts(block);
    const rendererLines = getRendererLineTexts(block);

    expect(editorLines).toEqual(rendererLines);

    for (const line of editorLines) {
      expect(line).toMatch(/:‖$/);
      expect(line).not.toMatch(/:‖\|$/);
    }
  });

  test('normal tab row: editor and renderer agree', () => {
    const block = createTabRowBlock({
      strings: ['---|', '---|', '---|', '---|', '---|', '---|'],
    });
    ensureColumns(block);
    insertNote(block, 0, ['3', null, null, '0', null, null], '1/8');

    const editorLines = getEditorLineTexts(block);
    const rendererLines = getRendererLineTexts(block);

    expect(editorLines).toEqual(rendererLines);

    // Normal lines start with label|
    expect(editorLines[0]).toMatch(/^e\|/);
  });

  test('exact output: Add Repeat Start on fresh doc', () => {
    const block = createTabRowBlock({
      strings: ['---|', '---|', '---|', '---|', '---|', '---|'],
    });
    ensureColumns(block);
    insertRepeatStart(block, 0);

    const editorLines = getEditorLineTexts(block);

    expect(editorLines[0]).toBe('e‖:---|');
    expect(editorLines[1]).toBe('B‖:---|');
    expect(editorLines[2]).toBe('G‖:---|');
    expect(editorLines[3]).toBe('D‖:---|');
    expect(editorLines[4]).toBe('A‖:---|');
    expect(editorLines[5]).toBe('E‖:---|');
  });
});

describe('Add Repeat End then Enter: no extra | after :‖', () => {
  test('exact output: Add Repeat End via mode, then splitRow', () => {
    const block = createTabRowBlock({
      strings: ['---|', '---|', '---|', '---|', '---|', '---|'],
    });
    const doc = createDocument([createTextBlock(['']), block]);

    const app = {
      document: doc,
      undoManager: new UndoManager(),
      noteLength: '1/8',
      chordMode: false,
      timeSigEnabled: false,
      timeSigBeats: 4,
      timeSigBeatValue: 4,
      cursor: {
        blockIndex: 1, columnIndex: 0, charIndex: 0, stringIndex: 0, lineIndex: 0,
        getState() { return { ...this }; },
        setState(s) { Object.assign(this, s); },
      },
      editor: { document: doc, renderAll() {}, renderBlock() {}, getBlockElement() { return null; } },
      notePanel: null,
      ensureCursorOnTabRow() {
        if (this.document.blocks[this.cursor.blockIndex]?.type === 'tabrow') return true;
        for (let i = 0; i < this.document.blocks.length; i++) {
          if (this.document.blocks[i].type === 'tabrow') { this.cursor.blockIndex = i; this.cursor.columnIndex = 0; return true; }
        }
        return false;
      },
      renderBlock() {},
      updateCursor() {},
      updateUndoRedoButtons() {},
    };

    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    // Click Add Repeat End
    mode._insertRepeatEndAtCursor();

    // Check first row: should end with :‖ not :‖|
    const editorLines1 = getEditorLineTexts(doc.blocks[1]);
    expect(editorLines1[0]).toBe('e|---:‖');
    expect(editorLines1[5]).toBe('E|---:‖');

    // Press Enter
    mode._splitRow();

    // Check first row after split
    const tabBlocks = doc.blocks.filter(b => b.type === 'tabrow');
    expect(tabBlocks.length).toBe(2);

    const editorLines1After = getEditorLineTexts(tabBlocks[0]);
    const editorLines2After = getEditorLineTexts(tabBlocks[1]);

    // First row should end with :‖ not :‖|
    expect(editorLines1After[0]).toBe('e|---:‖');
    expect(editorLines1After[5]).toBe('E|---:‖');

    // Second row should be normal
    expect(editorLines2After[0]).toBe('e|---|');
    expect(editorLines2After[5]).toBe('E|---|');
  });
});

describe('Repeat start then insert note: correct spacing', () => {
  test('Add Repeat Start, select G, type 6: exact output', () => {
    const block = createTabRowBlock({
      strings: ['---|', '---|', '---|', '---|', '---|', '---|'],
    });
    const doc = createDocument([block]);
    ensureColumns(block);

    // Insert repeat start at position 0
    insertRepeatStart(block, 0);

    // Cursor should be at column 1 (the rest after repeat-start).
    // Insert note on E string (index 5), fret 3 (G chord low E).
    // The rest at column 1 is width 3. Note+spacing=2. Remaining=1.
    ensureColumns(block);
    const restIdx = block.columns.findIndex(c => c.type === 'rest');
    insertNote(block, restIdx, [null, null, null, null, null, '3'], '1/8');

    const editorLines = getEditorLineTexts(block);
    const rendererLines = getRendererLineTexts(block);

    // Editor and renderer must agree
    expect(editorLines).toEqual(rendererLines);

    // Exact output check
    expect(editorLines[0]).toBe('e‖:---|');
    expect(editorLines[1]).toBe('B‖:---|');
    expect(editorLines[2]).toBe('G‖:---|');
    expect(editorLines[3]).toBe('D‖:---|');
    expect(editorLines[4]).toBe('A‖:---|');
    expect(editorLines[5]).toBe('E‖:-3-|');
  });
});
