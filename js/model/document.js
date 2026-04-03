/**
 * Document model: the central data structure for a guitar tab file.
 */

/**
 * @typedef {Object} TextBlock
 * @property {'text'} type
 * @property {string[]} lines
 */

/**
 * @typedef {Object} TabRowBlock
 * @property {'tabrow'} type
 * @property {string[]} preLines - Lines above the tab (chords, timing, etc.)
 * @property {string[]} strings - 6 raw tab string lines [e, B, G, D, A, E]
 * @property {string[]} postLines - Lines below the tab (lyrics, timing, etc.)
 * @property {string[]} rightAnnotations - Per-string annotations (6 entries, '' if none)
 * @property {string[]} labels - String labels (e.g., ['e','B','G','D','A','E'])
 * @property {TabColumn[]|null} columns - Lazy-parsed structured columns
 */

/**
 * @typedef {Object} TabColumn
 * @property {number} position - Character offset in raw string
 * @property {number} width - Character width (1 for single-digit frets, 2 for 10+)
 * @property {(string|null)[]} notes - Per-string note value or null (6 entries)
 * @property {'note'|'bar'|'repeat-start'|'repeat-end'|'rest'} type
 */

/**
 * @typedef {TextBlock|TabRowBlock} Block
 */

// Note duration to hyphen gap mapping
export const DURATION_GAPS = {
  '1/16': 0,
  '1/8': 1,
  '1/4': 3,
  '1/2': 7,
};

/**
 * Creates a new empty Document.
 * @returns {Object}
 */
export function createDocument(blocks = [], style = null) {
  return {
    blocks,
    style: style || {
      blankLinesBetweenRows: 1,
      preLineTypes: [],
      postLineTypes: [],
    },
  };
}

/**
 * Creates a TextBlock.
 * @param {string[]} lines
 * @returns {TextBlock}
 */
export function createTextBlock(lines) {
  return { type: 'text', lines: [...lines] };
}

/**
 * Creates a TabRowBlock.
 * @param {Object} opts
 * @returns {TabRowBlock}
 */
export function createTabRowBlock({
  preLines = [],
  strings,
  postLines = [],
  rightAnnotations = ['', '', '', '', '', ''],
  labels = ['e', 'B', 'G', 'D', 'A', 'E'],
  columns = null,
} = {}) {
  return {
    type: 'tabrow',
    preLines: [...preLines],
    strings: [...strings],
    postLines: [...postLines],
    rightAnnotations: [...rightAnnotations],
    labels: [...labels],
    columns,
  };
}

// ---------------------------------------------------------------------------
// Column parsing: raw strings → TabColumn[]
// ---------------------------------------------------------------------------

/**
 * Parse the 6 raw tab strings into an array of TabColumn objects.
 * @param {string[]} strings - 6 raw string contents (without label prefix)
 * @returns {TabColumn[]}
 */
