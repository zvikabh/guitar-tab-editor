/**
 * Raw Edit mode: standard text editing behavior.
 *
 * On activation, the document is converted to flat text lines.
 * All editing operates on these flat lines.
 * On deactivation, the flat text is re-parsed into a Document.
 */

import { parseTabText } from '../model/parser.js';
import { renderDocument } from '../model/renderer.js';
import { cloneDocument } from '../model/document.js';

export class RawEditMode {
  constructor(app) {
    this.app = app;
    this.name = 'raw';
    /** @type {string[]|null} Flat text lines, only set while mode is active */
    this._lines = null;
    /** @type {Object|null} Snapshot of document before raw editing began */
    this._savedDoc = null;
    /** @type {Array<{lines: string[], lineIndex: number, charIndex: number}>} */
    this._undoStack = [];
    /** @type {Array<{lines: string[], lineIndex: number, charIndex: number}>} */
    this._redoStack = [];
    // Selection: null when no selection, otherwise {lineIndex, charIndex} of anchor
    this._selAnchor = null;
  }

  activate() {
    document.querySelectorAll('.mode-dependent').forEach(el => {
      el.classList.add('disabled-mode');
    });
    document.querySelectorAll('.panel-content').forEach(el => el.classList.add('d-none'));

    // Convert document to flat text lines for editing
    const text = renderDocument(this.app.document);
    this._lines = text.replace(/\n$/, '').split('\n');
    if (this._lines.length === 1 && this._lines[0] === '') {
      // keep one empty line
    }
    this._savedDoc = cloneDocument(this.app.document);
    this._undoStack = [];
    this._redoStack = [];

    // Render flat lines
    this._renderFlatLines();

    // Listen for native clipboard events
    this._copyHandler = (e) => this._onCopy(e);
    this._cutHandler = (e) => this._onCut(e);
    this._pasteHandler = (e) => this._onPaste(e);
    document.addEventListener('copy', this._copyHandler);
    document.addEventListener('cut', this._cutHandler);
    document.addEventListener('paste', this._pasteHandler);

    // Reset cursor to start
    this.app.cursor.blockIndex = 0;
    this.app.cursor.lineIndex = 0;
    this.app.cursor.charIndex = Math.min(this.app.cursor.charIndex, (this._lines[0] || '').length);
    this._updateCursorDisplay();
  }

  deactivate() {
    // Remove clipboard event listeners
    if (this._copyHandler) document.removeEventListener('copy', this._copyHandler);
    if (this._cutHandler) document.removeEventListener('cut', this._cutHandler);
    if (this._pasteHandler) document.removeEventListener('paste', this._pasteHandler);
    this._copyHandler = null;
    this._cutHandler = null;
    this._pasteHandler = null;

    if (!this._lines) return true;

    const text = this._lines.join('\n') + '\n';
    try {
      const newDoc = parseTabText(text);
      // Validate: check that tab rows have consistent string lengths
      for (const block of newDoc.blocks) {
        if (block.type === 'tabrow') {
          const lengths = block.strings.map(s => s.length);
          const maxLen = Math.max(...lengths);
          const minLen = Math.min(...lengths);
          if (maxLen !== minLen) {
            this._showErrorBanner(`Tab row has inconsistent string lengths (${minLen} to ${maxLen} chars). Fix the text or revert.`);
            return false;
          }
        }
      }
      this.app.undoManager.pushSnapshot(this._savedDoc);
      this.app.setDocument(newDoc);
      this._lines = null;
      this._savedDoc = null;
      this._removeErrorBanner();
      return true;
    } catch (e) {
      this._showErrorBanner(`Parse error: ${e.message}`);
      return false;
    }
  }

