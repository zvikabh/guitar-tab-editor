/**
 * Note Edit mode: note-by-note editing with guitar fretboard panel.
 * Extends BaseTabEditMode for shared editing logic.
 */

import { BaseTabEditMode } from './mode-base-tab.js';
import { ensureColumns } from '../model/document.js';

export class NoteEditMode extends BaseTabEditMode {
  constructor(app) {
    super(app);
    this.name = 'note';
    this._fretAccum = '';
    this._fretTimer = null;
  }

  activate() {
    document.querySelectorAll('.mode-dependent').forEach(el => {
      el.classList.remove('disabled-mode');
    });
    document.querySelectorAll('.panel-content').forEach(el => el.classList.add('d-none'));
    document.getElementById('panel-note')?.classList.remove('d-none');

    if (this.app.notePanel) {
      this.app.notePanel.build();
    }

    this.app.ensureCursorOnTabRow();
    this.app.editor.renderAll();
    this.app.updateCursor();
    this._updateFretboardHighlight();
    this._activateClipboard();
  }

  deactivate() {
    this._clearFretAccum();
    this._deactivateClipboard();
    return true;
  }

  handleKeyDown(event) {
    const cursor = this.app.cursor;
    const doc = this.app.document;
    if (!doc) return;

    const block = doc.blocks[cursor.blockIndex];

    if (!block || block.type !== 'tabrow') {
      this._handleTextNavigation(event);
      return;
    }

    switch (event.key) {
      case 'ArrowLeft': event.preventDefault(); this._moveCursorLeft(event.shiftKey); this._updateFretboardHighlight(); break;
      case 'ArrowRight': event.preventDefault(); this._moveCursorRight(event.shiftKey); this._updateFretboardHighlight(); break;
      case 'ArrowUp':
        event.preventDefault();
        if (cursor.stringIndex > 0) { cursor.stringIndex--; this.app.updateCursor(); }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (cursor.stringIndex < 5) { cursor.stringIndex++; this.app.updateCursor(); }
        break;
      case 'Backspace': event.preventDefault(); this._deleteAtCursor(true); break;
      case 'Delete': event.preventDefault(); this._deleteAtCursor(false); break;
      case ' ': event.preventDefault(); this._insertRest(); break;
      case 'Enter': event.preventDefault(); this._splitRow(); break;
      default:
        if (/^[0-9]$/.test(event.key) && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          this._handleFretDigit(event.key);
        }
        break;
    }
  }

  // Override _refreshAfterEdit to also update fretboard highlight
  _refreshAfterEdit() {
    super._refreshAfterEdit();
    this._updateFretboardHighlight();
  }

  // --- Fret digit accumulator for keyboard entry ---

  _handleFretDigit(digit) {
    this._fretAccum += digit;
    if (this._fretTimer) clearTimeout(this._fretTimer);
    this._fretTimer = setTimeout(() => this._commitFretAccum(), 500);

    if (parseInt(this._fretAccum, 10) > 24) {
      const toCommit = this._fretAccum.slice(0, -1);
      const remainder = this._fretAccum.slice(-1);
      this._fretAccum = toCommit;
      this._commitFretAccum();
      this._fretAccum = remainder;
      this._fretTimer = setTimeout(() => this._commitFretAccum(), 500);
    }
  }

  _commitFretAccum() {
    if (this._fretTimer) { clearTimeout(this._fretTimer); this._fretTimer = null; }
    if (!this._fretAccum) return;
    const fret = parseInt(this._fretAccum, 10);
    this._fretAccum = '';
    if (fret > 24) return;
    this.insertFret(this.app.cursor.stringIndex, fret);
  }

  _clearFretAccum() {
    this._fretAccum = '';
    if (this._fretTimer) { clearTimeout(this._fretTimer); this._fretTimer = null; }
  }

  // --- Fretboard highlight ---

  _updateFretboardHighlight() {
    if (!this.app.notePanel) return;
    const cursor = this.app.cursor;
    const block = this.app.document?.blocks[cursor.blockIndex];
    if (!block || block.type !== 'tabrow' || !block.columns) {
      this.app.notePanel.highlightNotes(null);
      return;
    }
    if (cursor.columnIndex < block.columns.length) {
      this.app.notePanel.highlightNotes(block.columns[cursor.columnIndex].notes);
    } else {
      this.app.notePanel.highlightNotes(null);
    }
  }
}