export function parseColumns(strings) {
  const columns = [];
  const len = Math.max(...strings.map(s => s.length));
  let pos = 0;

  while (pos < len) {
    // Check what's at this position across all strings
    const chars = strings.map(s => s[pos] || '-');

    // Check for ‖: (unicode repeat-start) or :‖ (unicode repeat-end)
    if (chars.some(c => c === '‖')) {
      const nextChars = strings.map(s => s[pos + 1] || '');
      const prevChars = pos > 0 ? strings.map(s => s[pos - 1] || '') : strings.map(() => '');

      if (nextChars.some(c => c === ':')) {
        columns.push({ position: pos, width: 2, notes: [null,null,null,null,null,null], type: 'repeat-start' });
        pos += 2;
        continue;
      }
      if (prevChars.some(c => c === ':')) {
        columns.push({ position: pos, width: 1, notes: [null,null,null,null,null,null], type: 'repeat-end' });
        pos++;
        continue;
      }
      // Standalone ‖ — treat as bar
      columns.push({ position: pos, width: 1, notes: [null,null,null,null,null,null], type: 'bar' });
      pos++;
      continue;
    }

    // Bar line or repeat marker (ASCII |)
    if (chars.every(c => c === '|' || c === ':' || c === '-') && chars.some(c => c === '|')) {
      // Look ahead for repeat patterns
      const nextChars = strings.map(s => s[pos + 1] || '');
      const prevChars = pos > 0 ? strings.map(s => s[pos - 1] || '') : strings.map(() => '');

      if (chars.some(c => c === '|') && nextChars.some(c => c === ':')) {
        // |: repeat start — consume both characters
        columns.push({
          position: pos,
          width: 2,
          notes: [null, null, null, null, null, null],
          type: 'repeat-start',
        });
        pos += 2;
        continue;
      }

      if (prevChars.some(c => c === ':') || chars.some(c => c === ':')) {
        // Check if this is the | part of :|
        // We handle :| by looking at current chars for : and |
        const hasColon = chars.some(c => c === ':');
        const hasPipe = chars.some(c => c === '|');
        if (hasColon && hasPipe) {
          // This position has mixed : and | — it's a repeat-end :|
          columns.push({
            position: pos,
            width: 1,
            notes: [null, null, null, null, null, null],
            type: 'repeat-end',
          });
          pos++;
          continue;
        }
      }

      // Plain bar line
      columns.push({
        position: pos,
        width: 1,
        notes: [null, null, null, null, null, null],
        type: 'bar',
      });
      pos++;
      continue;
    }

    // Colon at this position — check for :‖ repeat-end
    if (chars.some(c => c === ':') && chars.every(c => c === ':' || c === '-')) {
      const nextChars = strings.map(s => s[pos + 1] || '');
      if (nextChars.some(c => c === '‖')) {
        // :‖ repeat end — consume both characters
        columns.push({ position: pos, width: 2, notes: [null,null,null,null,null,null], type: 'repeat-end' });
        pos += 2;
        continue;
      }
      // Standalone colon — skip, it's a repeat marker continuation
      pos++;
      continue;
    }

    // Dash (rest/spacing) — one column per hyphen
    if (chars.every(c => c === '-' || c === ' ')) {
      columns.push({
        position: pos,
        width: 1,
        notes: [null, null, null, null, null, null],
        type: 'rest',
      });
      pos++;
      continue;
    }

    // Note column: at least one string has a digit
    if (chars.some(c => /[0-9]/.test(c))) {
      const notes = [];
      let maxWidth = 1;

      for (let s = 0; s < 6; s++) {
        const str = strings[s];
        const ch = str[pos] || '-';

        if (/[0-9]/.test(ch)) {
          // Read full note: digits + optional technique suffix
          let noteStr = ch;
          let j = pos + 1;

          // Multi-digit fret number
          while (j < str.length && /[0-9]/.test(str[j])) {
            noteStr += str[j];
            j++;
          }

          // Technique suffixes (h, p, b, s, r, v, /, \, ~)
          while (j < str.length && /[hpbsrv/\\~]/.test(str[j])) {
            noteStr += str[j];
            j++;
          }

          // After technique, there might be a target fret (e.g., 1p0, 5h7)
          while (j < str.length && /[0-9]/.test(str[j])) {
            noteStr += str[j];
            j++;
          }

          notes.push(noteStr);
          maxWidth = Math.max(maxWidth, j - pos);
        } else if (ch === 'x' || ch === 'X') {
          notes.push('x');
        } else {
          notes.push(null);
        }
      }

      columns.push({
        position: pos,
        width: maxWidth,
        notes,
        type: 'note',
      });
      pos += maxWidth;
      continue;
    }

    // Muted string marker (x/X without digits)
    if (chars.some(c => c === 'x' || c === 'X')) {
      const notes = chars.map(c => (c === 'x' || c === 'X') ? 'x' : null);
      columns.push({
        position: pos,
        width: 1,
        notes,
        type: 'note',
      });
      pos++;
      continue;
    }

    // Unknown character — skip
    pos++;
  }

  return columns;
}

/**
 * Regenerate raw strings from a TabColumn array.
 * @param {TabColumn[]} columns
 * @returns {string[]} 6 raw tab strings
 */
