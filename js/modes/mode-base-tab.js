/**
 * Base class for Note Edit and Fingerpick Edit modes.
 * Contains all shared tab editing logic: cursor movement, note insertion/deletion,
 * barlines, rests, row splitting, auto-barlines.
 *
 * Cursor semantics: columnIndex points AT a column. Insert goes AT that position
 * (pushing existing content right). Backspace deletes the meaningful column
 * immediately LEFT of cursor. Delete deletes the meaningful column AT cursor.
 */

import {
  ensureColumns,
  insertNote,
  deleteNote,
  insertBarline,
  removeBarline,
  splitTabRow,
  syncStringsFromColumns,
  createTextBlock,
  DURATION_GAPS,
} from '../model/document.js';

export class BaseTabEditMode {
  constructor(app) {
    this.app = app;
    this.name = ''; // override in subclass
    this._wasChordMode = false; // tracks chord→normal transition
  }

  /** Push an undo snapshot including the current cursor state. */
  _pushUndoSnapshot() {
    this.app.undoManager.pushSnapshot(this.app.document, this.app.cursor.getState());
  }

  // --- Note insertion ---

  insertFret(stringIdx, fret) {
    if (!this.app.ensureCursorOnTabRow()) return;

    const cursor = this.app.cursor;
    const doc = this.app.document;
    const block = doc.blocks[cursor.blockIndex];

    ensureColumns(block);
    const duration = this.app.noteLength;
    const isChordMode = this.app.chordMode;

    const notes = [null, null, null, null, null, null];
    notes[stringIdx] = String(fret);

    // Chord mode: add to existing note column without advancing cursor.
    if (isChordMode) {
      const col = cursor.columnIndex < block.columns.length ? block.columns[cursor.columnIndex] : null;
      if (col && col.type === 'note') {
        // Add to existing note column
        this._pushUndoSnapshot();
        col.notes[stringIdx] = String(fret);
        col.width = Math.max(1, ...col.notes.filter(Boolean).map(n => n.length));
        syncStringsFromColumns(block);
        this._refreshAfterEdit();
        this._wasChordMode = true;
        return;
      }
      // Not on a note — insert new note, don't advance
      this._pushUndoSnapshot();
      let colIdx = Math.min(cursor.columnIndex, block.columns.length);
      // If at end-of-row with closing bar, insert before it
      if (colIdx >= block.columns.length && block.columns.length > 0 &&
          block.columns[block.columns.length - 1].type === 'bar') {
        colIdx = block.columns.length - 1;
      }
      insertNote(block, colIdx, notes, duration);
      cursor.columnIndex = this._findColumnAfterInsert(block, colIdx, false);
      this._syncCursorCharFromColumn();
      this._refreshAfterEdit();
      this._wasChordMode = true;
      return;
    }

    // Normal mode: insert at cursor position and advance.
    this._pushUndoSnapshot();
    let colIdx = Math.min(cursor.columnIndex, block.columns.length);

    // If we just exited chord mode and cursor is sitting on the chord note,
    // advance past it first so the new note goes AFTER the chord.
    if (this._wasChordMode && colIdx < block.columns.length && block.columns[colIdx].type === 'note') {
      colIdx = this._skipPastNoteAndRest(block, colIdx);
    }
    this._wasChordMode = false;

    colIdx = Math.min(colIdx, block.columns.length);

    // If at end-of-row and the last column is a closing bar, insert before it.
    // The closing | is aesthetic — treat it like "end of content".
    // Target the bar column itself so the note is spliced before it (no rest consumption).
    if (colIdx >= block.columns.length && block.columns.length > 0 &&
        block.columns[block.columns.length - 1].type === 'bar') {
      colIdx = block.columns.length - 1;
    }
    insertNote(block, colIdx, notes, duration);

    // Advance cursor past the inserted note+spacing
    cursor.columnIndex = this._findColumnAfterInsert(block, colIdx, true);
    this._syncCursorCharFromColumn();
    this._refreshAfterEdit();
    this._checkAutoBarline();
  }

  /** Clean up trailing bar-rest-bar (|-|) pattern if no notes after the first bar. */
  _cleanupTrailingBars() {
    const block = this.app.document.blocks[this.app.cursor.blockIndex];
    if (!block || block.type !== 'tabrow' || !block.columns) return;

    const len = block.columns.length;
    if (len >= 3 &&
        block.columns[len - 1].type === 'bar' &&
        block.columns[len - 2].type === 'rest' &&
        block.columns[len - 3].type === 'bar') {
      block.columns.splice(len - 2, 2);
      syncStringsFromColumns(block);
      // Clamp cursor
      if (this.app.cursor.columnIndex >= block.columns.length) {
        this.app.cursor.columnIndex = block.columns.length;
      }
      this._syncCursorCharFromColumn();
      this.app.renderBlock(this.app.cursor.blockIndex);
      this.app.updateCursor();
    }
  }

