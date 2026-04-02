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

    // Reset cursor to start
    this.app.cursor.blockIndex = 0;
    this.app.cursor.lineIndex = 0;
    this.app.cursor.charIndex = Math.min(this.app.cursor.charIndex, (this._lines[0] || '').length);
    this._updateCursorDisplay();
  }

  deactivate() {
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

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        if (cursor.charIndex > 0) {
          cursor.charIndex--;
        } else if (cursor.lineIndex > 0) {
          cursor.lineIndex--;
          cursor.charIndex = this._lines[cursor.lineIndex].length;
        }
        this._updateCursorDisplay();
        break;

      case 'ArrowRight':
        event.preventDefault();
        if (cursor.charIndex < line.length) {
          cursor.charIndex++;
        } else if (cursor.lineIndex < this._lines.length - 1) {
          cursor.lineIndex++;
          cursor.charIndex = 0;
        }
        this._updateCursorDisplay();
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (cursor.lineIndex > 0) {
          cursor.lineIndex--;
          cursor.charIndex = Math.min(cursor.charIndex, this._lines[cursor.lineIndex].length);
        }
        this._updateCursorDisplay();
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (cursor.lineIndex < this._lines.length - 1) {
          cursor.lineIndex++;
          cursor.charIndex = Math.min(cursor.charIndex, this._lines[cursor.lineIndex].length);
        }
        this._updateCursorDisplay();
        break;

      case 'Home':
        event.preventDefault();
        cursor.charIndex = 0;
        this._updateCursorDisplay();
        break;

      case 'End':
        event.preventDefault();
        cursor.charIndex = line.length;
        this._updateCursorDisplay();
        break;

      case 'Backspace':
        event.preventDefault();
        this._backspace();
        break;

      case 'Delete':
        event.preventDefault();
        this._delete();
        break;

      case 'Enter':
        event.preventDefault();
        this._insertNewline();
        break;

      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
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

  /** Handle clicks in raw mode: set cursor position from click. */
  handleClick(event) {
    if (!this._lines) return;
    const lineEl = event.target.closest('.line-raw');
    if (!lineEl) return;

    const lineIdx = parseInt(lineEl.dataset.lineIdx, 10);
    if (isNaN(lineIdx)) return;

    const cursor = this.app.cursor;
    cursor.lineIndex = lineIdx;
    cursor.charIndex = cursor.clickToCharIndex(lineEl, event.clientX);
    cursor.charIndex = Math.min(cursor.charIndex, (this._lines[lineIdx] || '').length);
    this._updateCursorDisplay();
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