export function columnsToStrings(columns) {
  const lines = ['', '', '', '', '', ''];

  // Determine how many trailing columns to skip (bar-rest-bar → skip rest+bar)
  let endIdx = columns.length;
  if (endIdx >= 3 &&
      columns[endIdx - 1].type === 'bar' &&
      columns[endIdx - 2].type === 'rest' &&
      columns[endIdx - 3].type === 'bar') {
    endIdx -= 2; // skip the trailing rest + closing bar
  }

  for (let ci = 0; ci < endIdx; ci++) {
    const col = columns[ci];
    if (col.type === 'bar') {
      for (let s = 0; s < 6; s++) lines[s] += '|';
    } else if (col.type === 'repeat-start') {
      for (let s = 0; s < 6; s++) lines[s] += '‖:';
    } else if (col.type === 'repeat-end') {
      for (let s = 0; s < 6; s++) lines[s] += ':‖';
    } else if (col.type === 'rest') {
      // Rest columns: use stored width for spacing
      const w = col.width || 1;
      for (let s = 0; s < 6; s++) {
        lines[s] += '-'.repeat(w);
      }
    } else if (col.type === 'note') {
      // Determine width needed for this column from note content
      let maxNoteLen = 1;
      for (let s = 0; s < 6; s++) {
        const note = col.notes[s];
        if (note) maxNoteLen = Math.max(maxNoteLen, note.length);
      }

      for (let s = 0; s < 6; s++) {
        const note = col.notes[s];
        if (note) {
          lines[s] += note;
          lines[s] += '-'.repeat(maxNoteLen - note.length);
        } else {
          lines[s] += '-'.repeat(maxNoteLen);
        }
      }
    }
  }

  return lines;
}

/**
 * Ensure a TabRowBlock has its columns parsed. Parses lazily on first access.
 * @param {TabRowBlock} block
 * @returns {TabColumn[]}
 */
export function ensureColumns(block) {
  if (!block.columns) {
    block.columns = parseColumns(block.strings);
  }
  return block.columns;
}

/**
 * Regenerate a TabRowBlock's raw strings from its columns.
 * Also adjusts preLines and postLines to maintain alignment.
 * @param {TabRowBlock} block
 */
export function syncStringsFromColumns(block) {
  if (!block.columns) return;

  const oldLen = block.strings[0] ? block.strings[0].length : 0;
  block.strings = columnsToStrings(block.columns);
  const newLen = block.strings[0].length;

  // Update column positions based on generated strings (don't re-parse — columns are authoritative)
  let pos = 0;
  for (const col of block.columns) {
    col.position = pos;
    if (col.type === 'bar') {
      pos += 1;
    } else if (col.type === 'repeat-start') {
      pos += 2;
    } else if (col.type === 'repeat-end') {
      pos += 2;
    } else if (col.type === 'rest') {
      pos += col.width;
    } else {
      // note: width is the max note length in the column
      const maxNoteLen = Math.max(1, ...col.notes.filter(Boolean).map(n => n.length));
      col.width = maxNoteLen;
      pos += maxNoteLen;
    }
  }

  // Adjust pre/post lines to stay aligned with the tab content
  const delta = newLen - oldLen;
  if (delta > 0 && block._editCharPos !== undefined) {
    // Insertion: add spaces at the edit position
    const pos = block._editCharPos;
    block.preLines = block.preLines.map(line => {
      const padded = line.padEnd(pos, ' ');
      return padded.substring(0, pos) + ' '.repeat(delta) + padded.substring(pos);
    });
    block.postLines = block.postLines.map(line => {
      const padded = line.padEnd(pos, ' ');
      return padded.substring(0, pos) + ' '.repeat(delta) + padded.substring(pos);
    });
    delete block._editCharPos;
  } else if (delta < 0 && block._editCharPos !== undefined) {
    // Deletion: remove characters at the edit position only if ALL lines have spaces there
    const pos = block._editCharPos;
    const removeCount = -delta;
    const allPreSpaces = block.preLines.every(line => {
      const segment = (line.padEnd(pos + removeCount, ' ')).substring(pos, pos + removeCount);
      return segment.trim() === '';
    });
    const allPostSpaces = block.postLines.every(line => {
      const segment = (line.padEnd(pos + removeCount, ' ')).substring(pos, pos + removeCount);
      return segment.trim() === '';
    });
    if (allPreSpaces && allPostSpaces) {
      block.preLines = block.preLines.map(line => {
        const padded = line.padEnd(pos + removeCount, ' ');
        return padded.substring(0, pos) + padded.substring(pos + removeCount);
      });
      block.postLines = block.postLines.map(line => {
        const padded = line.padEnd(pos + removeCount, ' ');
        return padded.substring(0, pos) + padded.substring(pos + removeCount);
      });
    }
    delete block._editCharPos;
  } else if (delta !== 0) {
    // Fallback: pad/trim at the end
    block.preLines = block.preLines.map(line => adjustLineLength(line, oldLen, newLen));
    block.postLines = block.postLines.map(line => adjustLineLength(line, oldLen, newLen));
  }
}