  /** Find the column index the cursor should be at after an insert at colIdx. */
  _findColumnAfterInsert(block, colIdx, advance) {
    if (!advance) {
      // For chord mode: stay on the note (which might have shifted)
      // The note is at colIdx or colIdx+1 (if rest was kept before it)
      for (let i = colIdx; i < block.columns.length; i++) {
        if (block.columns[i].type === 'note') return i;
      }
      return colIdx;
    }
    // Advance: skip past the inserted note and its trailing rest
    let idx = colIdx;
    // Skip the note
    if (idx < block.columns.length && block.columns[idx].type === 'rest') idx++; // leading rest from insert-into-rest
    if (idx < block.columns.length && block.columns[idx].type === 'note') idx++;
    // Skip trailing rest
    if (idx < block.columns.length && block.columns[idx].type === 'rest') idx++;
    return Math.min(idx, block.columns.length);
  }

  /** Skip past a note column and its trailing rest. Returns new index. */
  _skipPastNoteAndRest(block, idx) {
    if (idx < block.columns.length && block.columns[idx].type === 'note') idx++;
    while (idx < block.columns.length && block.columns[idx].type === 'rest') idx++;
    return idx;
  }

  // --- Auto-barline ---

  _countBeatsInCurrentBar(block, cursorColIdx) {
    const beatValue = this.app.timeSigBeatValue || 4;
    const beatUnit = 4 / beatValue;
    const durationMap = { '1/16': 0.25, '1/8': 0.5, '1/4': 1, '1/2': 2 };
    const noteDuration = durationMap[this.app.noteLength] || 0.5;
    const noteBeats = noteDuration / beatUnit;

    let totalBeats = 0;
    let startIdx = Math.min(cursorColIdx, block.columns.length) - 1;

    // If starting on the closing bar (last column), skip it — it's aesthetic, not a real barline
    if (startIdx >= 0 && startIdx === block.columns.length - 1 &&
        block.columns[startIdx].type === 'bar') {
      startIdx--;
    }

    for (let i = startIdx; i >= 0; i--) {
      const col = block.columns[i];
      if (col.type === 'bar' || col.type === 'repeat-start' || col.type === 'repeat-end') break;
      if (col.type === 'note') totalBeats += noteBeats;
    }
    return totalBeats;
  }

