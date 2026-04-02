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
  insertRepeatStart,
  insertRepeatEnd,
  removeBarline,
  splitTabRow,
  syncStringsFromColumns,
  columnsToStrings,
  parseColumns,
  createTextBlock,
  createTabRowBlock,
  DURATION_GAPS,
} from '../model/document.js';
import { renderDocument } from '../model/renderer.js';
import { parseTabText } from '../model/parser.js';

export class BaseTabEditMode {
  constructor(app) {
    this.app = app;
    this.name = ''; // override in subclass
    this._wasChordMode = false; // tracks chord→normal transition
    this._selAnchorCol = null; // selection anchor column index (null = no selection)
  }

  /** Set up clipboard event listeners. Call from subclass activate(). */
  _activateClipboard() {
    this._copyHandler = (e) => this._onCopy(e);
    this._cutHandler = (e) => this._onCut(e);
    this._pasteHandler = (e) => this._onPaste(e);
    document.addEventListener('copy', this._copyHandler);
    document.addEventListener('cut', this._cutHandler);
    document.addEventListener('paste', this._pasteHandler);
  }

  /** Remove clipboard event listeners. Call from subclass deactivate(). */
  _deactivateClipboard() {
    if (this._copyHandler) document.removeEventListener('copy', this._copyHandler);
    if (this._cutHandler) document.removeEventListener('cut', this._cutHandler);
    if (this._pasteHandler) document.removeEventListener('paste', this._pasteHandler);
    this._copyHandler = null;
    this._cutHandler = null;
    this._pasteHandler = null;
    this._clearSelection();
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

    // If at end-of-row and the last column is a closing bar, insert inside the bar.
    // Find the last rest before the closing bar to consume it (preserving leading hyphens).
    // If no rest, insert before the bar directly.
    // Treat cursor at closing bar the same as end-of-row
    const atClosingBar = (colIdx < block.columns.length &&
        block.columns[colIdx].type === 'bar' &&
        colIdx === block.columns.length - 1);
    if ((colIdx >= block.columns.length || atClosingBar) &&
        block.columns.length > 0 &&
        block.columns[block.columns.length - 1].type === 'bar') {
      const barIdx = block.columns.length - 1;
      // Find trailing free rests (after the last note) before the bar
      let lastNoteIdx = barIdx - 1;
      while (lastNoteIdx >= 0 && block.columns[lastNoteIdx].type !== 'note') lastNoteIdx--;
      // Free rests start after the last note's trailing spacing
      // Skip the last note's trailing rests (they're its timing, not free space)
      let freeRestStart = lastNoteIdx + 1;
      if (lastNoteIdx >= 0) {
        // Skip past the last note's gap rests
        const lastNoteGap = duration in DURATION_GAPS ? DURATION_GAPS[duration] : 1;
        freeRestStart = Math.min(lastNoteIdx + 1 + lastNoteGap, barIdx);
      }
      if (freeRestStart < barIdx && block.columns[freeRestStart].type === 'rest') {
        colIdx = freeRestStart; // insert into free rests
      } else {
        colIdx = barIdx; // no free space, insert before bar
      }
    }
    insertNote(block, colIdx, notes, duration);

    // Advance cursor past the inserted note+spacing
    const gap = duration in DURATION_GAPS ? DURATION_GAPS[duration] : 1;
    const insertCount = 1 + gap; // note + gap rest columns
    cursor.columnIndex = this._findColumnAfterInsert(block, colIdx, true, insertCount);
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

  /** Find the column index the cursor should be at after an insert at colIdx.
   *  Uses insertItemCount to know exactly how many columns were inserted. */
  _findColumnAfterInsert(block, colIdx, advance, insertItemCount) {
    if (!advance) {
      // For chord mode: stay on the note (which might have shifted)
      for (let i = colIdx; i < block.columns.length; i++) {
        if (block.columns[i].type === 'note') return i;
      }
      return colIdx;
    }
    // Find the note we just inserted, then advance past it and its trailing spacing
    // The inserted items start somewhere at or after colIdx.
    // Find the note column starting from colIdx
    let idx = colIdx;
    while (idx < block.columns.length && block.columns[idx].type === 'rest') idx++;
    // idx is now at the note. Advance past it + insertItemCount - 1 (the rest cols)
    if (insertItemCount !== undefined) {
      idx += insertItemCount;
    } else {
      // Fallback: skip note + trailing rests
      if (idx < block.columns.length && block.columns[idx].type === 'note') idx++;
      while (idx < block.columns.length && block.columns[idx].type === 'rest') idx++;
    }
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

  _insertRepeatStartAtCursor() {
    const cursor = this.app.cursor;
    const block = this.app.document.blocks[cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return;

    this._pushUndoSnapshot();
    ensureColumns(block);
    // Repeat start always goes at the beginning of the row
    const colIdx = 0;
    insertRepeatStart(block, colIdx);
    // Position cursor just after the repeat-start (on the rest, so next note consumes it)
    cursor.columnIndex = colIdx + 1;
    this._syncCursorCharFromColumn();
    this._refreshAfterEdit();
  }

  _insertRepeatEndAtCursor() {
    const cursor = this.app.cursor;
    const block = this.app.document.blocks[cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return;

    this._pushUndoSnapshot();
    ensureColumns(block);
    // Repeat end always goes at the end of the row (replaces closing bar)
    const colIdx = block.columns.length;
    insertRepeatEnd(block, colIdx);
    cursor.columnIndex = colIdx + 1;
    while (cursor.columnIndex < block.columns.length && block.columns[cursor.columnIndex].type === 'rest') {
      cursor.columnIndex++;
    }
    this._syncCursorCharFromColumn();
    this._refreshAfterEdit();
  }

  // --- Selection ---

  _hasSelection() {
    return this._selAnchorCol !== null;
  }

  _ensureSelAnchor() {
    if (this._selAnchorCol === null) {
      this._selAnchorCol = this.app.cursor.columnIndex;
    }
  }

  _clearSelection() {
    this._selAnchorCol = null;
    this._removeSelectionHighlight();
  }

  /** Get ordered selection range as { startCol, endCol }. */
  _getSelectionRange() {
    if (this._selAnchorCol === null) return null;
    const curCol = this.app.cursor.columnIndex;
    const a = this._selAnchorCol;
    const b = curCol;
    return { startCol: Math.min(a, b), endCol: Math.max(a, b) };
  }

  /** Get the text representation of the selected columns. */
  _getSelectedText() {
    const range = this._getSelectionRange();
    if (!range) return '';
    const block = this.app.document.blocks[this.app.cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return '';
    ensureColumns(block);

    const selectedCols = block.columns.slice(range.startCol, range.endCol);
    if (selectedCols.length === 0) return '';

    // Render just the selected columns as tab text
    const strings = columnsToStrings(selectedCols);
    const lines = [];
    for (let s = 0; s < 6; s++) {
      lines.push(`${block.labels[s]}|${strings[s]}`);
    }
    return lines.join('\n');
  }

  /** Delete the selected columns. */
  _deleteSelection() {
    const range = this._getSelectionRange();
    if (!range) return;
    const block = this.app.document.blocks[this.app.cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return;
    ensureColumns(block);

    this._pushUndoSnapshot();
    block.columns.splice(range.startCol, range.endCol - range.startCol);
    syncStringsFromColumns(block);

    this.app.cursor.columnIndex = range.startCol;
    if (this.app.cursor.columnIndex > block.columns.length) {
      this.app.cursor.columnIndex = block.columns.length;
    }
    this._selAnchorCol = null;
    this._syncCursorCharFromColumn();
    this._refreshAfterEdit();
  }

  /** Paste tab text at cursor position. */
  _pasteTabText(text) {
    const block = this.app.document.blocks[this.app.cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return;

    // Try to parse the pasted text as tab lines
    const lines = text.split('\n');
    // Extract string contents (strip label| prefix)
    const tabContents = [];
    for (const line of lines) {
      const m = line.match(/^[a-gA-G][#b♭♯]?[|‖](.*)/);
      if (m) {
        tabContents.push(m[1]);
      }
    }
    if (tabContents.length !== 6) return; // not valid tab text

    // Parse the pasted content into columns
    const pastedCols = parseColumns(tabContents);
    if (pastedCols.length === 0) return;

    this._pushUndoSnapshot();
    ensureColumns(block);

    if (this._hasSelection()) {
      const range = this._getSelectionRange();
      block.columns.splice(range.startCol, range.endCol - range.startCol, ...pastedCols);
      this.app.cursor.columnIndex = range.startCol + pastedCols.length;
      this._selAnchorCol = null;
    } else {
      const colIdx = Math.min(this.app.cursor.columnIndex, block.columns.length);
      block.columns.splice(colIdx, 0, ...pastedCols);
      this.app.cursor.columnIndex = colIdx + pastedCols.length;
    }

    syncStringsFromColumns(block);
    this._syncCursorCharFromColumn();
    this._refreshAfterEdit();
  }

  _updateSelectionDisplay() {
    this._removeSelectionHighlight();
    const range = this._getSelectionRange();
    if (!range) return;

    const block = this.app.document.blocks[this.app.cursor.blockIndex];
    if (!block || block.type !== 'tabrow' || !block.columns) return;

    const blockEl = this.app.editor.getBlockElement(this.app.cursor.blockIndex);
    if (!blockEl) return;

    // Highlight ALL lines in the block (preLines, tab strings, postLines)
    const allLines = blockEl.querySelectorAll('.line');
    if (allLines.length === 0) return;

    const charWidth = this.app.cursor.charWidth;
    const labelWidth = block.labels[0].length + 1;

    const startPos = range.startCol < block.columns.length
      ? block.columns[range.startCol].position : 0;
    let endPos;
    if (range.endCol < block.columns.length) {
      endPos = block.columns[range.endCol].position;
      // If start == end (single column selected), include the column's width
      if (range.startCol === range.endCol) {
        endPos += block.columns[range.endCol].width;
      }
    } else {
      endPos = block.columns.length > 0
        ? block.columns[block.columns.length - 1].position + block.columns[block.columns.length - 1].width
        : 0;
    }

    const leftPx = (startPos + labelWidth) * charWidth;
    const widthPx = Math.max(1, (endPos - startPos) * charWidth);

    for (const lineEl of allLines) {
      const highlight = document.createElement('div');
      highlight.className = 'tab-selection';
      highlight.style.left = `${leftPx}px`;
      highlight.style.width = `${widthPx}px`;
      highlight.style.top = '0';
      highlight.style.height = '100%';
      lineEl.style.position = 'relative';
      lineEl.appendChild(highlight);
    }
  }

  _removeSelectionHighlight() {
    const container = this.app.editor?.containerEl;
    if (container) {
      container.querySelectorAll('.tab-selection').forEach(el => el.remove());
    }
  }

  // --- Clipboard events ---

  _onCopy(e) {
    const text = this._getSelectedText();
    if (!text) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', text);
  }

  _onCut(e) {
    const text = this._getSelectedText();
    if (!text) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', text);
    this._deleteSelection();
  }

  _onPaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    this._pasteTabText(text);
  }

  /** Handle paste from keyboard (Cmd+V). Uses async clipboard API. */
  async _handlePasteFromKeyboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) this._pasteTabText(text);
    } catch (e) {
      // Clipboard API not available
    }
  }

  // --- Cursor movement ---

  _moveCursorLeft(extending = false) {
    if (extending) this._ensureSelAnchor();
    else if (this._hasSelection()) this._clearSelection();

    const cursor = this.app.cursor;
    const block = this.app.document.blocks[cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return;
    ensureColumns(block);

    if (cursor.columnIndex > 0) {
      cursor.columnIndex--;
      this._syncCursorCharFromColumn();
    }
    this._wasChordMode = false;
    if (extending) this._updateSelectionDisplay();
    this.app.updateCursor();
  }

  _moveCursorRight(extending = false) {
    if (extending) this._ensureSelAnchor();
    else if (this._hasSelection()) this._clearSelection();

    const cursor = this.app.cursor;
    const block = this.app.document.blocks[cursor.blockIndex];
    if (!block || block.type !== 'tabrow') return;
    ensureColumns(block);

    if (cursor.columnIndex < block.columns.length) {
      cursor.columnIndex++;
      this._syncCursorCharFromColumn();
    }
    this._wasChordMode = false;
    if (extending) this._updateSelectionDisplay();
    this.app.updateCursor();
  }

  // --- Deletion ---

  _deleteAtCursor(isBackspace) {
    // If there's a selection, delete it regardless of backspace/delete
    if (this._hasSelection()) {
      this._deleteSelection();
      return;
    }

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
    // Delete the single column immediately left of cursor
    if (cursor.columnIndex <= 0) return;

    this._pushUndoSnapshot();
    const targetIdx = cursor.columnIndex - 1;
    block.columns.splice(targetIdx, 1);
    syncStringsFromColumns(block);
    cursor.columnIndex = targetIdx;

    if (cursor.columnIndex > block.columns.length) {
      cursor.columnIndex = block.columns.length;
    }
    this._syncCursorCharFromColumn();
    this._refreshAfterEdit();
  }

  _handleDelete(block, cursor, doc) {
    // Delete the single column at cursor position
    if (cursor.columnIndex >= block.columns.length) {
      // At end of row — try combining with next row
      this._combineWithNextRow();
      return;
    }

    this._pushUndoSnapshot();
    block.columns.splice(cursor.columnIndex, 1);
    syncStringsFromColumns(block);

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

    // Ensure block1 ends with a closing delimiter (bar, repeat-end, or repeat-start).
    // Strip trailing plain bars (and rests between bars), but keep repeat markers and note spacing.
    ensureColumns(block1);
    while (block1.columns.length > 0) {
      const last = block1.columns[block1.columns.length - 1];
      if (last.type === 'bar') {
        block1.columns.pop();
      } else if (last.type === 'rest') {
        const prev = block1.columns.length >= 2 ? block1.columns[block1.columns.length - 2] : null;
        if (prev && prev.type === 'bar') {
          block1.columns.pop();
        } else {
          break;
        }
      } else {
        break;
      }
    }
    // Add a closing bar only if block1 doesn't already end with a bar-like delimiter
    const lastCol1 = block1.columns.length > 0 ? block1.columns[block1.columns.length - 1] : null;
    if (!lastCol1 || (lastCol1.type !== 'bar' && lastCol1.type !== 'repeat-end' && lastCol1.type !== 'repeat-start')) {
      insertBarline(block1, block1.columns.length);
    }
    syncStringsFromColumns(block1);

    // Do NOT add an opening bar to block2 — the renderer prepends "label|"
    // which visually serves as the opening delimiter.
    // But DO ensure a leading padding rest (width 3, matching initial doc's "---|")
    // so the first note insertion preserves a leading hyphen.
    ensureColumns(block2);
    // Ensure at least 3 leading rest columns (matching initial doc's "---|")
    let leadingRests = 0;
    while (leadingRests < block2.columns.length && block2.columns[leadingRests].type === 'rest') {
      leadingRests++;
    }
    const LEADING_REST_COUNT = 3;
    for (let i = leadingRests; i < LEADING_REST_COUNT; i++) {
      block2.columns.splice(i, 0, {
        position: 0, width: 1,
        notes: [null, null, null, null, null, null], type: 'rest',
      });
    }
    syncStringsFromColumns(block2);

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
