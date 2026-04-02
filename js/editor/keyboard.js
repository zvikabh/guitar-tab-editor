/**
 * Keyboard event handling: captures keydown on the editor and dispatches
 * to the active editing mode.
 */

import { hasModifier } from '../utils/platform.js';

export class KeyboardHandler {
  /**
   * @param {HTMLElement} editorEl - The #tab-editor element
   * @param {Object} app - The app controller (for accessing mode, undo, etc.)
   */
  constructor(editorEl, app) {
    this.editorEl = editorEl;
    this.app = app;

    // Global shortcuts (save, undo, redo, open) must be on document
    // to intercept browser defaults like Cmd+S
    this._globalHandler = this._onGlobalKeyDown.bind(this);
    document.addEventListener('keydown', this._globalHandler);

    // Mode-specific shortcuts on the editor element
    this._handler = this._onKeyDown.bind(this);
    this.editorEl.addEventListener('keydown', this._handler);
  }

  destroy() {
    document.removeEventListener('keydown', this._globalHandler);
    this.editorEl.removeEventListener('keydown', this._handler);
  }

  /**
   * Global shortcuts: captured on document to intercept browser defaults.
   * Handles Cmd/Ctrl+S, Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Cmd/Ctrl+Y, Cmd/Ctrl+O.
   */
  _onGlobalKeyDown(event) {
    if (!hasModifier(event)) return;

    // Don't intercept if focus is in a text input (e.g., custom chord input)
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Copy/Cut: let native clipboard events handle them
    if (['c', 'x'].includes(event.key)) return;
    // Paste: handle via keydown to prevent double-paste from browser + our handler
    if (event.key === 'v') {
      event.preventDefault();
      const mode = this.app.getActiveMode();
      if (mode && mode._handlePasteFromKeyboard) {
        mode._handlePasteFromKeyboard();
      }
      return;
    }

    // Select All: delegate to mode
    if (event.key === 'a') {
      const mode = this.app.getActiveMode();
      if (mode && mode.handleKeyDown) {
        mode.handleKeyDown(event);
      }
      return;
    }

    if (event.key === 's') {
      event.preventDefault();
      this.app.save();
    } else if (event.key === 'o') {
      event.preventDefault();
      this.app.open();
    } else if (event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.app.undo();
    } else if (event.key === 'Z' || (event.key === 'z' && event.shiftKey)) {
      event.preventDefault();
      this.app.redo();
    } else if (event.key === 'y') {
      event.preventDefault();
      this.app.redo();
    }
  }

  /**
   * Editor-level keydown: delegates to the active mode for mode-specific shortcuts.
   */
  _onKeyDown(event) {
    // Skip if already handled by global handler
    if (hasModifier(event) && ['s', 'o', 'z', 'Z', 'y', 'c', 'v', 'x', 'a'].includes(event.key)) return;

    const mode = this.app.getActiveMode();
    if (mode && mode.handleKeyDown) {
      mode.handleKeyDown(event);
    }
  }
}
