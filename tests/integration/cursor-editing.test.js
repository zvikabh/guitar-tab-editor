/**
 * Regression tests for cursor-aware editing: insert position, backspace/delete
 * on bars, chord mode transitions, Enter near barlines, Delete at end of row.
 */

import { renderDocument } from '../../js/model/renderer.js';
import {
  createDocument,
  createTextBlock,
  createTabRowBlock,
  ensureColumns,
  insertNote,
  deleteNote,
  insertBarline,
  removeBarline,
  splitTabRow,
  DURATION_GAPS,
} from '../../js/model/document.js';

function makeBlock(str) {
  // Helper: create a tab block from a single e-string pattern, filling others with dashes
  const len = str.length;
  const dash = '-'.repeat(len);
  return createTabRowBlock({
    strings: [str, dash, dash, dash, dash, dash],
  });
}

describe('Insert position: cursor left of note inserts BEFORE it', () => {
  test('insert before existing note', () => {
    const block = makeBlock('-0-|');
    ensureColumns(block);

    // Cursor at column 1 (the note '0')
    const noteIdx = block.columns.findIndex(c => c.type === 'note');
    // Insert at the note position — should go before it
    insertNote(block, noteIdx, ['3', null, null, null, null, null], '1/8');

    const str = block.strings[0];
    expect(str.indexOf('3')).toBeLessThan(str.indexOf('0'));
  });

  test('two inserts at same position stack left to right', () => {
    const block = makeBlock('---|');
    ensureColumns(block);

    // Insert at column 0 (the rest)
    insertNote(block, 0, ['1', null, null, null, null, null], '1/8');
    // Now insert at column 0 again — should go before the '1'
    ensureColumns(block);
    const firstNoteIdx = block.columns.findIndex(c => c.type === 'note');
    insertNote(block, firstNoteIdx, ['2', null, null, null, null, null], '1/8');

    const str = block.strings[0];
    expect(str.indexOf('2')).toBeLessThan(str.indexOf('1'));
  });
});

describe('Backspace deletes the column LEFT of cursor', () => {
  test('backspace on note deletes it', () => {
    const block = makeBlock('-3-5-|');
    ensureColumns(block);

    // Find the column after '3' (should be a rest, then '5')
    const notes = block.columns.filter(c => c.type === 'note');
    expect(notes).toHaveLength(2);

    // Cursor between '3' and '5': find the '5' note index
    const fiveIdx = block.columns.findIndex(c => c.type === 'note' && c.notes[0] === '5');

    // Backspace at fiveIdx should delete '3' (the note before cursor)
    // Walk left from fiveIdx skipping rests to find target
    let targetIdx = fiveIdx - 1;
    while (targetIdx >= 0 && block.columns[targetIdx].type === 'rest') targetIdx--;
    expect(block.columns[targetIdx].type).toBe('note');
    expect(block.columns[targetIdx].notes[0]).toBe('3');

    deleteNote(block, targetIdx);
    const remaining = block.columns.filter(c => c.type === 'note');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].notes[0]).toBe('5');
  });

  test('backspace on barline deletes the barline', () => {
    const block = makeBlock('-3-|-5-|');
    ensureColumns(block);

    const barIndices = block.columns
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.type === 'bar')
      .map(({ i }) => i);

    // There should be multiple bars; delete the middle one
    expect(barIndices.length).toBeGreaterThanOrEqual(2);
    const middleBarIdx = barIndices[1]; // second bar (middle)

    const barsBefore = block.columns.filter(c => c.type === 'bar').length;
    removeBarline(block, middleBarIdx);
    const barsAfter = block.columns.filter(c => c.type === 'bar').length;
    expect(barsAfter).toBe(barsBefore - 1);
  });
});

describe('Delete deletes the column AT/RIGHT of cursor', () => {
  test('delete on a note removes it', () => {
    const block = makeBlock('-3-5-|');
    ensureColumns(block);

    const threeIdx = block.columns.findIndex(c => c.type === 'note' && c.notes[0] === '3');
    deleteNote(block, threeIdx);

    const remaining = block.columns.filter(c => c.type === 'note');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].notes[0]).toBe('5');
  });

  test('delete on a barline removes it', () => {
    const block = makeBlock('-3-|-5-|');
    ensureColumns(block);

    // Find the first internal bar (not the trailing one)
    const barIndices = block.columns
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.type === 'bar');
    expect(barIndices.length).toBeGreaterThanOrEqual(2);

    const barsBefore = barIndices.length;
    removeBarline(block, barIndices[1].i);
    const barsAfter = block.columns.filter(c => c.type === 'bar').length;
    expect(barsAfter).toBe(barsBefore - 1);
  });
});

