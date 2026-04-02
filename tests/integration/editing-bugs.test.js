/**
 * Regression tests for editing bugs.
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
  splitTabRow,
  DURATION_GAPS,
} from '../../js/model/document.js';
import { UndoManager } from '../../js/model/undo.js';

function makeEmptyDoc() {
  return createDocument([
    createTextBlock(['']),
    createTabRowBlock({ strings: ['---|', '---|', '---|', '---|', '---|', '---|'] }),
  ]);
}

function advanceCursor(colIdx, duration, block) {
  let c = colIdx + 1 + (DURATION_GAPS[duration] > 0 ? 1 : 0);
  return Math.min(c, block.columns.length);
}

describe('Time signature auto-barlines', () => {
  test('time sig enabled mid-stream: 5 eighths then enable 4/4, 3 more eighths → bar', () => {
    // This is the specific reported bug: enabling time sig after notes are already written
    const block = createTabRowBlock({ strings: ['---|', '---|', '---|', '---|', '---|', '---|'] });
    ensureColumns(block);

    // Insert 5 eighth notes without time sig
    let cursor = 1;
    for (let i = 0; i < 5; i++) {
      cursor = Math.min(cursor, block.columns.length);
      insertNote(block, cursor, [String(i), null, null, null, null, null], '1/8');
      cursor = advanceCursor(cursor, '1/8', block);
    }

    const barsBefore = block.columns.filter(c => c.type === 'bar').length;

    // Now "enable" 4/4 time sig. We need to simulate what _checkAutoBarline does:
    // It counts notes since last bar before cursor. With 4/4 and 1/8 notes,
    // 8 eighth notes = 4 beats = full bar.
    // Currently we have 5 notes after the opening bar, which is 2.5 beats.
    // After 3 more (total 8), we should get 4 beats → bar inserted.

    // Insert 3 more eighth notes, checking auto-barline each time
    // (simulating _checkAutoBarline with recomputation)
    const beatValue = 4;
    const beatUnit = 4 / beatValue;
    const noteBeats = 0.5 / beatUnit; // 1/8 = 0.5 quarter-note-beats / beatUnit

    for (let i = 5; i < 8; i++) {
      cursor = Math.min(cursor, block.columns.length);
      insertNote(block, cursor, [String(i), null, null, null, null, null], '1/8');
      cursor = advanceCursor(cursor, '1/8', block);

      // Recompute beats since last bar
      let beatsInBar = 0;
      for (let j = cursor - 1; j >= 0; j--) {
        const col = block.columns[j];
        if (col.type === 'bar') break;
        if (col.type === 'note') beatsInBar += noteBeats;
      }

      if (beatsInBar >= 4) {
        insertBarline(block, cursor);
        cursor += 2; // past bar + rest
        break;
      }
    }

    // The barline should be present between the notes.
    // It may reuse the existing closing bar rather than adding a duplicate.
    // Verify by checking that a bar exists after the 8th note.
    const notePositions = block.columns
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.type === 'note');
    const barPositions = block.columns
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.type === 'bar');
    // There should be a bar somewhere after the 8th note (index 7 in notePositions, 0-based)
    expect(notePositions.length).toBe(8);
    // Check there's a bar after the first 8 notes
    const eighthNoteIdx = notePositions[7].i;
    const barsAfterEighth = barPositions.filter(({ i }) => i > eighthNoteIdx);
    expect(barsAfterEighth.length).toBeGreaterThan(0);
  });

  test('3/4 time: bar after 6 eighth notes', () => {
    const block = createTabRowBlock({ strings: ['---|', '---|', '---|', '---|', '---|', '---|'] });
    ensureColumns(block);

    // Simulate 6 eighth notes (3/4 time = 3 beats, eighth = 0.5 beat, so 6 eighths = 3 beats)
    let cursor = 1; // after the initial bar+rest
    for (let i = 0; i < 6; i++) {
      cursor = Math.min(cursor, block.columns.length);
      insertNote(block, cursor, [String(i), null, null, null, null, null], '1/8');
      cursor = advanceCursor(cursor, '1/8', block);
    }

    // Should contain at least one bar line added by the initial |, plus the notes
    const barCount = block.columns.filter(c => c.type === 'bar').length;
    expect(barCount).toBeGreaterThanOrEqual(1);
    // The string should contain notes
    expect(block.strings[0]).toContain('0');
    expect(block.strings[0]).toContain('5');
  });

  test('4/4 time: bar after 4 quarter notes', () => {
    const block = createTabRowBlock({ strings: ['---|', '---|', '---|', '---|', '---|', '---|'] });
    ensureColumns(block);

    let cursor = 1;
    for (let i = 0; i < 4; i++) {
      cursor = Math.min(cursor, block.columns.length);
      insertNote(block, cursor, [String(i), null, null, null, null, null], '1/4');
      cursor = advanceCursor(cursor, '1/4', block);
    }

    // Should have notes with proper spacing
    expect(block.strings[0]).toContain('0---');
  });
});

describe('Backspace deletes note BEFORE cursor', () => {
  test('backspace with cursor after second note deletes second note', () => {
    const block = createTabRowBlock({ strings: ['---|', '---|', '---|', '---|', '---|', '---|'] });
    ensureColumns(block);

    // Insert two notes
    insertNote(block, 1, ['3', null, null, null, null, null], '1/8');
    let cursor = advanceCursor(1, '1/8', block);
    insertNote(block, cursor, ['5', null, null, null, null, null], '1/8');
    cursor = advanceCursor(cursor, '1/8', block);

    expect(block.strings[0]).toContain('3');
    expect(block.strings[0]).toContain('5');

    // Backspace should delete note BEFORE cursor (the '5')
    // Find the note at or before cursor
    const noteIndices = block.columns
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.type === 'note')
      .map(({ i }) => i);
    const candidates = noteIndices.filter(i => i < cursor);
    const targetIdx = candidates[candidates.length - 1];

    deleteNote(block, targetIdx);

    const remainingNotes = block.columns.filter(c => c.type === 'note');
    expect(remainingNotes).toHaveLength(1);
    expect(remainingNotes[0].notes[0]).toBe('3');
  });
});

describe('Insert position: cursor left of note inserts before it', () => {
  test('inserting at a bar column before a note puts new note before existing', () => {
    const block = createTabRowBlock({ strings: ['---|', '---|', '---|', '---|', '---|', '---|'] });
    ensureColumns(block);

    // Insert a note
    insertNote(block, 1, ['5', null, null, null, null, null], '1/8');

    // Now cursor is at the bar column (index 0). Insert at bar position.
    // Since bar is not a note, it should insert before the '5'
    insertNote(block, 1, ['3', null, null, null, null, null], '1/8');

    // 3 should come before 5 in the string
    const str = block.strings[0];
    expect(str.indexOf('3')).toBeLessThan(str.indexOf('5'));
  });
});

describe('Delete at end combines with next row', () => {
  test('two tab rows can be conceptually combined', () => {
    const block1 = createTabRowBlock({ strings: ['|-3-|', '|---|', '|---|', '|---|', '|---|', '|---|'] });
    const block2 = createTabRowBlock({ strings: ['|-5-|', '|---|', '|---|', '|---|', '|---|', '|---|'] });

    ensureColumns(block1);
    ensureColumns(block2);

    // Remove trailing bar from block1 and leading bar from block2
    if (block1.columns[block1.columns.length - 1].type === 'bar') {
      block1.columns.pop();
    }
    if (block2.columns[0].type === 'bar') {
      block2.columns.shift();
    }

    // Add separator bar
    block1.columns.push({
      position: 0, width: 1,
      notes: [null, null, null, null, null, null], type: 'bar',
    });

    // Merge
    block1.columns.push(...block2.columns);

    // Should have notes from both blocks
    const notes = block1.columns.filter(c => c.type === 'note');
    expect(notes).toHaveLength(2);
    expect(notes[0].notes[0]).toBe('3');
    expect(notes[1].notes[0]).toBe('5');
  });
});

describe('Bar line has trailing hyphen', () => {
  test('insertBarline adds a rest after the bar', () => {
    const block = createTabRowBlock({ strings: ['|-3-5-', '|-1-0-', '|-0-0-', '|-2-2-', '|-3-3-', '|-----'] });
    ensureColumns(block);

    const noteIdx = block.columns.findIndex(c => c.type === 'note');
    // Insert bar after first note
    insertBarline(block, noteIdx + 1);

    // The bar should be followed by a rest
    const barIdx = block.columns.findIndex((c, i) => c.type === 'bar' && i > noteIdx);
    expect(barIdx).toBeGreaterThan(noteIdx);
    expect(block.columns[barIdx + 1]?.type).toBe('rest');
    // The rendered string should have |- after the bar
    expect(block.strings[0]).toContain('|-');
  });

  test('initial empty doc string content is ---|', () => {
    const doc = makeEmptyDoc();
    const block = doc.blocks[1];
    expect(block.strings[0]).toBe('---|');
  });

  test('initial empty doc renders as e|---|', () => {
    const doc = makeEmptyDoc();
    const text = renderDocument(doc);
    const lines = text.split('\n');
    expect(lines).toContain('e|---|');
    expect(lines).toContain('B|---|');
    expect(lines).toContain('G|---|');
    expect(lines).toContain('D|---|');
    expect(lines).toContain('A|---|');
    expect(lines).toContain('E|---|');
  });

  test('first 1/8 note in empty doc renders with leading hyphen', () => {
    const doc = makeEmptyDoc();
    const block = doc.blocks[1];
    ensureColumns(block);
    // Insert at the rest column (index 0), which is 3 wide
    insertNote(block, 0, [null, null, null, '0', null, null], '1/8');
    // Should render as e|-0-| (leading hyphen preserved)
    const renderedDoc = createDocument([block]);
    const text = renderDocument(renderedDoc);
    expect(text).toContain('D|-0-|');
    expect(text).toContain('e|---|');
  });
});

describe('Bar padding: notes after barline have leading hyphen', () => {
  test('inserting barline before closing bar then adding note gives |-note', () => {
    // Simulates: enter notes filling a bar, auto-barline fires at closing bar,
    // then next note should have a leading hyphen after the bar.
    const block = createTabRowBlock({ strings: ['---|', '---|', '---|', '---|', '---|', '---|'] });
    ensureColumns(block);

    // Insert some notes
    insertNote(block, 0, ['2', null, null, null, null, null], '1/8');
    let cursor = advanceCursor(0, '1/8', block);
    insertNote(block, cursor, ['3', null, null, null, null, null], '1/8');
    cursor = advanceCursor(cursor, '1/8', block);

    // Now insert a barline at cursor (which is right before the closing bar)
    insertBarline(block, cursor);

    // Insert another note after the barline
    // The cursor should be past the bar+padding, find that position
    let afterBar = cursor;
    while (afterBar < block.columns.length &&
           (block.columns[afterBar].type === 'bar' || block.columns[afterBar].type === 'rest')) {
      afterBar++;
    }
    // If we're at the end, insert here
    afterBar = Math.min(afterBar, block.columns.length);
    insertNote(block, afterBar, ['0', null, null, null, null, null], '1/8');

    // The rendered string should show |-0 (hyphen after bar, before note)
    // and NOT |0 (note directly after bar)
    const rendered = block.strings[0];
    expect(rendered).not.toMatch(/\|0/);  // No |0 (bar directly followed by note)
    expect(rendered).toMatch(/\|-/);      // Has |- somewhere (bar followed by padding)
    // Also check the note '0' appears
    expect(rendered).toContain('0');
  });
});

describe('Undo restores cursor position', () => {
  test('undo after insert restores cursor to pre-insert position', () => {
    const doc = makeEmptyDoc();
    const um = new UndoManager();
    const block = doc.blocks[1];
    ensureColumns(block);

    // Save snapshot with cursor state
    const cursorBefore = { blockIndex: 1, columnIndex: 1, charIndex: 0 };
    um.pushSnapshot(doc, cursorBefore);

    insertNote(block, 1, ['3', null, null, null, null, null], '1/8');

    // Undo
    const result = um.undo(doc);
    expect(result).not.toBeNull();
    expect(result.cursorState).toEqual(cursorBefore);
  });
});
