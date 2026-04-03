/**
 * Tests for pre/postLine alignment when inserting and deleting.
 */

import { renderDocument } from '../../js/model/renderer.js';
import {
  createDocument,
  createTextBlock,
  createTabRowBlock,
  ensureColumns,
  insertNote,
  syncStringsFromColumns,
} from '../../js/model/document.js';

describe('PreLine alignment on insert', () => {
  test('inserting a note shifts chord names to stay aligned', () => {
    const block = createTabRowBlock({
      preLines: ['   C              G'],
      strings: [
        '---0-------0---|---3-------3---|',
        '-----1-------1-|-----0-------0-|',
        '-------0---0---|-------0---0---|',
        '-----2-------2-|-----0-------0-|',
        '-3-------3-----|---------2-----|',
        '---------------|-3-------3-----|',
      ],
      postLines: ['   here are some   words to sing'],
    });

    ensureColumns(block);
    const preLineBefore = block.preLines[0];
    const postLineBefore = block.postLines[0];

    // Insert a note somewhere in the middle
    const midCol = Math.floor(block.columns.length / 2);
    const charPosBefore = block.columns[midCol].position;

    insertNote(block, midCol, ['5', null, null, null, null, null], '1/8');

    // The preLine should have grown with spaces inserted at the edit position
    expect(block.preLines[0].length).toBeGreaterThan(preLineBefore.length);
    // The text before the edit position should be unchanged
    expect(block.preLines[0].substring(0, charPosBefore)).toBe(
      preLineBefore.substring(0, charPosBefore)
    );
  });
});

describe('PostLine alignment on delete', () => {
  test('deleting a rest where all pre/postLines have spaces removes the space', () => {
    // Create a tab with chord names that have spaces at a known position
    const block = createTabRowBlock({
      preLines: ['   C         G'],
      strings: [
        '-0-----3-|',
        '-1-----0-|',
        '-0-----0-|',
        '-2-----0-|',
        '-3-----2-|',
        '-------3-|',
      ],
      postLines: ['   la    da'],
    });

    ensureColumns(block);
    const preLineBefore = block.preLines[0];
    const postLineBefore = block.postLines[0];

    // Find a rest column in the middle where pre and post lines have spaces
    let restIdx = -1;
    for (let i = 1; i < block.columns.length - 1; i++) {
      if (block.columns[i].type === 'rest') {
        const pos = block.columns[i].position;
        const preChar = preLineBefore[pos] || ' ';
        const postChar = postLineBefore[pos] || ' ';
        if (preChar === ' ' && postChar === ' ') {
          restIdx = i;
          break;
        }
      }
    }

    if (restIdx >= 0) {
      const charPos = block.columns[restIdx].position;
      block._editCharPos = charPos;
      block.columns.splice(restIdx, 1);
      syncStringsFromColumns(block);

      // Pre and post lines should have shrunk (space removed at the position)
      expect(block.preLines[0].length).toBeLessThan(preLineBefore.length);
      expect(block.postLines[0].length).toBeLessThan(postLineBefore.length);
    }
  });

  test('deleting where postLine has text does NOT remove from postLine', () => {
    const block = createTabRowBlock({
      preLines: [''],
      strings: [
        '-0-3-|',
        '-1-0-|',
        '-0-0-|',
        '-2-0-|',
        '-3-2-|',
        '---3-|',
      ],
      postLines: ['abcdef'],
    });

    ensureColumns(block);
    const postLineBefore = block.postLines[0];

    // Delete a column where the postLine has a non-space character
    const restIdx = block.columns.findIndex(c => c.type === 'rest');
    if (restIdx >= 0) {
      const charPos = block.columns[restIdx].position;
      block._editCharPos = charPos;
      block.columns.splice(restIdx, 1);
      syncStringsFromColumns(block);

      // PostLine should NOT have changed (has text at the position)
      expect(block.postLines[0]).toBe(postLineBefore);
    }
  });
});