// ---------------------------------------------------------------------------
// Document mutation helpers
// ---------------------------------------------------------------------------

/**
 * Insert a note column at the given index in a TabRowBlock.
 * Updates both columns and raw strings, and shifts pre/postLines.
 * @param {TabRowBlock} block
 * @param {number} colIdx - Index in columns array to insert at
 * @param {(string|null)[]} notes - 6-element array of note values
 * @param {string} duration - Duration key ('1/8', '1/4', etc.)
 * @returns {{ colIdx: number, notes: (string|null)[], duration: string }} - Info for undo
 */
export function insertNote(block, colIdx, notes, duration = '1/8') {
  ensureColumns(block);
  // Record the character position of the edit for pre/postLine alignment
  block._editCharPos = colIdx < block.columns.length
    ? block.columns[colIdx].position
    : (block.columns.length > 0
      ? block.columns[block.columns.length - 1].position + block.columns[block.columns.length - 1].width
      : 0);
  const gap = duration in DURATION_GAPS ? DURATION_GAPS[duration] : 1;
  const noteWidth = Math.max(1, ...notes.filter(Boolean).map(n => n.length));
  const totalWidth = noteWidth + gap;

  // Build the new note column
  const newCol = {
    position: 0,
    width: noteWidth,
    notes: [...notes],
    type: 'note',
  };

  // Build spacing rest columns (one per hyphen)
  const restCols = [];
  for (let i = 0; i < gap; i++) {
    restCols.push({
      position: 0, width: 1,
      notes: [null, null, null, null, null, null], type: 'rest',
    });
  }

  const insertItems = [newCol, ...restCols];

  // If inserting right after a bar with no rest between, add a leading padding rest
  if (colIdx > 0 && block.columns[colIdx - 1].type === 'bar' &&
      (colIdx >= block.columns.length || block.columns[colIdx].type !== 'rest')) {
    insertItems.unshift({
      position: 0, width: 1,
      notes: [null, null, null, null, null, null], type: 'rest',
    });
  }

  // If inserting at a rest column, consume consecutive rest columns from the end
  // (preserving leading hyphens)
  if (colIdx < block.columns.length && block.columns[colIdx].type === 'rest') {
    // Count consecutive rests starting at colIdx
    let restCount = 0;
    while (colIdx + restCount < block.columns.length &&
           block.columns[colIdx + restCount].type === 'rest') {
      restCount++;
    }
    // Keep exactly 1 leading rest for aesthetics, consume the rest
    const keepLeading = 1;
    const consumeCount = restCount - keepLeading;
    block.columns.splice(colIdx + keepLeading, consumeCount, ...insertItems);
  } else {
    block.columns.splice(colIdx, 0, ...insertItems);
  }

  syncStringsFromColumns(block);

  return { colIdx, notes, duration };
}

/**
 * Delete a note column at the given index in a TabRowBlock.
 * Also removes associated spacing.
 * @param {TabRowBlock} block
 * @param {number} colIdx - Index in columns array to delete
 * @returns {{ colIdx: number, savedCol: TabColumn, savedSpacing: TabColumn|null }} - Info for undo
 */
