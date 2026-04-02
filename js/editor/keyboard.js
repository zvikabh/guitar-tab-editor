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
    this._handler = this._onKeyDown.bind(this);
    this.editorEl.addEventListener('keydown', this._handler);
  }

  destroy() {
    this.editorEl.removeEventListener('keydown', this._handler);
  }

  _onKeyDown(event) {
    // Global shortcuts (all modes)
    if (hasModifier(event) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.app.undo();
      return;
    }
    if (hasModifier(event) && (event.key === 'Z' || (event.key === 'z' && event.shiftKey))) {
      event.preventDefault();
      this.app.redo();
      return;
    }
    if (hasModifier(event) && event.key === 'y') {
      event.preventDefault();
      this.app.redo();
      return;
    }
    if (hasModifier(event) && event.key === 's') {
      event.preventDefault();
      this.app.save();
      return;
    }
    if (hasModifier(event) && event.key === 'o') {
      event.preventDefault();
      this.app.open();
      return;
    }

    // Delegate to active mode
    const mode = this.app.getActiveMode();
    if (mode && mode.handleKeyDown) {
      mode.handleKeyDown(event);
    }
  }
}
