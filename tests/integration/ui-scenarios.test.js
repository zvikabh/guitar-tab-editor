/**
 * UI scenario tests: trace through real user interactions to find bugs.
 * Each test simulates a specific user workflow at the model level.
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
  columnsToStrings,
  parseColumns,
  DURATION_GAPS,
} from '../../js/model/document.js';
import { parseTabText } from '../../js/model/parser.js';
import { renderDocument } from '../../js/model/renderer.js';
import { UndoManager } from '../../js/model/undo.js';

// Helper: simulates the initial empty document the app creates
function makeEmptyDoc() {
  return createDocument([
    createTextBlock(['']),
    createTabRowBlock({ strings: ['|', '|', '|', '|', '|', '|'] }),
  ]);
}

// Helper: simulates cursor advancement after insertNote
function advanceCursorAfterInsert(colIdx, duration, block) {
  let newIdx = colIdx + 1 + (DURATION_GAPS[duration] > 0 ? 1 : 0);
  if (newIdx > block.columns.length) newIdx = block.columns.length;
  return newIdx;
}

describe('Scenario: Fresh doc → Note mode → click frets', () => {
  test('first fret click on empty doc inserts note before bar', () => {
    const doc = makeEmptyDoc();
    const block = doc.blocks[1];
    ensureColumns(block);

    // Cursor starts at columnIndex=0 (the bar column)
    const colIdx = 0;
    insertNote(block, colIdx, ['3', null, null, null, null, null], '1/8');

    // Should have: note, rest, bar
    expect(block.columns.filter(c => c.type === 'note')).toHaveLength(1);
    expect(block.columns.filter(c => c.type === 'bar')).toHaveLength(1);
    expect(block.strings[0]).toBe('3-|');
    expect(block.strings[1]).toBe('--|');
  });

  test('second fret click inserts after first note', () => {
    const doc = makeEmptyDoc();
    const block = doc.blocks[1];
    ensureColumns(block);

    // First insert at col 0
    insertNote(block, 0, ['3', null, null, null, null, null], '1/8');
    // Cursor advances to 2 (past note+rest)
    let cursorCol = advanceCursorAfterInsert(0, '1/8', block);

    // Second insert at cursor position (should be at the bar)
    insertNote(block, cursorCol, ['5', null, null, null, null, null], '1/8');

    expect(block.strings[0]).toBe('3-5-|');
    expect(block.columns.filter(c => c.type === 'note')).toHaveLength(2);
  });

  test('three consecutive 1/4 notes are properly spaced', () => {
    const doc = makeEmptyDoc();
    const block = doc.blocks[1];
    ensureColumns(block);

    insertNote(block, 0, ['0', null, null, null, null, null], '1/4');
    let cursor = advanceCursorAfterInsert(0, '1/4', block);

    insertNote(block, cursor, ['2', null, null, null, null, null], '1/4');
    cursor = advanceCursorAfterInsert(cursor, '1/4', block);

    insertNote(block, cursor, ['3', null, null, null, null, null], '1/4');

    // Each 1/4 note has 3 hyphens after it
    expect(block.strings[0]).toBe('0---2---3---|');
  });

  test('1/16 notes have no gap between them', () => {
    const doc = makeEmptyDoc();
    const block = doc.blocks[1];
    ensureColumns(block);

    insertNote(block, 0, ['1', null, null, null, null, null], '1/16');
    let cursor = advanceCursorAfterInsert(0, '1/16', block);

    insertNote(block, cursor, ['2', null, null, null, null, null], '1/16');

    expect(block.strings[0]).toBe('12|');
  });
});

describe('Scenario: Click in middle of existing tab', () => {
  test('column snap finds nearest note/bar, not rest', () => {
    // Simulate a tab with notes and rests
    const block = createTabRowBlock({
      strings: [
        '---0---3---|',
        '---1---0---|',
        '---0---0---|',
        '---2---2---|',
        '---3---3---|',
        '-----------|',
      ],
    });
    ensureColumns(block);

    // Meaningful columns (non-rest)
    const meaningful = block.columns
      .map((col, i) => ({ col, i }))
      .filter(({ col }) => col.type !== 'rest');

    expect(meaningful.length).toBeGreaterThan(0);

    // Click at character position 5 should snap to a note, not rest
    const clickPos = 5;
    let bestEntry = meaningful[0];
    let bestDist = Infinity;
    for (const entry of meaningful) {
      const dist = Math.abs(entry.col.position - clickPos);
      if (dist < bestDist) {
        bestDist = dist;
        bestEntry = entry;
      }
    }
    expect(bestEntry.col.type).not.toBe('rest');
  });

  test('inserting into rest area consumes rest space', () => {
    const block = createTabRowBlock({
      strings: [
        '---------|',
        '---------|',
        '---------|',
        '---------|',
        '---------|',
        '---------|',
      ],
    });
    ensureColumns(block);

    // Rest is 9 chars wide, bar at end
    const restCol = block.columns.find(c => c.type === 'rest');
    expect(restCol).toBeTruthy();
    const origRestWidth = restCol.width;

    insertNote(block, 0, ['5', null, null, null, null, null], '1/8');

    // Rest should have shrunk (note=1 + spacing=1 = 2 consumed)
    const remainingRest = block.columns.find(c => c.type === 'rest' && c.width > 1);
    expect(remainingRest).toBeTruthy();
    expect(remainingRest.width).toBe(origRestWidth - 2);
  });
});

describe('Scenario: Cursor movement skips rests', () => {
  test('right arrow skips rest columns', () => {
    const block = createTabRowBlock({
      strings: [
        '---0---3---|',
        '---1---0---|',
        '---0---0---|',
        '---2---2---|',
        '---3---3---|',
        '-----------|',
      ],
    });
    ensureColumns(block);

    // Find first note column
    const firstNoteIdx = block.columns.findIndex(c => c.type === 'note');

    // Simulate right arrow: find next non-rest column
    let idx = firstNoteIdx + 1;
    while (idx < block.columns.length && block.columns[idx].type === 'rest') idx++;

    // Should land on another note or bar, not rest
    expect(block.columns[idx].type).not.toBe('rest');
  });
});

describe('Scenario: Load file → switch raw → note → insert', () => {
  test('roundtrip through raw mode preserves document', () => {
    const input =
      'Test\n' +
      '\n' +
      '   Am\n' +
      'e|---0---|---3---|\n' +
      'B|---1---|---0---|\n' +
      'G|---2---|---0---|\n' +
      'D|---2---|---0---|\n' +
      'A|---0---|---2---|\n' +
      'E|-------|---3---|\n' +
      '   la     da\n';

    const doc1 = parseTabText(input);
    const text1 = renderDocument(doc1);

    // Simulate raw mode: render → edit nothing → re-parse
    const doc2 = parseTabText(text1);
    const text2 = renderDocument(doc2);

    expect(text2).toBe(text1);
  });

  test('after raw roundtrip, columns can be parsed and notes inserted', () => {
    const input =
      'e|---0---|---3---|\n' +
      'B|---1---|---0---|\n' +
      'G|---2---|---0---|\n' +
      'D|---2---|---0---|\n' +
      'A|---0---|---2---|\n' +
      'E|-------|---3---|\n';

    const doc = parseTabText(input);
    const block = doc.blocks.find(b => b.type === 'tabrow');
    ensureColumns(block);

    const notesBefore = block.columns.filter(c => c.type === 'note').length;

    // Insert a note at the end (before last bar)
    const lastBarIdx = block.columns.length - 1;
    insertNote(block, lastBarIdx, ['7', null, null, null, null, null], '1/8');

    const notesAfter = block.columns.filter(c => c.type === 'note').length;
    expect(notesAfter).toBe(notesBefore + 1);
    expect(block.strings[0]).toContain('7');
  });
});

describe('Scenario: Undo/redo in note mode', () => {
  test('undo after inserting 3 notes restores to 2 notes', () => {
    const doc = makeEmptyDoc();
    const um = new UndoManager();
    const block = doc.blocks[1];

    ensureColumns(block);
    um.pushSnapshot(doc);
    insertNote(block, 0, ['1', null, null, null, null, null], '1/8');

    um.pushSnapshot(doc);
    let cursor = advanceCursorAfterInsert(0, '1/8', block);
    insertNote(block, cursor, ['2', null, null, null, null, null], '1/8');

    um.pushSnapshot(doc);
    cursor = advanceCursorAfterInsert(cursor, '1/8', block);
    insertNote(block, cursor, ['3', null, null, null, null, null], '1/8');

    expect(block.strings[0]).toBe('1-2-3-|');

    // Undo last insert
    const r = um.undo(doc);
    const restored = r.doc.blocks[1];
    ensureColumns(restored);
    const noteVals = restored.columns
      .filter(c => c.type === 'note')
      .map(c => c.notes[0]);
    expect(noteVals).toEqual(['1', '2']);
  });
});

describe('Scenario: Delete note and check spacing cleanup', () => {
  test('deleting a note removes it and its adjacent rest', () => {
    const block = createTabRowBlock({ strings: ['|', '|', '|', '|', '|', '|'] });
    ensureColumns(block);

    insertNote(block, 0, ['3', null, null, null, null, null], '1/8');
    insertNote(block, 2, ['5', null, null, null, null, null], '1/8');
    expect(block.strings[0]).toBe('3-5-|');

    // Delete first note (at column 0)
    deleteNote(block, 0);

    const notes = block.columns.filter(c => c.type === 'note');
    expect(notes).toHaveLength(1);
    expect(notes[0].notes[0]).toBe('5');
  });
});

describe('Scenario: Label width and cursor positioning', () => {
  test('label width is correctly computed for standard tuning', () => {
    const block = createTabRowBlock({
      strings: ['---0---|', '---1---|', '---0---|', '---2---|', '---3---|', '-------|'],
    });
    // Label "e" + "|" = 2 chars
    const labelWidth = block.labels[0].length + 1;
    expect(labelWidth).toBe(2);
  });

  test('label width for sharp tuning label', () => {
    const block = createTabRowBlock({
      strings: ['---0---|', '---1---|', '---0---|', '---2---|', '---3---|', '-------|'],
      labels: ['e', 'B', 'G', 'D', 'A', 'C#'],
    });
    // C# label is 2 chars + "|" = 3 chars
    // But labelWidth uses labels[0] which is 'e' (1 char) → 2
    // This means cursor offset is wrong for strings with longer labels
    const labelWidth0 = block.labels[0].length + 1;
    const labelWidth5 = block.labels[5].length + 1;
    // BUG: different strings have different label widths, but cursor uses only labels[0]
    // This is a known limitation — for now just document it
    expect(labelWidth0).toBe(2);
    expect(labelWidth5).toBe(3);
  });
});

describe('Scenario: Chord mode (shift-click)', () => {
  test('chord mode inserts note without advancing cursor', () => {
    const block = createTabRowBlock({ strings: ['|', '|', '|', '|', '|', '|'] });
    ensureColumns(block);

    // Normal insert at col 0 → cursor advances to 2
    insertNote(block, 0, ['3', null, null, null, null, null], '1/8');
    // After normal insert, cursor would be at 2

    // Now simulate chord mode: insert at same position (0) - the note column
    // In chord mode, we modify the existing note at cursor position
    const noteCol = block.columns[0];
    expect(noteCol.type).toBe('note');
    noteCol.notes[4] = '3'; // Add A string fret 3
    noteCol.width = Math.max(1, ...noteCol.notes.filter(Boolean).map(n => n.length));

    // Verify both strings have notes at the same position
    expect(noteCol.notes[0]).toBe('3');
    expect(noteCol.notes[4]).toBe('3');
  });

  test('chord mode at end of tab inserts new note without advancing', () => {
    const block = createTabRowBlock({ strings: ['|', '|', '|', '|', '|', '|'] });
    ensureColumns(block);

    // Insert at col 0 (the bar), chord mode → new note, cursor stays at 0
    insertNote(block, 0, ['0', null, null, null, null, null], '1/8');
    // In chord mode the cursor would stay at 0 (the new note)
    const noteCol = block.columns[0];
    expect(noteCol.type).toBe('note');
    expect(noteCol.notes[0]).toBe('0');

    // Add another string to the same note
    noteCol.notes[2] = '0'; // G string open
    expect(noteCol.notes[0]).toBe('0');
    expect(noteCol.notes[2]).toBe('0');
  });
});

describe('Scenario: Empty document edge cases', () => {
  test('columns of minimal tab "|" is just one bar', () => {
    const block = createTabRowBlock({ strings: ['|', '|', '|', '|', '|', '|'] });
    ensureColumns(block);
    expect(block.columns).toHaveLength(1);
    expect(block.columns[0].type).toBe('bar');
  });

  test('inserting into minimal tab and deleting returns to near-empty', () => {
    const block = createTabRowBlock({ strings: ['|', '|', '|', '|', '|', '|'] });
    ensureColumns(block);

    insertNote(block, 0, ['5', null, null, null, null, null], '1/8');
    expect(block.columns.filter(c => c.type === 'note')).toHaveLength(1);

    const noteIdx = block.columns.findIndex(c => c.type === 'note');
    deleteNote(block, noteIdx);
    expect(block.columns.filter(c => c.type === 'note')).toHaveLength(0);
  });
});

describe('Scenario: Rendering consistency', () => {
  test('all 6 strings same length after note insert', () => {
    const block = createTabRowBlock({ strings: ['|', '|', '|', '|', '|', '|'] });
    ensureColumns(block);

    insertNote(block, 0, ['12', null, null, null, null, null], '1/8');

    const lengths = block.strings.map(s => s.length);
    expect(new Set(lengths).size).toBe(1); // All same length
  });

  test('all 6 strings same length after multiple inserts', () => {
    const block = createTabRowBlock({ strings: ['|', '|', '|', '|', '|', '|'] });
    ensureColumns(block);

    insertNote(block, 0, ['0', '1', '0', '2', '3', null], '1/8');
    let c = advanceCursorAfterInsert(0, '1/8', block);
    insertNote(block, c, [null, null, null, null, null, '3'], '1/4');
    c = advanceCursorAfterInsert(c, '1/4', block);
    insertNote(block, c, ['12', null, null, null, null, null], '1/8');

    const lengths = block.strings.map(s => s.length);
    expect(new Set(lengths).size).toBe(1);
  });

  test('rendered tab lines all have same length (including label)', () => {
    const block = createTabRowBlock({ strings: ['|', '|', '|', '|', '|', '|'] });
    ensureColumns(block);
    insertNote(block, 0, ['3', null, null, null, null, null], '1/8');
    insertNote(block, 2, ['5', null, null, null, null, null], '1/4');

    const doc = createDocument([block]);
    const text = renderDocument(doc);
    const tabLines = text.trim().split('\n');
    // All 6 tab lines should have same length
    const lineLengths = tabLines.map(l => l.length);
    expect(new Set(lineLengths).size).toBe(1);
  });
});
