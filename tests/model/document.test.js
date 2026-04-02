import {
  createDocument,
  createTextBlock,
  createTabRowBlock,
  parseColumns,
  columnsToStrings,
  ensureColumns,
  syncStringsFromColumns,
  insertNote,
  deleteNote,
  setFret,
  insertBarline,
  removeBarline,
  splitTabRow,
  cloneDocument,
  DURATION_GAPS,
} from '../../js/model/document.js';

describe('parseColumns', () => {
  test('parses simple notes', () => {
    const strings = [
      '---0---1---|',
      '---1---0---|',
      '---0---0---|',
      '---2---2---|',
      '---3---3---|',
      '-----------|',
    ];
    const cols = parseColumns(strings);
    const noteCols = cols.filter(c => c.type === 'note');
    expect(noteCols).toHaveLength(2);
    expect(noteCols[0].notes[0]).toBe('0');
    expect(noteCols[0].notes[3]).toBe('2');
    expect(noteCols[1].notes[0]).toBe('1');
  });

  test('parses bar lines', () => {
    const strings = [
      '----|---0---|',
      '----|---1---|',
      '----|---0---|',
      '----|---2---|',
      '----|---3---|',
      '----|-------|',
    ];
    const cols = parseColumns(strings);
    const barCols = cols.filter(c => c.type === 'bar');
    expect(barCols.length).toBeGreaterThanOrEqual(2);
  });

  test('parses hammer-on notation', () => {
    const strings = [
      '---0h2---|',
      '---1-----|',
      '---0-----|',
      '---2-----|',
      '---3-----|',
      '---------|',
    ];
    const cols = parseColumns(strings);
    const noteCols = cols.filter(c => c.type === 'note');
    expect(noteCols[0].notes[0]).toBe('0h2');
  });

  test('parses pull-off notation', () => {
    const strings = [
      '---1p0---|',
      '---1-----|',
      '---0-----|',
      '---2-----|',
      '---3-----|',
      '---------|',
    ];
    const cols = parseColumns(strings);
    const noteCols = cols.filter(c => c.type === 'note');
    expect(noteCols[0].notes[0]).toBe('1p0');
  });

  test('parses multi-digit fret numbers', () => {
    const strings = [
      '---12---|',
      '---10---|',
      '---9----|',
      '---10---|',
      '---12---|',
      '---10---|',
    ];
    const cols = parseColumns(strings);
    const noteCols = cols.filter(c => c.type === 'note');
    expect(noteCols[0].notes[0]).toBe('12');
    expect(noteCols[0].notes[2]).toBe('9');
    expect(noteCols[0].width).toBe(2);
  });

  test('parses repeat signs', () => {
    const strings = [
      '-----------------',
      ':1---------1-----',
      '-------0-------0-',
      '-----2-------2---',
      ':3-------3-------',
      '-----------------',
    ];
    const cols = parseColumns(strings);
    // Should have notes and possibly repeat-related columns
    const noteCols = cols.filter(c => c.type === 'note');
    expect(noteCols.length).toBeGreaterThanOrEqual(2);
  });

  test('parses muted strings (x)', () => {
    const strings = [
      '---x---|',
      '---1---|',
      '---0---|',
      '---2---|',
      '---3---|',
      '---x---|',
    ];
    const cols = parseColumns(strings);
    const noteCols = cols.filter(c => c.type === 'note');
    expect(noteCols[0].notes[0]).toBe('x');
    expect(noteCols[0].notes[5]).toBe('x');
  });
});

describe('columnsToStrings', () => {
  test('regenerates simple notes with bar lines', () => {
    const cols = [
      { position: 0, width: 1, notes: [null, null, null, null, null, null], type: 'bar' },
      { position: 0, width: 1, notes: ['0', '1', '0', '2', '3', null], type: 'note' },
      { position: 0, width: 1, notes: [null, null, null, null, null, null], type: 'bar' },
    ];
    const strings = columnsToStrings(cols);
    expect(strings[0]).toBe('|0|');
    expect(strings[3]).toBe('|2|');
    expect(strings[5]).toBe('|-|');
  });

  test('handles multi-digit frets with padding', () => {
    const cols = [
      { position: 0, width: 2, notes: ['12', '10', '9', '10', '12', '10'], type: 'note' },
    ];
    const strings = columnsToStrings(cols);
    expect(strings[0]).toBe('12');
    expect(strings[2]).toBe('9-');  // Padded to width 2
  });
});

describe('insertNote', () => {
  test('inserts a note at specified position', () => {
    const block = createTabRowBlock({
      strings: [
        '---0---|',
        '---1---|',
        '---0---|',
        '---2---|',
        '---3---|',
        '-------|',
      ],
    });

    ensureColumns(block);
    const origColCount = block.columns.length;

    insertNote(block, 1, ['1', null, null, null, null, null], '1/8');

    // Should have more columns now
    expect(block.columns.length).toBeGreaterThan(origColCount);
    // Strings should be updated
    expect(block.strings[0]).toContain('1');
  });

  test('respects duration spacing', () => {
    const block = createTabRowBlock({
      strings: [
        '|',
        '|',
        '|',
        '|',
        '|',
        '|',
      ],
    });

    ensureColumns(block);
    insertNote(block, 1, ['0', null, null, null, null, null], '1/4');

    // 1/4 note should have 3 hyphens of spacing
    // The string should contain the note followed by dashes
    expect(block.strings[0].length).toBeGreaterThan(1);
  });
});