  handleKeyDown(event) {
    if (!this._lines) return;

    const cursor = this.app.cursor;
    const line = this._lines[cursor.lineIndex] || '';
    const isMod = event.ctrlKey || event.metaKey;

    // Copy/Cut/Paste are handled by native clipboard events (_onCopy, _onCut, _onPaste).
    // Let them pass through to the browser.
    if (isMod && ['c', 'v', 'x'].includes(event.key)) {
      return; // don't preventDefault — let native clipboard events fire
    }

    // Select All
    if (isMod && event.key === 'a') {
      event.preventDefault();
      this._selectAll();
      return;
    }

    // For arrow keys: shift extends selection, no shift clears it
    const extending = event.shiftKey;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        if (extending) this._ensureSelAnchor();
        else if (this._hasSelection()) { this._clearSelection(); }
        if (cursor.charIndex > 0) {
          cursor.charIndex--;
        } else if (cursor.lineIndex > 0) {
          cursor.lineIndex--;
          cursor.charIndex = this._lines[cursor.lineIndex].length;
        }
        if (extending) this._updateSelectionDisplay();
        else this._updateCursorDisplay();
        break;

      case 'ArrowRight':
        event.preventDefault();
        if (extending) this._ensureSelAnchor();
        else if (this._hasSelection()) { this._clearSelection(); }
        if (cursor.charIndex < line.length) {
          cursor.charIndex++;
        } else if (cursor.lineIndex < this._lines.length - 1) {
          cursor.lineIndex++;
          cursor.charIndex = 0;
        }
        if (extending) this._updateSelectionDisplay();
        else this._updateCursorDisplay();
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (extending) this._ensureSelAnchor();
        else if (this._hasSelection()) { this._clearSelection(); }
        if (cursor.lineIndex > 0) {
          cursor.lineIndex--;
          cursor.charIndex = Math.min(cursor.charIndex, this._lines[cursor.lineIndex].length);
        }
        if (extending) this._updateSelectionDisplay();
        else this._updateCursorDisplay();
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (extending) this._ensureSelAnchor();
        else if (this._hasSelection()) { this._clearSelection(); }
        if (cursor.lineIndex < this._lines.length - 1) {
          cursor.lineIndex++;
          cursor.charIndex = Math.min(cursor.charIndex, this._lines[cursor.lineIndex].length);
        }
        if (extending) this._updateSelectionDisplay();
        else this._updateCursorDisplay();
        break;

      case 'Home':
        event.preventDefault();
        if (extending) this._ensureSelAnchor();
        else if (this._hasSelection()) { this._clearSelection(); }
        cursor.charIndex = 0;
        if (extending) this._updateSelectionDisplay();
        else this._updateCursorDisplay();
        break;

      case 'End':
        event.preventDefault();
        if (extending) this._ensureSelAnchor();
        else if (this._hasSelection()) { this._clearSelection(); }
        cursor.charIndex = line.length;
        if (extending) this._updateSelectionDisplay();
        else this._updateCursorDisplay();
        break;

      case 'Backspace':
        event.preventDefault();
        if (this._hasSelection()) { this._deleteSelection(); }
        else { this._backspace(); }
        break;

      case 'Delete':
        event.preventDefault();
        if (this._hasSelection()) { this._deleteSelection(); }
        else { this._delete(); }
        break;

      case 'Enter':
        event.preventDefault();
        if (this._hasSelection()) { this._deleteSelection(); }
        this._insertNewline();
        break;

      case 'Escape':
        event.preventDefault();
        if (this._hasSelection()) {
          this._clearSelection();
        } else if (this.app._previousModeName) {
          this.app.returnFromRawMode();
        }
        break;

      default:
        if (event.key.length === 1 && !isMod) {
          event.preventDefault();
          if (this._hasSelection()) { this._deleteSelection(); }
          this._insertChar(event.key);
        }
        break;
    }
  }

  // --- Undo/redo for raw mode text editing ---

  _pushUndo() {
    const cursor = this.app.cursor;
    this._undoStack.push({
      lines: [...this._lines],
      lineIndex: cursor.lineIndex,
      charIndex: cursor.charIndex,
    });
    this._redoStack = [];
    // Cap at 200 entries
    if (this._undoStack.length > 200) this._undoStack.shift();
    this.app._dirty = true;
  }

  undo() {
    if (!this._lines || this._undoStack.length === 0) return;
    const cursor = this.app.cursor;
    // Save current state to redo
    this._redoStack.push({
      lines: [...this._lines],
      lineIndex: cursor.lineIndex,
      charIndex: cursor.charIndex,
    });
    const state = this._undoStack.pop();
    this._lines = state.lines;
    cursor.lineIndex = state.lineIndex;
    cursor.charIndex = state.charIndex;
    this._renderFlatLines();
    this._updateCursorDisplay();
  }

  redo() {
    if (!this._lines || this._redoStack.length === 0) return;
    const cursor = this.app.cursor;
    this._undoStack.push({
      lines: [...this._lines],
      lineIndex: cursor.lineIndex,
      charIndex: cursor.charIndex,
    });
    const state = this._redoStack.pop();
    this._lines = state.lines;
    cursor.lineIndex = state.lineIndex;
    cursor.charIndex = state.charIndex;
    this._renderFlatLines();
    this._updateCursorDisplay();
  }

  // --- Selection ---

  _hasSelection() {
    return this._selAnchor !== null;
  }

  _ensureSelAnchor() {
    if (!this._selAnchor) {
      const cursor = this.app.cursor;
      this._selAnchor = { lineIndex: cursor.lineIndex, charIndex: cursor.charIndex };
    }
  }

  _clearSelection() {
    this._selAnchor = null;
    this._removeSelectionHighlight();
    this._updateCursorDisplay();
  }

  /** Get ordered selection range: start and end as {lineIndex, charIndex}. */
  _getSelectionRange() {
    if (!this._selAnchor) return null;
    const cursor = this.app.cursor;
    const a = this._selAnchor;
    const b = { lineIndex: cursor.lineIndex, charIndex: cursor.charIndex };

    if (a.lineIndex < b.lineIndex || (a.lineIndex === b.lineIndex && a.charIndex <= b.charIndex)) {
      return { start: a, end: b };
    }
    return { start: b, end: a };
  }

  /** Get the selected text as a string. */
  _getSelectedText() {
    const range = this._getSelectionRange();
    if (!range) return '';
    const { start, end } = range;

    if (start.lineIndex === end.lineIndex) {
      return this._lines[start.lineIndex].substring(start.charIndex, end.charIndex);
    }

    const parts = [];
    parts.push(this._lines[start.lineIndex].substring(start.charIndex));
    for (let i = start.lineIndex + 1; i < end.lineIndex; i++) {
      parts.push(this._lines[i]);
    }
    parts.push(this._lines[end.lineIndex].substring(0, end.charIndex));
    return parts.join('\n');
  }

  /** Delete the selected text and clear selection. */
  _deleteSelection() {
    const range = this._getSelectionRange();
    if (!range) return;

    this._pushUndo();
    const { start, end } = range;

    if (start.lineIndex === end.lineIndex) {
      const line = this._lines[start.lineIndex];
      this._lines[start.lineIndex] = line.substring(0, start.charIndex) + line.substring(end.charIndex);
    } else {
      const firstPart = this._lines[start.lineIndex].substring(0, start.charIndex);
      const lastPart = this._lines[end.lineIndex].substring(end.charIndex);
      this._lines[start.lineIndex] = firstPart + lastPart;
      this._lines.splice(start.lineIndex + 1, end.lineIndex - start.lineIndex);
    }

    this.app.cursor.lineIndex = start.lineIndex;
    this.app.cursor.charIndex = start.charIndex;
    this._selAnchor = null;
    this._renderFlatLines();
    this._updateCursorDisplay();
  }

  /** Native copy event handler */
  _onCopy(e) {
    if (!this._lines) return;
    const text = this._getSelectedText();
    if (!text) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', text);
  }

  /** Native cut event handler */
  _onCut(e) {
    if (!this._lines) return;
    const text = this._getSelectedText();
    if (!text) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', text);
    this._deleteSelection();
  }

  /** Native paste event handler */
  _onPaste(e) {
    if (!this._lines) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    if (this._hasSelection()) {
      this._deleteSelection();
    }

    this._pushUndo();
    const cursor = this.app.cursor;
    const pasteLines = text.split('\n');

    if (pasteLines.length === 1) {
      const line = this._lines[cursor.lineIndex] || '';
      this._lines[cursor.lineIndex] = line.slice(0, cursor.charIndex) + pasteLines[0] + line.slice(cursor.charIndex);
      cursor.charIndex += pasteLines[0].length;
    } else {
      const line = this._lines[cursor.lineIndex] || '';
      const before = line.slice(0, cursor.charIndex);
      const after = line.slice(cursor.charIndex);

      this._lines[cursor.lineIndex] = before + pasteLines[0];
      const middleLines = pasteLines.slice(1, -1);
      const lastPasteLine = pasteLines[pasteLines.length - 1] + after;
      this._lines.splice(cursor.lineIndex + 1, 0, ...middleLines, lastPasteLine);

      cursor.lineIndex += pasteLines.length - 1;
      cursor.charIndex = pasteLines[pasteLines.length - 1].length;
    }

    this._renderFlatLines();
    this._updateCursorDisplay();
  }

  _selectAll() {
    if (!this._lines || this._lines.length === 0) return;
    this._selAnchor = { lineIndex: 0, charIndex: 0 };
    const lastLine = this._lines.length - 1;
    this.app.cursor.lineIndex = lastLine;
    this.app.cursor.charIndex = this._lines[lastLine].length;
    this._updateSelectionDisplay();
  }

  // --- Selection display ---

  _updateSelectionDisplay() {
    this._removeSelectionHighlight();

    const range = this._getSelectionRange();
    if (!range) { this._updateCursorDisplay(); return; }

    const container = this.app.editor.containerEl;
    const lineEls = container.querySelectorAll('.line-raw');
    const { start, end } = range;
    const charWidth = this.app.cursor.charWidth;

    for (let i = start.lineIndex; i <= end.lineIndex; i++) {
      const lineEl = lineEls[i];
      if (!lineEl) continue;

      const lineLen = (this._lines[i] || '').length;
      const selStart = (i === start.lineIndex) ? start.charIndex : 0;
      const selEnd = (i === end.lineIndex) ? end.charIndex : lineLen;

      if (selStart === selEnd && i !== start.lineIndex && i !== end.lineIndex) {
        // Full line selected (empty line)
      }

      const highlight = document.createElement('div');
      highlight.className = 'raw-selection';
      highlight.style.left = `${selStart * charWidth}px`;
      highlight.style.width = `${Math.max(1, (selEnd - selStart) * charWidth)}px`;
      highlight.style.top = '0';
      highlight.style.height = '100%';
      lineEl.style.position = 'relative';
      lineEl.appendChild(highlight);
    }

    this._updateCursorDisplay();
  }

  _removeSelectionHighlight() {
    const container = this.app.editor.containerEl;
    container.querySelectorAll('.raw-selection').forEach(el => el.remove());
  }

  // --- Editing on flat lines ---

  _insertChar(char) {
    this._pushUndo();
    const cursor = this.app.cursor;
    const line = this._lines[cursor.lineIndex] || '';
    this._lines[cursor.lineIndex] = line.slice(0, cursor.charIndex) + char + line.slice(cursor.charIndex);
    cursor.charIndex++;
    this._renderLine(cursor.lineIndex);
    this._updateCursorDisplay();
  }

  _backspace() {
    const cursor = this.app.cursor;
    if (cursor.charIndex > 0 || cursor.lineIndex > 0) {
      this._pushUndo();
    }
    if (cursor.charIndex > 0) {
      const line = this._lines[cursor.lineIndex];
      this._lines[cursor.lineIndex] = line.slice(0, cursor.charIndex - 1) + line.slice(cursor.charIndex);
      cursor.charIndex--;
      this._renderLine(cursor.lineIndex);
    } else if (cursor.lineIndex > 0) {
      // Join with previous line
      const prevLine = this._lines[cursor.lineIndex - 1];
      const curLine = this._lines[cursor.lineIndex];
      cursor.charIndex = prevLine.length;
      this._lines[cursor.lineIndex - 1] = prevLine + curLine;
      this._lines.splice(cursor.lineIndex, 1);
      cursor.lineIndex--;
      this._renderFlatLines();
    }
    this._updateCursorDisplay();
  }

  _delete() {
    const cursor = this.app.cursor;
    const line = this._lines[cursor.lineIndex];
    if (cursor.charIndex < line.length || cursor.lineIndex < this._lines.length - 1) {
      this._pushUndo();
    }
    if (cursor.charIndex < line.length) {
      this._lines[cursor.lineIndex] = line.slice(0, cursor.charIndex) + line.slice(cursor.charIndex + 1);
      this._renderLine(cursor.lineIndex);
    } else if (cursor.lineIndex < this._lines.length - 1) {
      // Join with next line
      this._lines[cursor.lineIndex] = line + this._lines[cursor.lineIndex + 1];
      this._lines.splice(cursor.lineIndex + 1, 1);
      this._renderFlatLines();
    }
    this._updateCursorDisplay();
  }

  _insertNewline() {
    this._pushUndo();
    const cursor = this.app.cursor;
    const line = this._lines[cursor.lineIndex] || '';
    const before = line.slice(0, cursor.charIndex);
    const after = line.slice(cursor.charIndex);
    this._lines[cursor.lineIndex] = before;
    this._lines.splice(cursor.lineIndex + 1, 0, after);
    cursor.lineIndex++;
    cursor.charIndex = 0;
    this._renderFlatLines();
    this._updateCursorDisplay();
  }

  // --- Rendering flat lines to the editor ---

  _renderFlatLines() {
    const container = this.app.editor.containerEl;
    container.innerHTML = '';
    for (let i = 0; i < this._lines.length; i++) {
      const lineEl = document.createElement('div');
      lineEl.className = 'line line-raw';
      lineEl.dataset.lineIdx = i;
      lineEl.textContent = this._lines[i];
      // Ensure empty lines still take up space
      if (!this._lines[i]) lineEl.innerHTML = '\u200B'; // zero-width space
      container.appendChild(lineEl);
    }
  }

  _renderLine(lineIdx) {
    const container = this.app.editor.containerEl;
    const lineEls = container.querySelectorAll('.line-raw');
    if (lineEls[lineIdx]) {
      const text = this._lines[lineIdx];
      lineEls[lineIdx].textContent = text;
      if (!text) lineEls[lineIdx].innerHTML = '\u200B';
    }
  }

  _updateCursorDisplay() {
    const cursor = this.app.cursor;
    const container = this.app.editor.containerEl;
    const lineEls = container.querySelectorAll('.line-raw');
    const lineEl = lineEls[cursor.lineIndex];
    if (lineEl) {
      cursor.positionAt(lineEl, cursor.charIndex, 1);
    }
  }

  /** Handle clicks in raw mode: set cursor position from click. Shift+click extends selection. */
  handleClick(event) {
    if (!this._lines) return;
    const lineEl = event.target.closest('.line-raw');
    if (!lineEl) return;

    const lineIdx = parseInt(lineEl.dataset.lineIdx, 10);
    if (isNaN(lineIdx)) return;

    const cursor = this.app.cursor;
    const charIdx = Math.min(
      cursor.clickToCharIndex(lineEl, event.clientX),
      (this._lines[lineIdx] || '').length
    );

    if (event.shiftKey) {
      // Extend selection from current cursor to click position
      this._ensureSelAnchor();
      cursor.lineIndex = lineIdx;
      cursor.charIndex = charIdx;
      this._updateSelectionDisplay();
    } else {
      // Normal click: clear selection and move cursor
      this._clearSelection();
      cursor.lineIndex = lineIdx;
      cursor.charIndex = charIdx;
      this._updateCursorDisplay();
    }
  }

  // --- Error banner ---

  _showErrorBanner(message) {
    this._removeErrorBanner();
    const banner = document.createElement('div');
    banner.className = 'parse-error-banner';
    banner.textContent = message + ' ';

    const btnRevert = document.createElement('button');
    btnRevert.className = 'btn btn-sm btn-outline-danger';
    btnRevert.textContent = 'Revert';
    btnRevert.addEventListener('click', () => {
      // Restore saved document
      if (this._savedDoc) {
        this.app.setDocument(cloneDocument(this._savedDoc));
      }
      this._lines = null;
      this._savedDoc = null;
      this._removeErrorBanner();
    });

    const btnContinue = document.createElement('button');
    btnContinue.className = 'btn btn-sm btn-outline-secondary ms-1';
    btnContinue.textContent = 'Continue Editing';
    btnContinue.addEventListener('click', () => {
      this._removeErrorBanner();
    });

    banner.appendChild(btnRevert);
    banner.appendChild(btnContinue);
    this.app.editor.containerEl.parentElement.prepend(banner);
  }

  _removeErrorBanner() {
    const existing = document.querySelector('.parse-error-banner');
    if (existing) existing.remove();
  }
}