describe('Enter near a barline', () => {
  test('Enter at a barline splits correctly', () => {
    const block = makeBlock('-3-|-5-|');
    ensureColumns(block);

    // Verify column structure
    const colTypes = block.columns.map(c => c.type);
    // Find the bar that has a note after it
    let splitBar = -1;
    for (let i = 0; i < block.columns.length; i++) {
      if (block.columns[i].type === 'bar') {
        // Check if there's a note somewhere after this bar
        const hasNoteAfter = block.columns.slice(i + 1).some(c => c.type === 'note');
        const hasNoteBefore = block.columns.slice(0, i).some(c => c.type === 'note');
        if (hasNoteBefore && hasNoteAfter) {
          splitBar = i;
          break;
        }
      }
    }
    expect(splitBar).toBeGreaterThanOrEqual(0);

    // Split after the bar
    const [b1, b2] = splitTabRow(block, splitBar + 1);

    // block1 should contain '3'
    const doc1 = createDocument([b1]);
    const text1 = renderDocument(doc1);
    expect(text1).toContain('3');

    // block2 should contain '5'
    const doc2 = createDocument([b2]);
    const text2 = renderDocument(doc2);
    expect(text2).toContain('5');
  });
});

describe('Enter after barline does not produce double bar', () => {
  test('split after middle bar does not create || in block2', () => {
    const block = makeBlock('-3-|-5-|');
    ensureColumns(block);

    // Find the rest right after the middle bar
    let middleBarIdx = -1;
    for (let i = 0; i < block.columns.length; i++) {
      if (block.columns[i].type === 'bar') {
        const hasBefore = block.columns.slice(0, i).some(c => c.type === 'note');
        const hasAfter = block.columns.slice(i + 1).some(c => c.type === 'note');
        if (hasBefore && hasAfter) { middleBarIdx = i; break; }
      }
    }
    expect(middleBarIdx).toBeGreaterThanOrEqual(0);

    // Cursor is right after the bar (on the next column)
    const splitIdx = middleBarIdx + 1;
    const [b1, b2] = splitTabRow(block, splitIdx);

    // block2 rendered should NOT start with || (label| + content|)
    const doc2 = createDocument([b2]);
    const text2 = renderDocument(doc2);
    const eLine = text2.split('\n').find(l => l.startsWith('e|'));
    expect(eLine).toBeTruthy();
    // Should NOT have double pipe after label
    expect(eLine.startsWith('e||')).toBe(false);
  });
});