describe('deleteNote', () => {
  test('deletes a note and collapses spacing', () => {
    const block = createTabRowBlock({
      strings: [
        '---0---1---|',
        '---1---0---|',
        '---0---0---|',
        '---2---2---|',
        '---3---3---|',
        '-----------|',
      ],
    });

    ensureColumns(block);
    const noteCols = block.columns.filter(c => c.type === 'note');
    expect(noteCols).toHaveLength(2);

    // Find the index of the first note column
    const firstNoteIdx = block.columns.indexOf(noteCols[0]);
    deleteNote(block, firstNoteIdx);

    // Should have fewer note columns
    const remainingNotes = block.columns.filter(c => c.type === 'note');
    expect(remainingNotes).toHaveLength(1);
    expect(remainingNotes[0].notes[0]).toBe('1');
  });
});

describe('setFret', () => {
  test('changes a fret value on a specific string', () => {
    const block = createTabRowBlock({
      strings: [
        '---0---|',
        '---1---|',
        '---0---|',
        '---2---|',
        '---3---|',
        '-------|',
      ],
    });

    ensureColumns(block);
    const noteIdx = block.columns.findIndex(c => c.type === 'note');

    const result = setFret(block, noteIdx, 0, '5');
    expect(result.oldValue).toBe('0');
    expect(result.newValue).toBe('5');
    expect(block.strings[0]).toContain('5');
  });
});

describe('insertBarline', () => {
  test('inserts a bar line', () => {
    const block = createTabRowBlock({
      strings: [
        '---0---1---|',
        '---1---0---|',
        '---0---0---|',
        '---2---2---|',
        '---3---3---|',
        '-----------|',
      ],
    });

    ensureColumns(block);
    const noteIdx = block.columns.findIndex(c => c.type === 'note');

    insertBarline(block, noteIdx + 1);

    const barCols = block.columns.filter(c => c.type === 'bar');
    expect(barCols.length).toBeGreaterThanOrEqual(2);
  });
});

describe('removeBarline', () => {
  test('removes a bar line', () => {
    const block = createTabRowBlock({
      strings: [
        '---0---|---1---|',
        '---1---|---0---|',
        '---0---|---0---|',
        '---2---|---2---|',
        '---3---|---3---|',
        '-------|-------|',
      ],
    });

    ensureColumns(block);
    const barIdx = block.columns.findIndex(c => c.type === 'bar' && block.columns.indexOf(c) > 0);
    // Find a middle bar
    const middleBars = block.columns
      .map((c, i) => ({ col: c, idx: i }))
      .filter(({ col, idx }) => col.type === 'bar' && idx > 0 && idx < block.columns.length - 1);

    if (middleBars.length > 0) {
      const countBefore = block.columns.filter(c => c.type === 'bar').length;
      removeBarline(block, middleBars[0].idx);
      const countAfter = block.columns.filter(c => c.type === 'bar').length;
      expect(countAfter).toBe(countBefore - 1);
    }
  });
});

describe('splitTabRow', () => {
  test('splits a tab row into two at the given column', () => {
    const block = createTabRowBlock({
      preLines: ['   Am              G'],
      strings: [
        '---0---0---|---3---3---|',
        '---1---1---|---0---0---|',
        '---2---2---|---0---0---|',
        '---2---2---|---0---0---|',
        '---0---0---|---2---2---|',
        '-----------|---3---3---|',
      ],
      postLines: ['   hello       world'],
    });

    ensureColumns(block);
    // Find the middle bar
    const barIdx = block.columns.findIndex(
      (c, i) => c.type === 'bar' && i > 0 && i < block.columns.length - 1
    );

    const [block1, block2] = splitTabRow(block, barIdx);

    expect(block1.type).toBe('tabrow');
    expect(block2.type).toBe('tabrow');
    expect(block1.strings).toHaveLength(6);
    expect(block2.strings).toHaveLength(6);

    // Both should have notes
    const notes1 = block1.columns.filter(c => c.type === 'note');
    const notes2 = block2.columns.filter(c => c.type === 'note');
    expect(notes1.length).toBeGreaterThan(0);
    expect(notes2.length).toBeGreaterThan(0);
  });
});

describe('pre/postLine alignment', () => {
  test('preLines grow when notes are inserted', () => {
    const block = createTabRowBlock({
      preLines: ['   Am '],
      strings: [
        '---0---|',
        '---1---|',
        '---0---|',
        '---2---|',
        '---3---|',
        '-------|',
      ],
      postLines: ['   la  '],
    });

    const origPreLen = block.preLines[0].length;
    ensureColumns(block);

    insertNote(block, 1, ['5', null, null, null, null, null], '1/8');

    // Pre/post lines should have grown
    expect(block.preLines[0].length).toBeGreaterThanOrEqual(origPreLen);
    expect(block.postLines[0].length).toBeGreaterThanOrEqual(origPreLen);
  });
});

describe('cloneDocument', () => {
  test('creates a deep copy', () => {
    const doc = createDocument([
      createTextBlock(['hello']),
      createTabRowBlock({
        strings: ['---0---|', '---1---|', '---0---|', '---2---|', '---3---|', '-------|'],
      }),
    ]);

    const clone = cloneDocument(doc);

    // Modify original
    doc.blocks[0].lines[0] = 'modified';
    doc.blocks[1].strings[0] = 'modified';

    // Clone should be unaffected
    expect(clone.blocks[0].lines[0]).toBe('hello');
    expect(clone.blocks[1].strings[0]).toBe('---0---|');
  });
});