export function deleteNote(block, colIdx) {
  ensureColumns(block);

  if (colIdx < 0 || colIdx >= block.columns.length) return null;

  const savedCol = { ...block.columns[colIdx], notes: [...block.columns[colIdx].notes] };

  // Remove the column
  block.columns.splice(colIdx, 1);

  // Remove adjacent rest/spacing if present
  let savedSpacing = null;
  if (colIdx < block.columns.length && block.columns[colIdx].type === 'rest') {
    savedSpacing = { ...block.columns[colIdx] };
    block.columns.splice(colIdx, 1);
  } else if (colIdx > 0 && block.columns[colIdx - 1].type === 'rest') {
    savedSpacing = { ...block.columns[colIdx - 1] };
    block.columns.splice(colIdx - 1, 1);
  }

  syncStringsFromColumns(block);

  return { colIdx, savedCol, savedSpacing };
}

/**
 * Set a single fret value on one string at a specific column.
 * @param {TabRowBlock} block
 * @param {number} colIdx
 * @param {number} stringIdx - 0-5
 * @param {string|null} value - Fret value or null
 * @returns {{ colIdx: number, stringIdx: number, oldValue: string|null, newValue: string|null }}
 */
export function setFret(block, colIdx, stringIdx, value) {
  ensureColumns(block);
  const col = block.columns[colIdx];
  if (!col) return null;

  const oldValue = col.notes[stringIdx];
  col.notes[stringIdx] = value;

  // Recalculate width
  col.width = Math.max(1, ...col.notes.filter(Boolean).map(n => n.length));

  syncStringsFromColumns(block);

  return { colIdx, stringIdx, oldValue, newValue: value };
}

/**
 * Insert a bar line at the given column index.
 * @param {TabRowBlock} block
 * @param {number} colIdx
 * @returns {{ colIdx: number }}
 */
export function insertBarline(block, colIdx) {
  ensureColumns(block);
  block._editCharPos = colIdx < block.columns.length
    ? block.columns[colIdx].position
    : (block.columns.length > 0
      ? block.columns[block.columns.length - 1].position + block.columns[block.columns.length - 1].width
      : 0);

  const REST_COL = () => ({
    position: 0, width: 1,
    notes: [null, null, null, null, null, null], type: 'rest',
  });

  const barCol = {
    position: 0, width: 1,
    notes: [null, null, null, null, null, null], type: 'bar',
  };

  block.columns.splice(colIdx, 0, barCol);

  // Ensure padding rest AFTER the bar if there's content following it
  const newAfter = colIdx + 1;
  if (newAfter < block.columns.length && block.columns[newAfter].type !== 'rest') {
    block.columns.splice(newAfter, 0, REST_COL());
  }

  syncStringsFromColumns(block);

  return { colIdx };
}

/**
 * Insert a repeat-start marker (‖:) at the given column index.
 * If inserting at a plain bar, replaces it.
 */
export function insertRepeatStart(block, colIdx) {
  ensureColumns(block);
  block._editCharPos = colIdx < block.columns.length
    ? block.columns[colIdx].position : 0;

  const repeatCol = {
    position: 0, width: 2,
    notes: [null, null, null, null, null, null], type: 'repeat-start',
  };

  // If the column at colIdx is a plain bar, replace it
  if (colIdx < block.columns.length && block.columns[colIdx].type === 'bar') {
    block.columns.splice(colIdx, 1, repeatCol);
  } else {
    block.columns.splice(colIdx, 0, repeatCol);
  }

  // Padding rest after if needed
  const newAfter = colIdx + 1;
  if (newAfter < block.columns.length && block.columns[newAfter].type !== 'rest') {
    block.columns.splice(newAfter, 0, {
      position: 0, width: 1,
      notes: [null, null, null, null, null, null], type: 'rest',
    });
  }
  syncStringsFromColumns(block);
  return { colIdx };
}

/**
 * Insert a repeat-end marker (:‖) at the given column index.
 * If inserting at or just before a plain closing bar, replaces it.
 */
