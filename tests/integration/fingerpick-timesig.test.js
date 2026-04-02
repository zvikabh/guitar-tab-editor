/**
 * Regression tests for fingerpick mode with time signature.
 * These tests exercise the actual mode logic via a minimal mock app.
 */

import { renderDocument } from '../../js/model/renderer.js';
import {
  createDocument,
  createTextBlock,
  createTabRowBlock,
  ensureColumns,
  DURATION_GAPS,
} from '../../js/model/document.js';
import { UndoManager } from '../../js/model/undo.js';
import { CHORD_DB } from '../../js/model/chords.js';
import { BaseTabEditMode } from '../../js/modes/mode-base-tab.js';

function makeNotes(stringIdx, fret) {
  const notes = [null, null, null, null, null, null];
  notes[stringIdx] = String(fret);
  return notes;
}

/**
 * Minimal mock app that provides what BaseTabEditMode needs.
 */
function createMockApp(timeSigBeats = 0, timeSigBeatValue = 4) {
  const doc = createDocument([
    createTextBlock(['']),
    createTabRowBlock({ strings: ['---|', '---|', '---|', '---|', '---|', '---|'] }),
  ]);

  const app = {
    document: doc,
    undoManager: new UndoManager(),
    noteLength: '1/8',
    chordMode: false,
    timeSigEnabled: timeSigBeats > 0,
    timeSigBeats,
    timeSigBeatValue,
    cursor: {
      blockIndex: 1,
      columnIndex: 0,
      charIndex: 0,
      stringIndex: 0,
      lineIndex: 0,
      getState() { return { ...this }; },
      setState(s) { Object.assign(this, s); },
    },
    editor: {
      document: doc,
      renderAll() {},
      renderBlock() {},
      getBlockElement() { return null; },
    },
    notePanel: null,
    ensureCursorOnTabRow() {
      if (doc.blocks[this.cursor.blockIndex]?.type === 'tabrow') return true;
      for (let i = 0; i < doc.blocks.length; i++) {
        if (doc.blocks[i].type === 'tabrow') {
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

  const mode = new BaseTabEditMode(app);
  mode.name = 'test';
  return { app, mode, doc };
}

describe('Exact output: D chord 432123432123 in 3/4 time', () => {
  test('produces exactly two bars with correct content', () => {
    const { app, mode } = createMockApp(3, 4);
    const dFrets = CHORD_DB['D'].frets;
    // 432123432123: strings D,G,B,e,B,G repeated twice
    const seq = [3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2];

    for (const s of seq) {
      mode.insertFret(s, dFrets[s]);
    }

    const text = renderDocument(app.document);
    const lines = text.trim().split('\n');

    expect(lines.find(l => l.startsWith('e|'))).toBe('e|-------2-----|-------2-----|');
    expect(lines.find(l => l.startsWith('B|'))).toBe('B|-----3---3---|-----3---3---|');
    expect(lines.find(l => l.startsWith('G|'))).toBe('G|---2-------2-|---2-------2-|');
    expect(lines.find(l => l.startsWith('D|'))).toBe('D|-0-----------|-0-----------|');
    expect(lines.find(l => l.startsWith('A|'))).toBe('A|-------------|-------------|');
    expect(lines.find(l => l.startsWith('E|'))).toBe('E|-------------|-------------|');
  });
});

describe('Exact output: D chord 432123432123432123 in 3/4 time (3 bars)', () => {
  test('all three bars have identical note patterns', () => {
    const { app, mode } = createMockApp(3, 4);
    const dFrets = CHORD_DB['D'].frets;
    const seq = [3, 2, 1, 0, 1, 2]; // one bar pattern

    for (let bar = 0; bar < 3; bar++) {
      for (const s of seq) {
        mode.insertFret(s, dFrets[s]);
      }
    }

    const text = renderDocument(app.document);
    const dLine = text.split('\n').find(l => l.startsWith('D|'));
    expect(dLine).toBeTruthy();
    // Should NOT have |digit anywhere (bar directly followed by note without hyphen)
    expect(dLine).not.toMatch(/\|\d/);
    // Should have exactly 3 bars (content sections between |)
    const sections = dLine.split('|').filter(s => s.length > 0);
    // Each section with a note should start with -
    for (const section of sections) {
      if (section.match(/\d/)) {
        expect(section[0]).toBe('-');
      }
    }
  });
});

describe('Enter after auto-barline: no duplicate bars', () => {
  test('D chord 432123 in 3/4 then Enter: block1 ends cleanly', () => {
    const { app, mode } = createMockApp(3, 4);
    const dFrets = CHORD_DB['D'].frets;
    const seq = [3, 2, 1, 0, 1, 2];

    for (const s of seq) {
      mode.insertFret(s, dFrets[s]);
    }

    // Press Enter
    mode._splitRow();

    const text = renderDocument(app.document);
    const eLines = text.split('\n').filter(l => l.startsWith('e|'));
    expect(eLines.length).toBe(2);

    // First row should end with single |, not |-| or |-|-
    expect(eLines[0]).toMatch(/-\|$/);
    expect(eLines[0]).not.toMatch(/\|-\|$/);
  });
});

describe('Enter preserves note spacing before closing bar', () => {
  test('last note has trailing hyphen before |', () => {
    const { app, mode } = createMockApp(3, 4);
    const dFrets = CHORD_DB['D'].frets;
    const seq = [3, 2, 1, 0, 1, 2];

    for (const s of seq) {
      mode.insertFret(s, dFrets[s]);
    }

    mode._splitRow();

    const text = renderDocument(app.document);
    const gLine = text.split('\n').find(l => l.startsWith('G|'));
    expect(gLine).toBeTruthy();
    // G string's last note (2) should have a trailing hyphen before |
    expect(gLine).toMatch(/-\|$/);
    expect(gLine).not.toMatch(/\d\|$/);
  });
});

describe('Enter then type notes: second row has leading hyphen', () => {
  test('second row starts with hyphen before note', () => {
    const { app, mode } = createMockApp(0, 4); // no time sig
    const dFrets = CHORD_DB['D'].frets;
    const seq = [3, 2, 1];

    // Type 3 notes
    for (const s of seq) {
      mode.insertFret(s, dFrets[s]);
    }

    // Enter
    mode._splitRow();

    // Type 3 more notes on the new row
    for (const s of seq) {
      mode.insertFret(s, dFrets[s]);
    }

    const text = renderDocument(app.document);
    const dLines = text.split('\n').filter(l => l.startsWith('D|'));
    expect(dLines).toHaveLength(2);

    // Both should start with D|- (hyphen after pipe)
    for (const dLine of dLines) {
      expect(dLine).toMatch(/^D\|-/);
    }
  });
});
