/**
 * Tests for repeat start/end markers.
 */

import { renderDocument } from '../../js/model/renderer.js';
import {
  createDocument,
  createTextBlock,
  createTabRowBlock,
  ensureColumns,
  insertNote,
  insertRepeatStart,
  insertRepeatEnd,
  DURATION_GAPS,
} from '../../js/model/document.js';
import { UndoManager } from '../../js/model/undo.js';
import { CHORD_DB } from '../../js/model/chords.js';
import { BaseTabEditMode } from '../../js/modes/mode-base-tab.js';

function createMockApp() {
  const doc = createDocument([
    createTextBlock(['']),
    createTabRowBlock({ strings: ['---|', '---|', '---|', '---|', '---|', '---|'] }),
  ]);
  return {
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
}

describe('Repeat start at beginning of line replaces opening |', () => {
  test('exact output: click Add Repeat Start on empty doc', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    // Simulate: user clicks "Add Repeat Start" on a fresh doc.
    // Cursor could be at column 0 or snapped to the bar — either way,
    // repeat start at the beginning should replace the line's opening |.
    app.cursor.columnIndex = 0;
    mode._insertRepeatStartAtCursor();

    const text = renderDocument(app.document);
    const lines = text.trim().split('\n');

    expect(lines.find(l => l.startsWith('e'))).toBe('e‖:---|');
    expect(lines.find(l => l.startsWith('B'))).toBe('B‖:---|');
    expect(lines.find(l => l.startsWith('G'))).toBe('G‖:---|');
    expect(lines.find(l => l.startsWith('D'))).toBe('D‖:---|');
    expect(lines.find(l => l.startsWith('A'))).toBe('A‖:---|');
    expect(lines.find(l => l.startsWith('E'))).toBe('E‖:---|');
  });

  test('exact output: using real initial doc strings (---|)', () => {
    // Reproduce EXACTLY what the real app creates
    const block = createTabRowBlock({
      strings: ['---|', '---|', '---|', '---|', '---|', '---|'],
    });
    const doc = createDocument([createTextBlock(['']), block]);

    ensureColumns(block);
    // Insert repeat start at position 0
    insertRepeatStart(block, 0);

    const text = renderDocument(doc);
    const lines = text.trim().split('\n');

    // Exact check for every line
    expect(lines.find(l => l.startsWith('e'))).toBe('e‖:---|');
    expect(lines.find(l => l.startsWith('B'))).toBe('B‖:---|');
    expect(lines.find(l => l.startsWith('G'))).toBe('G‖:---|');
    expect(lines.find(l => l.startsWith('D'))).toBe('D‖:---|');
    expect(lines.find(l => l.startsWith('A'))).toBe('A‖:---|');
    expect(lines.find(l => l.startsWith('E'))).toBe('E‖:---|');
  });

  test('exact output: cursor at end-of-row, Add Repeat Start', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    // Cursor past the end (e.g., user clicked past the |)
    const block = app.document.blocks[1];
    ensureColumns(block);
    app.cursor.columnIndex = block.columns.length;
    mode._insertRepeatStartAtCursor();

    const text = renderDocument(app.document);
    const eLine = text.split('\n').find(l => l.startsWith('e'));
    // Even from end-of-row, should not produce e|‖:
    expect(eLine).not.toContain('|‖:');
  });

  test('exact output: cursor snapped to bar, Add Repeat Start', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    // Cursor snapped to the bar (column 1 in [rest(3), bar])
    const block = app.document.blocks[1];
    ensureColumns(block);
    const barIdx = block.columns.findIndex(c => c.type === 'bar');
    app.cursor.columnIndex = barIdx;
    mode._insertRepeatStartAtCursor();

    const text = renderDocument(app.document);
    const eLine = text.split('\n').find(l => l.startsWith('e'));
    // Should NOT have |‖: — the bar should be replaced
    expect(eLine).not.toContain('|‖:');
    expect(eLine).not.toContain('|:');
  });
});

describe('Repeat end at end of line replaces closing |', () => {
  test('repeat end at end of line with notes: ends with :‖', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    // Insert a note first
    mode.insertFret(0, 3);

    // Move cursor to end of row
    const block = app.document.blocks[1];
    ensureColumns(block);
    app.cursor.columnIndex = block.columns.length;

    // Insert repeat end
    mode._insertRepeatEndAtCursor();

    const text = renderDocument(app.document);
    const eLine = text.split('\n').find(l => l.startsWith('e'));
    expect(eLine).toBeTruthy();

    // Should end with :‖ (not :‖|)
    expect(eLine).toMatch(/:‖$/);
    expect(eLine).not.toMatch(/:‖\|$/);
  });
});

describe('Full repeat section: ‖: notes :‖', () => {
  test('D chord 432 with repeat markers', () => {
    const app = createMockApp();
    const mode = new BaseTabEditMode(app);
    mode.name = 'test';

    // Add repeat start at beginning
    app.cursor.columnIndex = 0;
    mode._insertRepeatStartAtCursor();

    // Insert 3 notes (D chord: 4=D(0), 3=G(2), 2=B(3))
    const dFrets = CHORD_DB['D'].frets;
    mode.insertFret(3, dFrets[3]); // D string, fret 0
    mode.insertFret(2, dFrets[2]); // G string, fret 2
    mode.insertFret(1, dFrets[1]); // B string, fret 3

    // Add repeat end at end
    const block = app.document.blocks[1];
    ensureColumns(block);
    app.cursor.columnIndex = block.columns.length;
    mode._insertRepeatEndAtCursor();

    const text = renderDocument(app.document);
    const eLine = text.split('\n').find(l => l.startsWith('e'));
    const dLine = text.split('\n').find(l => l.startsWith('D'));

    // Should start with ‖: and end with :‖
    expect(eLine).toMatch(/^e‖:/);
    expect(eLine).toMatch(/:‖$/);
    expect(dLine).toContain('0'); // D string has the note
  });
});
