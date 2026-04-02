/**
 * Fingerpick Edit mode: chord-based entry with chord table and string selector.
 * Extends BaseTabEditMode for shared editing logic.
 */

import { BaseTabEditMode } from './mode-base-tab.js';

export class FingerpickEditMode extends BaseTabEditMode {
  constructor(app) {
    super(app);
    this.name = 'fingerpick';
  }

  activate() {
    document.querySelectorAll('.mode-dependent').forEach(el => {
      el.classList.remove('disabled-mode');
    });
    document.querySelectorAll('.panel-content').forEach(el => el.classList.add('d-none'));
    document.getElementById('panel-fingerpick')?.classList.remove('d-none');

    if (this.app.fingerpickPanel) {
      this.app.fingerpickPanel.build();
    }

    // Listen for keydown on the whole document so chord keys (A-G) and
    // string keys (1-6) work even when focus is on the panel, not the editor.
    this._docKeyHandler = (event) => this._onDocKeyDown(event);
    document.addEventListener('keydown', this._docKeyHandler);

    this.app.ensureCursorOnTabRow();
    this.app.editor.renderAll();
    this.app.updateCursor();
    this._activateClipboard();
  }

  deactivate() {
    if (this._docKeyHandler) {
      document.removeEventListener('keydown', this._docKeyHandler);
      this._docKeyHandler = null;
    }
    this._deactivateClipboard();
    return true;
  }

  /**
   * Document-level keydown handler for when focus is outside #tab-editor
   * (e.g., on the panel after clicking a chord cell).
   */
  _onDocKeyDown(event) {
    // Only act if the editor does NOT have focus (otherwise handleKeyDown handles it)
    const editorEl = document.getElementById('tab-editor');
    if (editorEl && editorEl.contains(document.activeElement)) return;

    // Don't intercept if focus is in a text input (e.g., custom chord input, time sig)
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // A-G: chord search
    if (/^[a-gA-G]$/.test(event.key) && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      if (this.app.fingerpickPanel) {
        this.app.fingerpickPanel.showChordSearch(event.key);
      }
      return;
    }

    // 1-6: string selection
    if (/^[1-6]$/.test(event.key) && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      if (this.app.fingerpickPanel) {
        this.app.fingerpickPanel.onStringKey(parseInt(event.key, 10));
      }
      return;
    }
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
      case 'ArrowLeft': event.preventDefault(); this._moveCursorLeft(event.shiftKey); break;
      case 'ArrowRight': event.preventDefault(); this._moveCursorRight(event.shiftKey); break;
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
      case '1': case '2': case '3': case '4': case '5': case '6':
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          if (this.app.fingerpickPanel) {
            this.app.fingerpickPanel.onStringKey(parseInt(event.key, 10));
          }
        }
        break;
      default:
        // A-G (case insensitive): open chord search dialog
        if (/^[a-gA-G]$/.test(event.key) && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          if (this.app.fingerpickPanel) {
            this.app.fingerpickPanel.showChordSearch(event.key);
          }
        }
        break;
    }
  }
}
