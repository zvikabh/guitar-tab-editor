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

    // Click handler for the editor
    editorEl.addEventListener('click', (event) => this._onEditorClick(event));

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
      const labelWidth = block.labels[0].length + 1; // e.g., "e|" = 2
      this.cursor.positionAtTabRow(blockEl, this.cursor.charIndex + labelWidth);
    }
  }

  updateUndoRedoButtons() {
    this.toolbar.updateUndoRedoButtons();
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
    const result = await this.fileIO.open();
    if (!result) return;

    // If in raw mode, force-exit without re-parsing (we're loading a new file)
    if (this.activeMode.name === 'raw') {
      this.activeMode._lines = null;
      this.activeMode._savedDoc = null;
      this.activeMode._removeErrorBanner();
    }

    const doc = parseTabText(result.text);
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

  _onEditorClick(event) {
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
      // Clicking on text/pre/post: switch to raw mode to edit it
      const clickCharIdx = this.cursor.clickToCharIndex(target.lineEl, event.clientX);
      this._switchToRawForTextEdit(target.blockIndex, target.lineIndex, clickCharIdx);
      return;
    } else if (target.lineType === 'tab' && block.type === 'tabrow') {
      // Clicking on a tab line in note/fingerpick mode
      const charIdx = this.cursor.clickToCharIndex(target.lineEl, event.clientX);
      const labelWidth = block.labels[0].length + 1;
      const contentCharIdx = Math.max(0, charIdx - labelWidth);

      this.cursor.charIndex = contentCharIdx;
      this.cursor.stringIndex = parseInt(target.lineEl.dataset.string, 10) || 0;

      // Snap cursor to a column position based on click location.
      ensureColumns(block);

      // Check if click is past the end of all columns (past the final |)
      const lastCol = block.columns.length > 0 ? block.columns[block.columns.length - 1] : null;
      const endOfContent = lastCol ? lastCol.position + lastCol.width : 0;

      if (contentCharIdx >= endOfContent && lastCol) {
        // Click is past the end — position cursor at "end of row"
        this.cursor.columnIndex = block.columns.length;
        this.cursor.charIndex = endOfContent;
      } else {
        // Snap to nearest note or bar column (skip rests).
        const meaningfulCols = block.columns
          .map((col, i) => ({ col, i }))
          .filter(({ col }) => col.type !== 'rest');

        if (meaningfulCols.length > 0) {
          let bestEntry = meaningfulCols[0];
          let bestDist = Infinity;
          for (const entry of meaningfulCols) {
            const dist = Math.abs(entry.col.position - contentCharIdx);
            if (dist < bestDist) {
              bestDist = dist;
              bestEntry = entry;
            }
          }
          // If click is past a note (in its trailing rest), snap to the NEXT meaningful col
          if (bestEntry.col.position < contentCharIdx) {
            const afterCols = meaningfulCols.filter(e => e.col.position >= contentCharIdx);
            if (afterCols.length > 0) {
              bestEntry = afterCols[0];
            }
          }
          this.cursor.columnIndex = bestEntry.i;
          this.cursor.charIndex = bestEntry.col.position;
        } else if (block.columns.length > 0) {
          this.cursor.columnIndex = 0;
          this.cursor.charIndex = 0;
        }
      }
    }

    this.updateCursor();
    document.getElementById('tab-editor').focus();
  }
}

// Initialize the app when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
