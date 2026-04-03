/**
 * @jest-environment jsdom
 */

if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

import { readFileSync } from 'fs';
import { parseTabText } from '../../js/model/parser.js';
import { ensureColumns } from '../../js/model/document.js';
import { UndoManager } from '../../js/model/undo.js';
import { BaseTabEditMode } from '../../js/modes/mode-base-tab.js';

function createMockAppWithDoc(doc) {
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
      blockIndex: 0, columnIndex: 0, charIndex: 0, stringIndex: 0, lineIndex: 0,
      getState() { return { ...this }; },
      setState(s) { Object.assign(this, s); },
    },
    editor: {
      document: doc,
      containerEl: typeof document !== 'undefined' ? document.createElement('div') : null,
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

describe('Copy repeat section from D.txt', () => {
  const fileContent = readFileSync('tests/integration/D.txt', 'utf8');

  test('selecting second bar and copying produces correct text', () => {
    const doc = parseTabText(fileContent);
    const app = createMockAppWithDoc(doc);
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    // Find the tabrow block
    const tabIdx = doc.blocks.findIndex(b => b.type === 'tabrow');
    expect(tabIdx).toBeGreaterThanOrEqual(0);
    app.cursor.blockIndex = tabIdx;

    const block = doc.blocks[tabIdx];
    ensureColumns(block);

    // Find the repeat-start column (‖:)
    const repeatStartIdx = block.columns.findIndex(c => c.type === 'repeat-start');
    expect(repeatStartIdx).toBeGreaterThanOrEqual(0);

    // Find the repeat-end column (:‖)
    const repeatEndIdx = block.columns.findIndex(c => c.type === 'repeat-end');
    expect(repeatEndIdx).toBeGreaterThan(repeatStartIdx);

    // Select from repeat-start to just after repeat-end (inclusive)
    app.cursor.columnIndex = repeatStartIdx;
    mode._ensureSelAnchor();
    app.cursor.columnIndex = repeatEndIdx + 1;

    const copied = mode._getSelectedText();
    const lines = copied.split('\n');

    // Find the e string line
    const eLine = lines.find(l => l.match(/^e[|‖]/));
    expect(eLine).toBeTruthy();

    // Exact check: e line should start with e‖: (not e|‖:)
    expect(eLine).toBe('e‖:-------2-----:‖');

    // All tab lines should NOT have |‖: pattern
    const tabLines = lines.filter(l => l.match(/^[eBGDAE][|‖]/));
    for (const tl of tabLines) {
      expect(tl).not.toContain('|‖:');
    }

    // Pre-line should contain "D" and not start with "."
    const eLineIdx = lines.indexOf(eLine);
    const preLines = lines.slice(0, eLineIdx);
    if (preLines.length > 0) {
      const preLine = preLines.find(l => l.trim().length > 0);
      if (preLine) {
        expect(preLine.trim()).toContain('D');
        expect(preLine).not.toMatch(/^\./);
      }
    }

    // Post-line should contain timing and not start with "."
    const ELineIdx = lines.findIndex(l => l.match(/^E[|‖]/));
    const postLines = lines.slice(ELineIdx + 1);
    if (postLines.length > 0) {
      const postLine = postLines.find(l => l.trim().length > 0);
      if (postLine) {
        expect(postLine).not.toMatch(/^\./);
        expect(postLine.trim()).toContain('1');
      }
    }

    // Exact check: the full copied text, trimming trailing spaces.
    // The alignment should match the original file:
    // In the file, the second D is 3 chars after ‖: start.
    // In the copied section, ‖: starts at position 1 (after label "e"),
    // so D should be at position 4 (4 spaces before D).
    const expectedLines = [
      '    D',
      'e‖:-------2-----:‖',
      'B‖:-----3---3---:‖',
      'G‖:---2-------2-:‖',
      'D‖:-0-----------:‖',
      'A‖:-------------:‖',
      'E‖:-------------:‖',
      '    1 . 2 . 3 .',
    ];
    const copiedTrimmed = lines.map(l => l.trimEnd());
    const expectedTrimmed = expectedLines.map(l => l.trimEnd());
    expect(copiedTrimmed).toEqual(expectedTrimmed);
  });

  test('selecting first bar and copying produces correct pre/post alignment', () => {
    const doc = parseTabText(fileContent);
    const app = createMockAppWithDoc(doc);
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    const tabIdx = doc.blocks.findIndex(b => b.type === 'tabrow');
    app.cursor.blockIndex = tabIdx;
    const block = doc.blocks[tabIdx];
    ensureColumns(block);

    // Find the repeat-start (end of first bar)
    const repeatStartIdx = block.columns.findIndex(c => c.type === 'repeat-start');

    // Select from beginning to just before the repeat-start
    app.cursor.columnIndex = 0;
    mode._ensureSelAnchor();
    app.cursor.columnIndex = repeatStartIdx;

    const copied = mode._getSelectedText();
    const lines = copied.split('\n');

    const expectedLines = [
      '   D',
      'e|-------2-----',
      'B|-----3---3---',
      'G|---2-------2-',
      'D|-0-----------',
      'A|-------------',
      'E|-------------',
      '   1 . 2 . 3 .',
    ];
    const copiedTrimmed = lines.map(l => l.trimEnd());
    const expectedTrimmed = expectedLines.map(l => l.trimEnd());
    expect(copiedTrimmed).toEqual(expectedTrimmed);
  });

  test('selecting mid-row across bar boundary produces correct pre/post alignment', () => {
    const doc = parseTabText(fileContent);
    const app = createMockAppWithDoc(doc);
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    const tabIdx = doc.blocks.findIndex(b => b.type === 'tabrow');
    app.cursor.blockIndex = tabIdx;
    const block = doc.blocks[tabIdx];
    ensureColumns(block);

    // Find the first note on e string (fret 2)
    const firstNoteIdx = block.columns.findIndex(c => c.type === 'note' && c.notes[0] === '2');
    expect(firstNoteIdx).toBeGreaterThanOrEqual(0);

    // Find the second note on e string (fret 2) — it's in the second bar
    const secondNoteIdx = block.columns.findIndex(
      (c, i) => i > firstNoteIdx && c.type === 'note' && c.notes[0] === '2'
    );
    expect(secondNoteIdx).toBeGreaterThan(firstNoteIdx);

    // Select from first note to just before second note
    app.cursor.columnIndex = firstNoteIdx;
    mode._ensureSelAnchor();
    app.cursor.columnIndex = secondNoteIdx;

    const copied = mode._getSelectedText();
    const lines = copied.split('\n');

    const expectedLines = [
      '           D',
      'e|2-----‖:-------',
      'B|--3---‖:-----3-',
      'G|----2-‖:---2---',
      'D|------‖:-0-----',
      'A|------‖:-------',
      'E|------‖:-------',
      '  . 3 .    1 . 2',
    ];
    const copiedTrimmed = lines.map(l => l.trimEnd());
    const expectedTrimmed = expectedLines.map(l => l.trimEnd());
    expect(copiedTrimmed).toEqual(expectedTrimmed);
  });
});
