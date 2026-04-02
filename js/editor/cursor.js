/**
 * Cursor management: state, positioning, and rendering.
 */

export class Cursor {
  constructor(editorEl, cursorEl, measureEl) {
    this.editorEl = editorEl;
    this.cursorEl = cursorEl;
    this.measureEl = measureEl;
    // The scroll container is the parent of the editor element
    this.scrollContainer = editorEl.parentElement;

    // Cursor state
    this.blockIndex = 0;
    this.lineIndex = 0;
    this.charIndex = 0;
    this.columnIndex = 0;
    this.stringIndex = 0;

    this._charWidth = null;
    this._lineHeight = null;
    this.visible = false;
  }

  measure() {
    const rect = this.measureEl.getBoundingClientRect();
    this._charWidth = rect.width;
    this._lineHeight = rect.height;
  }

  get charWidth() {
    if (this._charWidth === null) this.measure();
    return this._charWidth;
  }

  get lineHeight() {
    if (this._lineHeight === null) this.measure();
    return this._lineHeight;
  }

  show() {
    this.visible = true;
    this.cursorEl.classList.add('visible');
  }

  hide() {
    this.visible = false;
    this.cursorEl.classList.remove('visible');
  }

  /**
   * Position the cursor at a specific character within a line element.
   * The cursor element is positioned relative to #editor-container (its offset parent).
   */
  positionAt(lineEl, charIdx, height = 1) {
    if (!lineEl) { this.hide(); return; }

    // Get position of line element relative to the scroll container
    const containerRect = this.scrollContainer.getBoundingClientRect();
    const lineRect = lineEl.getBoundingClientRect();

    const left = lineRect.left - containerRect.left + (charIdx * this.charWidth) + this.scrollContainer.scrollLeft;
    const top = lineRect.top - containerRect.top + this.scrollContainer.scrollTop;

    this.cursorEl.style.left = `${left}px`;
    this.cursorEl.style.top = `${top}px`;
    this.cursorEl.style.height = `${height * this.lineHeight}px`;

    if (height > 1) {
      this.cursorEl.classList.add('tab-cursor');
    } else {
      this.cursorEl.classList.remove('tab-cursor');
    }

    this.show();
    this.cursorEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  positionAtTabRow(blockEl, charIdx) {
    const tabLines = blockEl.querySelectorAll('.line-tab');
    if (tabLines.length === 0) { this.hide(); return; }
    this.positionAt(tabLines[0], charIdx, 6);
  }

  /**
   * Convert a click X position to a character index within a line element.
   */
  clickToCharIndex(lineEl, clickX) {
    const lineRect = lineEl.getBoundingClientRect();
    const relativeX = clickX - lineRect.left;
    return Math.max(0, Math.floor(relativeX / this.charWidth));
  }

  getState() {
    return {
      blockIndex: this.blockIndex,
      lineIndex: this.lineIndex,
      charIndex: this.charIndex,
      columnIndex: this.columnIndex,
      stringIndex: this.stringIndex,
    };
  }

  setState(state) {
    this.blockIndex = state.blockIndex ?? 0;
    this.lineIndex = state.lineIndex ?? 0;
    this.charIndex = state.charIndex ?? 0;
    this.columnIndex = state.columnIndex ?? 0;
    this.stringIndex = state.stringIndex ?? 0;
  }
}