export function insertRepeatEnd(block, colIdx) {
  ensureColumns(block);
  block._editCharPos = colIdx < block.columns.length
    ? block.columns[colIdx].position
    : (block.columns.length > 0
      ? block.columns[block.columns.length - 1].position + block.columns[block.columns.length - 1].width
      : 0);

  const repeatCol = {
    position: 0, width: 2,
    notes: [null, null, null, null, null, null], type: 'repeat-end',
  };

  // If the column at colIdx is a plain bar, replace it
  if (colIdx < block.columns.length && block.columns[colIdx].type === 'bar') {
    block.columns.splice(colIdx, 1, repeatCol);
  } else if (colIdx >= block.columns.length && block.columns.length > 0 &&
             block.columns[block.columns.length - 1].type === 'bar') {
    // At end of row — replace the closing bar
    block.columns.splice(block.columns.length - 1, 1, repeatCol);
  } else {
    block.columns.splice(colIdx, 0, repeatCol);
  }

  // Padding rest after if needed
  const newAfter = colIdx + 1;
  if (newAfter < block.columns.length && block.columns[newAfter].type !== 'rest') {
    block.columns.splice(newAfter, 0, {
      position: 0, width: 1,
      notes: [null, null, null, null, null, null], type: 'rest',
    });
  }
  syncStringsFromColumns(block);
  return { colIdx };
}

/**
 * Remove a bar line at the given column index.
 * @param {TabRowBlock} block
 * @param {number} colIdx
 * @returns {{ colIdx: number, type: string }|null}
 */
export function removeBarline(block, colIdx) {
  ensureColumns(block);
  const col = block.columns[colIdx];
  if (!col || (col.type !== 'bar' && col.type !== 'repeat-start' && col.type !== 'repeat-end')) {
    return null;
  }

  block._editCharPos = col.position;
  const savedType = col.type;
  block.columns.splice(colIdx, 1);
  syncStringsFromColumns(block);

  return { colIdx, type: savedType };
}

/**
 * Split a TabRowBlock into two at the given column index.
 * Returns the two new blocks. The original block is not modified.
 * @param {TabRowBlock} block
 * @param {number} colIdx - Split point (this column becomes the first of block 2)
 * @returns {[TabRowBlock, TabRowBlock]}
 */
export function splitTabRow(block, colIdx) {
  ensureColumns(block);

  const cols1 = block.columns.slice(0, colIdx);
  const cols2 = block.columns.slice(colIdx);

  // Calculate character position of split point for pre/postLine splitting
  let splitCharPos = 0;
  if (cols2.length > 0) {
    splitCharPos = cols2[0].position;
  } else if (cols1.length > 0) {
    const lastCol = cols1[cols1.length - 1];
    splitCharPos = lastCol.position + lastCol.width;
  }

  const block1 = createTabRowBlock({
    preLines: block.preLines.map(l => l.substring(0, splitCharPos)),
    strings: columnsToStrings(cols1),
    postLines: block.postLines.map(l => l.substring(0, splitCharPos)),
    rightAnnotations: ['', '', '', '', '', ''],
    labels: [...block.labels],
  });
  block1.columns = parseColumns(block1.strings);

  const block2 = createTabRowBlock({
    preLines: block.preLines.map(l => l.substring(splitCharPos)),
    strings: columnsToStrings(cols2),
    postLines: block.postLines.map(l => l.substring(splitCharPos)),
    rightAnnotations: [...block.rightAnnotations],
    labels: [...block.labels],
  });
  block2.columns = parseColumns(block2.strings);

  return [block1, block2];
}

/**
 * Deep clone a Document (for undo snapshots).
 * @param {Object} doc
 * @returns {Object}
 */
export function cloneDocument(doc) {
  return structuredClone(doc);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Adjust a pre/post line's length when the tab strings change length.
 * Pads with spaces or trims from the end.
 * @param {string} line
 * @param {number} oldLen
 * @param {number} newLen
 * @returns {string}
 */
function adjustLineLength(line, oldLen, newLen) {
  if (newLen > oldLen) {
    // Pad with spaces
    return line + ' '.repeat(newLen - oldLen);
  } else if (newLen < oldLen) {
    // Trim from end, but don't cut into content
    return line.substring(0, Math.max(newLen, line.trimEnd().length));
  }
  return line;
}
