/**
 * App entry point: initializes all modules and connects them.
 */

import { parseTabText } from './model/parser.js';
import { renderDocument } from './model/renderer.js';
import { createDocument, createTextBlock, createTabRowBlock, ensureColumns, cloneDocument } from './model/document.js';
import { UndoManager } from './model/undo.js';
import { Editor } from './editor/editor.js';
import { Cursor } from './editor/cursor.js';
import { KeyboardHandler } from './editor/keyboard.js';
import { RawEditMode } from './modes/mode-raw.js';
import { NoteEditMode } from './modes/mode-note.js';
import { FingerpickEditMode } from './modes/mode-fingerpick.js';
import { Toolbar } from './toolbar/toolbar.js';
import { FileIO } from './toolbar/file-io.js';
import { NotePanel } from './panels/panel-note.js';
import { FingerpickPanel } from './panels/panel-fingerpick.js';

class App {
  constructor() {
    this.document = null;
    this.undoManager = new UndoManager();
    this.fileIO = new FileIO();
    this.noteLength = '1/8';
    this.chordMode = false;
    this._dirty = false; // true if edits made since last save

    // DOM elements
    const editorEl = document.getElementById('tab-editor');
    const cursorEl = document.getElementById('cursor');
    const measureEl = document.getElementById('char-measure');

    // Initialize modules
    this.editor = new Editor(editorEl, null);
    this.cursor = new Cursor(editorEl, cursorEl, measureEl);
    this.keyboard = new KeyboardHandler(editorEl, this);
    this.toolbar = new Toolbar(this);

    // Panels
    this.notePanel = new NotePanel(document.getElementById('panel-note'), this);
    this.fingerpickPanel = new FingerpickPanel(document.getElementById('panel-fingerpick'), this);
    this.timeSigEnabled = false;
    this.timeSigBeats = 4;
    this.timeSigBeatValue = 4;

    // Modes
    this.modes = {
      raw: new RawEditMode(this),
      note: new NoteEditMode(this),
      fingerpick: new FingerpickEditMode(this),
    };
    this.activeMode = this.modes.fingerpick;
    this._previousModeName = null; // for returning from raw mode via Escape

    // Mouse handlers for the editor (click and drag selection)
    editorEl.addEventListener('mousedown', (event) => this._onEditorMouseDown(event));
    editorEl.addEventListener('mousemove', (event) => this._onEditorMouseMove(event));
    editorEl.addEventListener('mouseup', (event) => this._onEditorMouseUp(event));

    // Warn before leaving page with unsaved edits
    window.addEventListener('beforeunload', (e) => {
      if (this._dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // Create initial empty document
    this._createNewDocument();

    // Focus the editor
    editorEl.focus();
  }

  getActiveMode() {
    return this.activeMode;
  }

  /**
   * Switch editing mode.
   */
  setMode(modeName) {
    if (this.activeMode && this.activeMode.deactivate) {
      const ok = this.activeMode.deactivate();
      if (!ok) {
        // Revert the radio button
        const capName = this.activeMode.name.charAt(0).toUpperCase() + this.activeMode.name.slice(1);
        const radio = document.getElementById(`mode${capName}`);
        if (radio) radio.checked = true;
        return;
      }
    }

    this.activeMode = this.modes[modeName] || this.modes.raw;
    if (this.activeMode.activate) {
      this.activeMode.activate();
    }

    this.toolbar.updateModeButtons(modeName);

    // Ensure editor has focus for keyboard input
    document.getElementById('tab-editor')?.focus();
  }

  setDocument(doc) {
    this.document = doc;
    // Always keep the editor's document reference in sync
    this.editor.document = doc;
    // Only render blocks if not in raw mode (raw mode renders its own flat lines)
    if (this.activeMode.name !== 'raw') {
      this.editor.renderAll();
      this.updateCursor();
    }
  }

  renderBlock(blockIndex) {
    this.editor.renderBlock(blockIndex);
  }

  /**
   * Update cursor position in the DOM based on current cursor state and mode.
   */
  updateCursor() {
    if (!this.document || this.document.blocks.length === 0) {
      this.cursor.hide();
      return;
    }

    // In raw mode, cursor is handled by mode-raw itself
    if (this.activeMode.name === 'raw') {
      return;
    }

    const blockIndex = Math.min(this.cursor.blockIndex, this.document.blocks.length - 1);
    this.cursor.blockIndex = blockIndex;
    const blockEl = this.editor.getBlockElement(blockIndex);
    if (!blockEl) { this.cursor.hide(); return; }

    const block = this.document.blocks[blockIndex];

    if (block.type === 'text') {
      // Single-line cursor for text blocks
      const allLines = blockEl.querySelectorAll('.line');
      const lineIdx = Math.min(this.cursor.lineIndex, Math.max(0, allLines.length - 1));
      this.cursor.lineIndex = lineIdx;
      const lineEl = allLines[lineIdx];
      if (lineEl) {
        this.cursor.positionAt(lineEl, this.cursor.charIndex, 1);
      }
    } else if (block.type === 'tabrow') {
      // 6-line cursor for tab rows in note/fingerpick mode
      // charIndex is relative to string content; display needs label prefix offset
      const labelWidth = this._labelWidth(block); // e.g., "e|" = 2
      this.cursor.positionAtTabRow(blockEl, this.cursor.charIndex + labelWidth);
    }
  }

  updateUndoRedoButtons() {
    this.toolbar.updateUndoRedoButtons();
    this._dirty = true;
  }

  /**
   * Find the first tabrow block index.
   */
  findFirstTabRowIndex() {
    if (!this.document) return -1;
    return this.document.blocks.findIndex(b => b.type === 'tabrow');
  }

  /**
   * Ensure cursor is on a tabrow block. If not, move it to the first one.
   * Returns true if cursor is now on a tabrow.
   */
  ensureCursorOnTabRow() {
    const block = this.document.blocks[this.cursor.blockIndex];
    if (block && block.type === 'tabrow') return true;

    const idx = this.findFirstTabRowIndex();
    if (idx >= 0) {
      this.cursor.blockIndex = idx;
      this.cursor.columnIndex = 0;
      this.cursor.charIndex = 0;
      return true;
    }
    return false;
  }

  // --- File operations ---

  async open() {
    if (this._dirty) {
      if (!confirm('You have unsaved changes. Open a new file anyway?')) return;
    }
    const result = await this.fileIO.open();
    if (!result) return;

    // If in raw mode, force-exit without re-parsing (we're loading a new file)
    if (this.activeMode.name === 'raw') {
      this.activeMode._lines = null;
      this.activeMode._savedDoc = null;
      this.activeMode._removeErrorBanner();
    }

    const doc = parseTabText(result.text);

    // Check if the file contains any tab rows
    const hasTabRows = doc.blocks.some(b => b.type === 'tabrow');
    if (!hasTabRows) {
      alert(
        `No guitar tab found in "${result.name}".\n\n` +
        'The file was loaded as plain text. Possible reasons:\n' +
        '• The file may not contain guitar tablature\n' +
        '• Tab lines must have 6 consecutive string lines (e|, B|, G|, D|, A|, E|)\n' +
        '• Windows line endings (CRLF) should be handled automatically — if this persists, try converting to Unix (LF) line endings'
      );
    }

    this.undoManager.clear();
    this.document = doc;
    this.editor.document = doc;
    this.cursor.blockIndex = 0;
    this.cursor.lineIndex = 0;
    this.cursor.charIndex = 0;
    this.cursor.columnIndex = 0;

    // Re-activate current mode to re-render properly
    if (this.activeMode.activate) {
      this.activeMode.activate();
    } else {
      this.editor.setDocument(doc);
      this.updateCursor();
    }
    this.updateUndoRedoButtons();
    this._dirty = false;
    document.title = `${result.name} — Guitar Tab Editor`;
  }

  async save() {
    if (!this.document) return;
    const text = renderDocument(this.document);

    // Suggest filename from the first non-empty text line
    let suggestedName = this.fileIO.fileName;
    if (!suggestedName || suggestedName === 'untitled.txt') {
      for (const block of this.document.blocks) {
        if (block.type === 'text') {
          const firstLine = block.lines.find(l => l.trim());
          if (firstLine) {
            // Sanitize: remove characters not suitable for filenames
            suggestedName = firstLine.trim().replace(/[/\\:*?"<>|]/g, '') + '.txt';
            break;
          }
        }
      }
    }

    await this.fileIO.save(text, suggestedName);
    this._dirty = false;
  }

  /**
   * Copy the entire tab to clipboard as rich text (HTML) with colors and bolding
   * matching the editor display.
   */
  async copyAsRichText() {
    if (!this.document) return;

    const fontFamily = "'Source Code Pro', monospace";
    let html = `<pre style="font-family: ${fontFamily}; font-size: 14px; line-height: 1.4;">`;

    for (const block of this.document.blocks) {
      if (block.type === 'text') {
        for (const line of block.lines) {
          if (line.trim()) {
            html += `<span style="color: #333;">${this._escapeHtml(line)}</span>\n`;
          } else {
            html += '\n';
          }
        }
      } else if (block.type === 'tabrow') {
        // Pre-lines (chord names — blue, bold)
        for (const line of block.preLines) {
          html += `<span style="color: #0066cc; font-weight: bold;">${this._escapeHtml(line)}</span>\n`;
        }
        // Tab strings
        for (let s = 0; s < 6; s++) {
          const label = block.labels[s];
          const content = block.strings[s];
          const sep = (content.startsWith('‖:') || content.startsWith(':‖')) ? '' : '|';
          let text = `${label}${sep}${content}`;
          if (block.rightAnnotations[s]) {
            text += ` ${block.rightAnnotations[s]}`;
          }
          html += `<span style="color: #333;">${this._escapeHtml(text)}</span>\n`;
        }
        // Post-lines (lyrics — blue-ish)
        for (const line of block.postLines) {
          html += `<span style="color: #0066ccd0;">${this._escapeHtml(line)}</span>\n`;
        }
      }
    }

    html += '</pre>';

    // Also prepare plain text
    const plainText = renderDocument(this.document);

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ]);
      this._showCopyToast();
    } catch (e) {
      // Fallback: copy plain text
      const textarea = document.createElement('textarea');
      textarea.value = plainText;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    document.getElementById('tab-editor')?.focus();
  }

  _showCopyToast() {
    // Remove any existing toast
    const existing = document.querySelector('.copy-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.textContent = 'Tab copied to clipboard';
    document.body.appendChild(toast);

    // Hide any tooltip on the copy button
    const btn = document.getElementById('btnCopy');
    const tooltip = bootstrap.Tooltip.getInstance(btn);
    if (tooltip) tooltip.hide();

    setTimeout(() => toast.remove(), 2000);
  }

  /** Compute the rendered label prefix width for a tab row block. */
  _labelWidth(block) {
    const content = block.strings[0] || '';
    const hasSep = !(content.startsWith('‖:') || content.startsWith(':‖'));
    return block.labels[0].length + (hasSep ? 1 : 0);
  }

  _escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // --- Undo/Redo ---

  undo() {
    // In raw mode, delegate to the mode's own undo
    if (this.activeMode.name === 'raw' && this.activeMode.undo) {
      this.activeMode.undo();
      return;
    }
    const result = this.undoManager.undo(this.document);
    if (result) {
      if (result.doc !== this.document) {
        this.document = result.doc;
        this.editor.setDocument(result.doc);
      } else {
        this.editor.renderAll();
      }
      if (result.cursorState) {
        this.cursor.setState(result.cursorState);
      }
      this.updateCursor();
      this.updateUndoRedoButtons();
    }
  }

  redo() {
    if (this.activeMode.name === 'raw' && this.activeMode.redo) {
      this.activeMode.redo();
      return;
    }
    const result = this.undoManager.redo(this.document);
    if (result) {
      if (result.doc !== this.document) {
        this.document = result.doc;
        this.editor.setDocument(result.doc);
      } else {
        this.editor.renderAll();
      }
      if (result.cursorState) {
        this.cursor.setState(result.cursorState);
      }
      this.updateCursor();
      this.updateUndoRedoButtons();
    }
  }

  // --- Insert operations ---

  insertBar() {
    if (this.activeMode.name !== 'raw' && this.ensureCursorOnTabRow()) {
      const mode = this.getActiveMode();
      if (mode._insertBarAtCursor) mode._insertBarAtCursor();
    }
    document.getElementById('tab-editor')?.focus();
  }

  insertRepeatStart() {
    if (this.activeMode.name !== 'raw' && this.ensureCursorOnTabRow()) {
      const mode = this.getActiveMode();
      if (mode._insertRepeatStartAtCursor) mode._insertRepeatStartAtCursor();
    }
    document.getElementById('tab-editor')?.focus();
  }

  insertRepeatEnd() {
    if (this.activeMode.name !== 'raw' && this.ensureCursorOnTabRow()) {
      const mode = this.getActiveMode();
      if (mode._insertRepeatEndAtCursor) mode._insertRepeatEndAtCursor();
    }
    document.getElementById('tab-editor')?.focus();
  }

  insertRest() {
    if (this.activeMode.name !== 'raw' && this.ensureCursorOnTabRow()) {
      const mode = this.getActiveMode();
      if (mode._insertRest) mode._insertRest();
    }
    document.getElementById('tab-editor')?.focus();
  }

  toggleChordMode() {
    this.chordMode = !this.chordMode;
    const btn = document.getElementById('btnChord');
    if (btn) btn.classList.toggle('active', this.chordMode);
    document.getElementById('tab-editor')?.focus();
  }

  /**
   * Return from raw mode to the previous mode (triggered by Escape).
   */
  returnFromRawMode() {
    if (this._previousModeName && this.modes[this._previousModeName]) {
      this.setMode(this._previousModeName);
      // Update the radio button
      const capName = this._previousModeName.charAt(0).toUpperCase() + this._previousModeName.slice(1);
      const radio = document.getElementById(`mode${capName}`);
      if (radio) radio.checked = true;
      this._previousModeName = null;
    }
  }

  // --- Private ---

  /**
   * Switch to raw mode for text editing, remembering the current mode.
   * Positions cursor at the click location in the flat text.
   * @param {number} blockIndex - Block that was clicked
   * @param {number} lineInBlock - Line index within the block's DOM rendering
   * @param {number} charIdx - Character index within the line
   */
  _switchToRawForTextEdit(blockIndex, lineInBlock, charIdx) {
    if (this.activeMode.name === 'raw') return;

    // Remember current mode so Escape can return to it
    this._previousModeName = this.activeMode.name;

    // Compute the flat line index BEFORE switching to raw mode.
    // Count lines in all blocks before the clicked block, then add the line offset.
    let flatLine = 0;
    for (let b = 0; b < this.document.blocks.length; b++) {
      const blk = this.document.blocks[b];
      const blockLineCount = this._countBlockLines(blk);
      if (b === blockIndex) {
        flatLine += lineInBlock;
        break;
      }
      flatLine += blockLineCount;
    }

    // Switch to raw mode (this flattens the document into _lines)
    this.setMode('raw');

    const radio = document.getElementById('modeRaw');
    if (radio) radio.checked = true;

    // Position cursor at the computed flat line and character
    if (this.activeMode._lines) {
      const lineIdx = Math.min(flatLine, this.activeMode._lines.length - 1);
      this.cursor.lineIndex = lineIdx;
      this.cursor.charIndex = Math.min(charIdx, (this.activeMode._lines[lineIdx] || '').length);
      this.activeMode._updateCursorDisplay();
    }
  }

  /**
   * Count how many rendered lines a block produces.
   */
  _countBlockLines(block) {
    if (block.type === 'text') {
      return block.lines.length;
    } else if (block.type === 'tabrow') {
      return block.preLines.length + 6 + block.postLines.length;
    }
    return 0;
  }

  _createNewDocument() {
    const emptyTabRow = createTabRowBlock({
      strings: ['---|', '---|', '---|', '---|', '---|', '---|'],
    });

    this.document = createDocument([
      createTextBlock(['']),
      emptyTabRow,
    ]);

    this.editor.setDocument(this.document);
    this.cursor.blockIndex = 0;
    this.cursor.lineIndex = 0;
    this.cursor.charIndex = 0;
    this.cursor.columnIndex = 0;

    // Activate initial mode
    this.activeMode.activate();
  }

  _onEditorMouseDown(event) {
    // In raw mode, delegate to the mode's click handler
    if (this.activeMode.name === 'raw' && this.activeMode.handleClick) {
      this.activeMode.handleClick(event);
      return;
    }

    const target = this.editor.findClickTarget(event);
    if (!target) return;

    this.cursor.blockIndex = target.blockIndex;
    const block = this.document.blocks[target.blockIndex];

    if (block.type === 'text' || target.lineType === 'pre' || target.lineType === 'post') {
      const clickCharIdx = this.cursor.clickToCharIndex(target.lineEl, event.clientX);
      this._switchToRawForTextEdit(target.blockIndex, target.lineIndex, clickCharIdx);
      return;
    } else if (target.lineType === 'tab' && block.type === 'tabrow') {
      // Clicking on a tab line in note/fingerpick mode
      const charIdx = this.cursor.clickToCharIndex(target.lineEl, event.clientX);
      const labelWidth = this._labelWidth(block);
      const contentCharIdx = Math.max(0, charIdx - labelWidth);

      this.cursor.stringIndex = parseInt(target.lineEl.dataset.string, 10) || 0;

      // Position cursor at the exact column under the click (no snapping)
      ensureColumns(block);

      const lastCol = block.columns.length > 0 ? block.columns[block.columns.length - 1] : null;
      const endOfContent = lastCol ? lastCol.position + lastCol.width : 0;

      if (contentCharIdx >= endOfContent && lastCol) {
        this.cursor.columnIndex = block.columns.length;
        this.cursor.charIndex = endOfContent;
      } else {
        // Find the column at the click position
        let clickCol = 0;
        for (let i = 0; i < block.columns.length; i++) {
          const col = block.columns[i];
          if (contentCharIdx < col.position + col.width) {
            clickCol = i;
            break;
          }
          clickCol = i + 1;
        }
        this.cursor.columnIndex = Math.min(clickCol, block.columns.length);
        this.cursor.charIndex = this.cursor.columnIndex < block.columns.length
          ? block.columns[this.cursor.columnIndex].position
          : endOfContent;
      }
    }

    const rawClickCol = this.cursor.columnIndex;

    // Handle selection: shift-click extends, normal click clears and sets anchor
    const mode = this.getActiveMode();
    if (event.shiftKey && mode._ensureSelAnchor) {
      mode._ensureSelAnchor();
      if (mode._updateSelectionDisplay) mode._updateSelectionDisplay();
    } else {
      if (mode._clearSelection) mode._clearSelection();
      // Start potential drag selection using the raw (unsnapped) column
      this._mouseDownCol = rawClickCol;
      this._isDragging = true;
    }

    event.preventDefault();
    this.updateCursor();
    document.getElementById('tab-editor').focus();
  }

  _onEditorMouseMove(event) {
    if (!this._isDragging || this.activeMode.name === 'raw') return;
    if (this._mouseDownCol === undefined) return;

    const col = this._getColumnFromMouseEvent(event);
    if (col === null) return;

    const mode = this.getActiveMode();
    // Create/update selection (even if same column, to highlight the anchor)
    if (mode._selAnchorCol === null || mode._selAnchorCol === undefined) {
      mode._selAnchorCol = this._mouseDownCol;
    }
    this.cursor.columnIndex = col;
    this._syncCursorFromColumn();
    if (mode._updateSelectionDisplay) mode._updateSelectionDisplay();
    this.updateCursor();
  }

  _onEditorMouseUp(event) {
    this._isDragging = false;
    this._mouseDownCol = undefined;
  }

  /** Get the raw column index from a mouse event (including rests, for selection). */
  _getColumnFromMouseEvent(event) {
    const target = this.editor.findClickTarget(event);
    if (!target) return null;

    const block = this.document.blocks[target.blockIndex];
    if (!block || block.type !== 'tabrow') return null;
    if (target.blockIndex !== this.cursor.blockIndex) return null;

    const charIdx = this.cursor.clickToCharIndex(target.lineEl, event.clientX);
    const labelWidth = this._labelWidth(block);
    const contentCharIdx = Math.max(0, charIdx - labelWidth);

    ensureColumns(block);

    const lastCol = block.columns[block.columns.length - 1];
    const endOfContent = lastCol ? lastCol.position + lastCol.width : 0;
    if (contentCharIdx >= endOfContent) return block.columns.length;

    // Find the column at the click position (including rests)
    for (let i = 0; i < block.columns.length; i++) {
      const col = block.columns[i];
      const colEnd = col.position + col.width;
      if (contentCharIdx >= col.position && contentCharIdx < colEnd) return i;
      if (contentCharIdx < col.position) return i;
    }

    return block.columns.length;
  }

  _syncCursorFromColumn() {
    const block = this.document.blocks[this.cursor.blockIndex];
    if (!block || !block.columns || block.columns.length === 0) {
      this.cursor.charIndex = 0;
      return;
    }
    const idx = Math.min(this.cursor.columnIndex, block.columns.length - 1);
    this.cursor.charIndex = block.columns[idx].position;
  }
}

// Initialize the app when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