  _checkAutoBarline() {
    if (!this.app.timeSigEnabled) return;

    const cursor = this.app.cursor;
    const block = this.app.document.blocks[cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return;
    ensureColumns(block);

    const beats = this.app.timeSigBeats;
    const currentBeats = this._countBeatsInCurrentBar(block, cursor.columnIndex);

    if (currentBeats >= beats) {
      // Insert an internal barline. The cursor is near the end (at or past the closing bar).
      // We need to find where the notes end and insert the bar there.
      // Strategy: walk backward from the end, skipping the closing bar and its padding,
      // to find where content actually ends.
      let colIdx;
      const lastCol = block.columns[block.columns.length - 1];
      if (lastCol && lastCol.type === 'bar') {
        // Skip the closing bar
        colIdx = block.columns.length - 1;
      } else {
        colIdx = block.columns.length;
      }
      insertBarline(block, colIdx);

      // Skip past bar + its padding rest
      cursor.columnIndex = colIdx + 1;
      while (cursor.columnIndex < block.columns.length && block.columns[cursor.columnIndex].type === 'rest') {
        cursor.columnIndex++;
      }
      if (cursor.columnIndex > block.columns.length) cursor.columnIndex = block.columns.length;
      this._syncCursorCharFromColumn();
      this.app.renderBlock(cursor.blockIndex);
      this.app.updateCursor();
    }
  }

  _insertBarAtCursor() {
    const cursor = this.app.cursor;
    const block = this.app.document.blocks[cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return;

    this._pushUndoSnapshot();
    ensureColumns(block);
    const colIdx = Math.min(cursor.columnIndex, block.columns.length);
    insertBarline(block, colIdx);
    // Skip past bar + padding rest
    cursor.columnIndex = colIdx + 1;
    while (cursor.columnIndex < block.columns.length && block.columns[cursor.columnIndex].type === 'rest') {
      cursor.columnIndex++;
    }
    this._syncCursorCharFromColumn();
    this._refreshAfterEdit();
  }

  // --- Cursor movement ---

  _moveCursorLeft() {
    const cursor = this.app.cursor;
    const block = this.app.document.blocks[cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return;
    ensureColumns(block);

    let idx = cursor.columnIndex - 1;
    while (idx >= 0 && block.columns[idx].type === 'rest') idx--;
    if (idx >= 0) {
      cursor.columnIndex = idx;
      this._syncCursorCharFromColumn();
    }
    this._wasChordMode = false;
    this.app.updateCursor();
  }

  _moveCursorRight() {
    const cursor = this.app.cursor;
    const block = this.app.document.blocks[cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return;
    ensureColumns(block);

    let idx = cursor.columnIndex + 1;
    while (idx < block.columns.length && block.columns[idx].type === 'rest') idx++;
    if (idx <= block.columns.length) { // allow moving to end-of-row (columns.length)
      cursor.columnIndex = idx;
      this._syncCursorCharFromColumn();
    }
    this._wasChordMode = false;
    this.app.updateCursor();
  }

  // --- Deletion ---

  _deleteAtCursor(isBackspace) {
    const cursor = this.app.cursor;
    const doc = this.app.document;
    const block = doc.blocks[cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return;
    ensureColumns(block);

    if (isBackspace) {
      this._handleBackspace(block, cursor, doc);
    } else {
      this._handleDelete(block, cursor, doc);
    }
  }

  _handleBackspace(block, cursor, doc) {
    // Find the meaningful column immediately LEFT of cursor (skip rests)
    let targetIdx = cursor.columnIndex - 1;
    while (targetIdx >= 0 && block.columns[targetIdx].type === 'rest') targetIdx--;
    if (targetIdx < 0) return;

    const targetCol = block.columns[targetIdx];

    if (targetCol.type === 'bar' || targetCol.type === 'repeat-start' || targetCol.type === 'repeat-end') {
      // Delete the barline
      this._pushUndoSnapshot();
      removeBarline(block, targetIdx);
      cursor.columnIndex = targetIdx;
    } else if (targetCol.type === 'note') {
      // Delete the note and its adjacent spacing
      this._pushUndoSnapshot();
      deleteNote(block, targetIdx);
      // Move cursor to where the deleted note was
      cursor.columnIndex = targetIdx;
    } else {
      return;
    }

    // Clamp cursor — allow end-of-row (columns.length) but not beyond
    if (cursor.columnIndex > block.columns.length) {
      cursor.columnIndex = block.columns.length;
    }
    this._syncCursorCharFromColumn();
    this._refreshAfterEdit();
  }

  _handleDelete(block, cursor, doc) {
    // Find the meaningful column AT or RIGHT of cursor (skip rests)
    let targetIdx = cursor.columnIndex;
    while (targetIdx < block.columns.length && block.columns[targetIdx].type === 'rest') targetIdx++;

    if (targetIdx >= block.columns.length) {
      // At end of row — try combining with next row
      this._combineWithNextRow();
      return;
    }

    const targetCol = block.columns[targetIdx];

    if (targetCol.type === 'bar' || targetCol.type === 'repeat-start' || targetCol.type === 'repeat-end') {
      // Delete the barline
      this._pushUndoSnapshot();
      removeBarline(block, targetIdx);
    } else if (targetCol.type === 'note') {
      // Delete the note and its adjacent spacing
      this._pushUndoSnapshot();
      deleteNote(block, targetIdx);
    } else {
      return;
    }

    if (cursor.columnIndex > block.columns.length) {
      cursor.columnIndex = block.columns.length;
    }
    this._syncCursorCharFromColumn();
    this._refreshAfterEdit();
  }

  _combineWithNextRow() {
    const cursor = this.app.cursor;
    const doc = this.app.document;

    let nextIdx = cursor.blockIndex + 1;
    while (nextIdx < doc.blocks.length && doc.blocks[nextIdx].type !== 'tabrow') nextIdx++;
    if (nextIdx >= doc.blocks.length) return;

    const block1 = doc.blocks[cursor.blockIndex];
    const block2 = doc.blocks[nextIdx];

    this._pushUndoSnapshot();

    ensureColumns(block1);
    ensureColumns(block2);

    // Remove block1's trailing bar and block2's leading bar
    if (block1.columns.length > 0 && block1.columns[block1.columns.length - 1].type === 'bar') {
      block1.columns.pop();
    }
    if (block2.columns.length > 0 && block2.columns[0].type === 'bar') {
      block2.columns.shift();
    }

    // Add a bar between them
    block1.columns.push({
      position: 0, width: 1,
      notes: [null, null, null, null, null, null], type: 'bar',
    });
    block1.columns.push(...block2.columns);
    syncStringsFromColumns(block1);

    block1.postLines = [...block1.postLines, ...block2.postLines];

    doc.blocks.splice(cursor.blockIndex + 1, nextIdx - cursor.blockIndex);

    this.app.editor.renderAll();
    this.app.updateCursor();
    this.app.updateUndoRedoButtons();
  }

  // --- Rest insertion ---

  _insertRest() {
    if (!this.app.ensureCursorOnTabRow()) return;
    const cursor = this.app.cursor;
    const block = this.app.document.blocks[cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return;

    const duration = this.app.noteLength;
    const notes = [null, null, null, null, null, null];

    this._pushUndoSnapshot();
    ensureColumns(block);
    const colIdx = Math.min(cursor.columnIndex, block.columns.length);
    insertNote(block, colIdx, notes, duration);

    cursor.columnIndex = this._findColumnAfterInsert(block, colIdx, true);
    this._syncCursorCharFromColumn();
    this._refreshAfterEdit();
    this._checkAutoBarline();
  }

  // --- Row splitting ---

  _splitRow() {
    const cursor = this.app.cursor;
    const doc = this.app.document;
    const block = doc.blocks[cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return;

    ensureColumns(block);
    this._pushUndoSnapshot();

    // If cursor is at a bar, skip the bar so it stays at the end of block1
    // (don't duplicate it as opening bar of block2)
    let splitIdx = cursor.columnIndex;
    if (splitIdx < block.columns.length && block.columns[splitIdx].type === 'bar') {
      splitIdx++; // split AFTER the bar
    }

    const [block1, block2] = splitTabRow(block, splitIdx);

    // Ensure block1 ends with exactly one closing bar.
    // Strip trailing bars (and rests that are between bars), but keep
    // rests that are note spacing (immediately after a note).
    ensureColumns(block1);
    while (block1.columns.length > 0) {
      const last = block1.columns[block1.columns.length - 1];
      if (last.type === 'bar') {
        block1.columns.pop();
      } else if (last.type === 'rest') {
        // Only strip if preceded by a bar (padding rest between bars)
        const prev = block1.columns.length >= 2 ? block1.columns[block1.columns.length - 2] : null;
        if (prev && prev.type === 'bar') {
          block1.columns.pop();
        } else {
          break; // This rest follows a note — keep it
        }
      } else {
        break;
      }
    }
    // Add exactly one closing bar
    insertBarline(block1, block1.columns.length);
    syncStringsFromColumns(block1);

    // Do NOT add an opening bar to block2 — the renderer prepends "label|"
    // which visually serves as the opening delimiter.
    // But DO ensure a leading padding rest (width 3, matching initial doc's "---|")
    // so the first note insertion preserves a leading hyphen.
    ensureColumns(block2);
    if (block2.columns.length === 0 || block2.columns[0].type !== 'rest') {
      block2.columns.splice(0, 0, {
        position: 0, width: 3,
        notes: [null, null, null, null, null, null], type: 'rest',
      });
      syncStringsFromColumns(block2);
    } else if (block2.columns[0].type === 'rest' && block2.columns[0].width < 3) {
      block2.columns[0].width = 3;
      syncStringsFromColumns(block2);
    }

    // Ensure block2 ends with a closing bar
    if (block2.columns.length === 0 || block2.columns[block2.columns.length - 1].type !== 'bar') {
      insertBarline(block2, block2.columns.length);
    }

    doc.blocks.splice(cursor.blockIndex, 1, block1, createTextBlock(['']), block2);
    cursor.blockIndex += 2;
    cursor.columnIndex = 0;
    cursor.charIndex = 0;

    this.app.editor.renderAll();
    this.app.updateCursor();
    this.app.updateUndoRedoButtons();
  }

  // --- Helpers ---

  _syncCursorCharFromColumn() {
    const cursor = this.app.cursor;
    const block = this.app.document.blocks[cursor.blockIndex];
    if (!block || !block.columns || block.columns.length === 0) {
      cursor.charIndex = 0;
      return;
    }
    if (cursor.columnIndex >= block.columns.length) {
      // End of row: position past the last column
      const lastCol = block.columns[block.columns.length - 1];
      cursor.charIndex = lastCol.position + lastCol.width;
    } else {
      cursor.charIndex = block.columns[cursor.columnIndex].position;
    }
  }

  _refreshAfterEdit() {
    this.app.renderBlock(this.app.cursor.blockIndex);
    this.app.updateCursor();
    this.app.updateUndoRedoButtons();
  }

  _handleTextNavigation(event) {
    const cursor = this.app.cursor;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (cursor.blockIndex < this.app.document.blocks.length - 1) {
        cursor.blockIndex++;
        cursor.columnIndex = 0;
        cursor.charIndex = 0;
      }
      this.app.updateCursor();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (cursor.blockIndex > 0) {
        cursor.blockIndex--;
        cursor.columnIndex = 0;
        cursor.charIndex = 0;
      }
      this.app.updateCursor();
    }
  }
}