describe('Insert at end of row goes inside the closing bar', () => {
  test('empty row ---|: click past end, insert note → e|---0-|', () => {
    // The closing | is aesthetic. Insert before it without consuming the leading rest.
    const block = makeBlock('---|');
    ensureColumns(block);

    let colIdx = block.columns.length; // past end
    // Back up to the bar
    if (block.columns[block.columns.length - 1].type === 'bar') {
      colIdx = block.columns.length - 1;
    }

    insertNote(block, colIdx, ['0', null, null, null, null, null], '1/8');

    const doc = createDocument([block]);
    const text = renderDocument(doc);
    const eLine = text.split('\n').find(l => l.startsWith('e|'));
    // Note is inserted before bar: rest(3) + note + spacing + bar
    expect(eLine).toBe('e|---0-|');
  });

  test('D chord press 4 then click past end press 3: exact output', () => {
    // Simulates: empty doc, insert D(0) on D string, then click end, insert G(2) on G string
    const block = makeBlock('---|');
    ensureColumns(block);

    // First note: insert at rest column (index 0), D string fret 0
    insertNote(block, 0, [null, null, null, '0', null, null], '1/8');

    // Click past end: back up to closing bar
    let colIdx = block.columns.length;
    if (block.columns[block.columns.length - 1].type === 'bar') {
      colIdx = block.columns.length - 1;
    }

    // Second note: G string fret 2
    insertNote(block, colIdx, [null, null, '2', null, null, null], '1/8');

    const doc = createDocument([block]);
    const text = renderDocument(doc);
    const eLine = text.split('\n').find(l => l.startsWith('e|'));
    const bLine = text.split('\n').find(l => l.startsWith('B|'));
    const gLine = text.split('\n').find(l => l.startsWith('G|'));
    const dLine = text.split('\n').find(l => l.startsWith('D|'));
    const aLine = text.split('\n').find(l => l.startsWith('A|'));
    const eBigLine = text.split('\n').find(l => l.startsWith('E|'));

    expect(eLine).toBe('e|-----|');
    expect(bLine).toBe('B|-----|');
    expect(gLine).toBe('G|---2-|');
    expect(dLine).toBe('D|-0---|');
    expect(aLine).toBe('A|-----|');
    expect(eBigLine).toBe('E|-----|');
  });

  test('clicking past end with notes already present appends before closing bar', () => {
    const block = makeBlock('-3----|');
    ensureColumns(block);

    let colIdx = block.columns.length;
    if (block.columns[block.columns.length - 1].type === 'bar') {
      colIdx = block.columns.length - 1;
    }

    insertNote(block, colIdx, ['5', null, null, null, null, null], '1/8');

    const doc = createDocument([block]);
    const text = renderDocument(doc);
    const eLine = text.split('\n').find(l => l.startsWith('e|'));
    expect(eLine).toBeTruthy();
    expect(eLine).toMatch(/\|$/);
    expect(eLine).toContain('3');
    expect(eLine).toContain('5');
    expect(eLine.indexOf('3')).toBeLessThan(eLine.indexOf('5'));
  });
});

describe('Chord mode → normal mode transition', () => {
  test('after chord mode, normal insert goes AFTER the chord', () => {
    const block = makeBlock('---|');
    ensureColumns(block);

    // Chord mode: insert note at rest
    insertNote(block, 0, ['3', null, null, null, null, null], '1/8');

    // Find the note
    let noteIdx = block.columns.findIndex(c => c.type === 'note');
    // Chord mode: add another string to same note
    block.columns[noteIdx].notes[2] = '0';

    // Simulate _wasChordMode = true, then normal insert should skip past the chord
    // Skip past note and trailing rest
    let colIdx = noteIdx;
    colIdx++; // past note
    while (colIdx < block.columns.length && block.columns[colIdx].type === 'rest') colIdx++;

    insertNote(block, colIdx, ['5', null, null, null, null, null], '1/8');

    // '5' should appear after '3' in the rendered string
    const str = block.strings[0];
    expect(str.indexOf('3')).toBeLessThan(str.indexOf('5'));
  });

  test('manual navigation to note then insert goes BEFORE the note', () => {
    const block = makeBlock('-3-5-|');
    ensureColumns(block);

    // Find the '5' note
    const fiveIdx = block.columns.findIndex(c => c.type === 'note' && c.notes[0] === '5');

    // Insert at fiveIdx (cursor manually placed there, not from chord mode)
    insertNote(block, fiveIdx, ['7', null, null, null, null, null], '1/8');

    // '7' should be before '5'
    const str = block.strings[0];
    expect(str.indexOf('7')).toBeLessThan(str.indexOf('5'));
  });
});

describe('Delete at end of row combines with next', () => {
  test('two tab rows with text between them can be combined', () => {
    const block1 = makeBlock('-3-|');
    const block2 = makeBlock('-5-|');
    const doc = createDocument([block1, createTextBlock(['']), block2]);

    ensureColumns(block1);
    ensureColumns(block2);

    // Simulate combine: remove trailing bar of block1 and leading bar of block2
    if (block1.columns[block1.columns.length - 1].type === 'bar') block1.columns.pop();
    if (block2.columns[0].type === 'bar') block2.columns.shift();

    block1.columns.push({
      position: 0, width: 1,
      notes: [null, null, null, null, null, null], type: 'bar',
    });
    block1.columns.push(...block2.columns);

    const notes = block1.columns.filter(c => c.type === 'note');
    expect(notes).toHaveLength(2);
    expect(notes[0].notes[0]).toBe('3');
    expect(notes[1].notes[0]).toBe('5');
  });
});
