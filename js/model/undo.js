/**
 * UndoManager: hybrid approach with reversible operations and snapshot fallback.
 */

import { cloneDocument } from './document.js';

/**
 * @typedef {Object} ReversibleOp
 * @property {function(Object): void} apply - Apply the operation to a document
 * @property {function(Object): void} reverse - Reverse the operation on a document
 * @property {string} description - Human-readable description
 */

export class UndoManager {
  constructor() {
    /** @type {Array<{ type: 'op', op: ReversibleOp } | { type: 'snapshot', doc: Object, cursorState?: any }>} */
    this.undoStack = [];
    /** @type {Array<{ type: 'op', op: ReversibleOp } | { type: 'snapshot', doc: Object, cursorState?: any }>} */
    this.redoStack = [];
  }

  /**
   * Record a reversible operation.
   * @param {ReversibleOp} op
   */
  pushOp(op) {
    this.undoStack.push({ type: 'op', op });
    this.redoStack = []; // Clear redo on new edit
  }

  /**
   * Record a full document snapshot (for complex ops).
   * @param {Object} doc - The document state BEFORE the operation
   * @param {any} [cursorState] - Optional cursor state to restore
   */
  pushSnapshot(doc, cursorState) {
    this.undoStack.push({
      type: 'snapshot',
      doc: cloneDocument(doc),
      cursorState,
    });
    this.redoStack = []; // Clear redo on new edit
  }

  /**
   * Undo the last operation.
   * @param {Object} currentDoc - The current document state
   * @returns {{ doc: Object, cursorState?: any } | null} - The restored document, or null if nothing to undo
   */
  undo(currentDoc) {
    if (this.undoStack.length === 0) return null;

    const entry = this.undoStack.pop();

    if (entry.type === 'snapshot') {
      // Push current state to redo as a snapshot
      this.redoStack.push({
        type: 'snapshot',
        doc: cloneDocument(currentDoc),
      });
      return { doc: entry.doc, cursorState: entry.cursorState };
    }

    // Reversible op: reverse it and push to redo
    entry.op.reverse(currentDoc);
    this.redoStack.push(entry);
    return { doc: currentDoc };
  }

  /**
   * Redo the last undone operation.
   * @param {Object} currentDoc - The current document state
   * @returns {{ doc: Object, cursorState?: any } | null} - The restored document, or null if nothing to redo
   */
  redo(currentDoc) {
    if (this.redoStack.length === 0) return null;

    const entry = this.redoStack.pop();

    if (entry.type === 'snapshot') {
      // Push current state to undo as a snapshot
      this.undoStack.push({
        type: 'snapshot',
        doc: cloneDocument(currentDoc),
      });
      return { doc: entry.doc, cursorState: entry.cursorState };
    }

    // Reversible op: re-apply it and push to undo
    entry.op.apply(currentDoc);
    this.undoStack.push(entry);
    return { doc: currentDoc };
  }

  /**
   * @returns {boolean}
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * @returns {boolean}
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Clear all undo/redo history.
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

// ---------------------------------------------------------------------------
// Reversible operation factories
// ---------------------------------------------------------------------------

/**
 * Create a reversible SetFret operation.
 * @param {number} blockIdx
 * @param {number} colIdx
 * @param {number} stringIdx
 * @param {string|null} oldValue
 * @param {string|null} newValue
 * @returns {ReversibleOp}
 */
export function createSetFretOp(blockIdx, colIdx, stringIdx, oldValue, newValue) {
  return {
    description: `Set fret at block ${blockIdx}, col ${colIdx}, string ${stringIdx}`,
    apply(doc) {
      const block = doc.blocks[blockIdx];
      if (block && block.columns && block.columns[colIdx]) {
        block.columns[colIdx].notes[stringIdx] = newValue;
        // Note: caller must sync strings after applying
      }
    },
    reverse(doc) {
      const block = doc.blocks[blockIdx];
      if (block && block.columns && block.columns[colIdx]) {
        block.columns[colIdx].notes[stringIdx] = oldValue;
      }
    },
  };
}

/**
 * Create a reversible InsertChar operation (for Raw Edit).
 * @param {number} blockIdx
 * @param {number} lineIdx
 * @param {number} charIdx
 * @param {string} char
 * @returns {ReversibleOp}
 */
export function createInsertCharOp(blockIdx, lineIdx, charIdx, char) {
  return {
    description: `Insert '${char}' at block ${blockIdx}, line ${lineIdx}, pos ${charIdx}`,
    apply(doc) {
      const block = doc.blocks[blockIdx];
      if (block) {
        const lines = block.type === 'text' ? block.lines : block.strings;
        if (lines[lineIdx] !== undefined) {
          lines[lineIdx] = lines[lineIdx].slice(0, charIdx) + char + lines[lineIdx].slice(charIdx);
        }
      }
    },
    reverse(doc) {
      const block = doc.blocks[blockIdx];
      if (block) {
        const lines = block.type === 'text' ? block.lines : block.strings;
        if (lines[lineIdx] !== undefined) {
          lines[lineIdx] = lines[lineIdx].slice(0, charIdx) + lines[lineIdx].slice(charIdx + char.length);
        }
      }
    },
  };
}

/**
 * Create a reversible DeleteChar operation (for Raw Edit).
 * @param {number} blockIdx
 * @param {number} lineIdx
 * @param {number} charIdx
 * @param {string} char - The character that was deleted
 * @returns {ReversibleOp}
 */
export function createDeleteCharOp(blockIdx, lineIdx, charIdx, char) {
  return {
    description: `Delete '${char}' at block ${blockIdx}, line ${lineIdx}, pos ${charIdx}`,
    apply(doc) {
      const block = doc.blocks[blockIdx];
      if (block) {
        const lines = block.type === 'text' ? block.lines : block.strings;
        if (lines[lineIdx] !== undefined) {
          lines[lineIdx] = lines[lineIdx].slice(0, charIdx) + lines[lineIdx].slice(charIdx + char.length);
        }
      }
    },
    reverse(doc) {
      const block = doc.blocks[blockIdx];
      if (block) {
        const lines = block.type === 'text' ? block.lines : block.strings;
        if (lines[lineIdx] !== undefined) {
          lines[lineIdx] = lines[lineIdx].slice(0, charIdx) + char + lines[lineIdx].slice(charIdx);
        }
      }
    },
  };
}
