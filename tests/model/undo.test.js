import { UndoManager, createSetFretOp, createInsertCharOp, createDeleteCharOp } from '../../js/model/undo.js';
import { createDocument, createTextBlock, createTabRowBlock, ensureColumns, cloneDocument } from '../../js/model/document.js';

function makeTestDoc() {
  const doc = createDocument([
    createTextBlock(['Test Song']),
    createTabRowBlock({
      strings: [
        '---0---|',
        '---1---|',
        '---0---|',
        '---2---|',
        '---3---|',
        '-------|',
      ],
    }),
  ]);
  ensureColumns(doc.blocks[1]);
  return doc;
}

describe('UndoManager', () => {
  test('starts with empty stacks', () => {
    const um = new UndoManager();
    expect(um.canUndo()).toBe(false);
    expect(um.canRedo()).toBe(false);
  });

  test('undo returns null when stack is empty', () => {
    const um = new UndoManager();
    const doc = makeTestDoc();
    expect(um.undo(doc)).toBeNull();
  });

  test('redo returns null when stack is empty', () => {
    const um = new UndoManager();
    const doc = makeTestDoc();
    expect(um.redo(doc)).toBeNull();
  });

  describe('reversible operations', () => {
    test('undo reverses a SetFret operation', () => {
      const um = new UndoManager();
      const doc = makeTestDoc();

      const noteIdx = doc.blocks[1].columns.findIndex(c => c.type === 'note');
      const op = createSetFretOp(1, noteIdx, 0, '0', '5');

      // Apply the operation
      op.apply(doc);
      expect(doc.blocks[1].columns[noteIdx].notes[0]).toBe('5');

      // Record it
      um.pushOp(op);
      expect(um.canUndo()).toBe(true);

      // Undo
      const result = um.undo(doc);
      expect(result).not.toBeNull();
      expect(doc.blocks[1].columns[noteIdx].notes[0]).toBe('0');
      expect(um.canRedo()).toBe(true);
    });

    test('redo re-applies a SetFret operation', () => {
      const um = new UndoManager();
      const doc = makeTestDoc();

      const noteIdx = doc.blocks[1].columns.findIndex(c => c.type === 'note');
      const op = createSetFretOp(1, noteIdx, 0, '0', '5');

      op.apply(doc);
      um.pushOp(op);

      // Undo
      um.undo(doc);
      expect(doc.blocks[1].columns[noteIdx].notes[0]).toBe('0');

      // Redo
      um.redo(doc);
      expect(doc.blocks[1].columns[noteIdx].notes[0]).toBe('5');
    });

    test('multiple undo/redo in sequence', () => {
      const um = new UndoManager();
      const doc = makeTestDoc();

      const noteIdx = doc.blocks[1].columns.findIndex(c => c.type === 'note');

      // Edit 1: change to 5
      const op1 = createSetFretOp(1, noteIdx, 0, '0', '5');
      op1.apply(doc);
      um.pushOp(op1);

      // Edit 2: change to 7
      const op2 = createSetFretOp(1, noteIdx, 0, '5', '7');
      op2.apply(doc);
      um.pushOp(op2);

      // Edit 3: change to 9
      const op3 = createSetFretOp(1, noteIdx, 0, '7', '9');
      op3.apply(doc);
      um.pushOp(op3);

      expect(doc.blocks[1].columns[noteIdx].notes[0]).toBe('9');

      // Undo 3 times
      um.undo(doc);
      expect(doc.blocks[1].columns[noteIdx].notes[0]).toBe('7');

      um.undo(doc);
      expect(doc.blocks[1].columns[noteIdx].notes[0]).toBe('5');

      um.undo(doc);
      expect(doc.blocks[1].columns[noteIdx].notes[0]).toBe('0');

      // Redo 1 time
      um.redo(doc);
      expect(doc.blocks[1].columns[noteIdx].notes[0]).toBe('5');
    });
  });

  describe('InsertChar / DeleteChar ops (Raw Edit)', () => {
    test('undo reverses character insertion', () => {
      const um = new UndoManager();
      const doc = createDocument([createTextBlock(['hello'])]);

      const op = createInsertCharOp(0, 0, 5, '!');
      op.apply(doc);
      expect(doc.blocks[0].lines[0]).toBe('hello!');

      um.pushOp(op);
      um.undo(doc);
      expect(doc.blocks[0].lines[0]).toBe('hello');
    });

    test('undo reverses character deletion', () => {
      const um = new UndoManager();
      const doc = createDocument([createTextBlock(['hello'])]);

      const op = createDeleteCharOp(0, 0, 4, 'o');
      op.apply(doc);
      expect(doc.blocks[0].lines[0]).toBe('hell');

      um.pushOp(op);
      um.undo(doc);
      expect(doc.blocks[0].lines[0]).toBe('hello');
    });
  });

  describe('snapshot fallback', () => {
    test('undo restores from snapshot', () => {
      const um = new UndoManager();
      const doc = makeTestDoc();

      // Save snapshot before complex operation
      um.pushSnapshot(doc);

      // Simulate complex operation: completely replace the document
      doc.blocks = [createTextBlock(['completely different'])];

      expect(doc.blocks[0].lines[0]).toBe('completely different');

      // Undo should restore the snapshot
      const result = um.undo(doc);
      expect(result).not.toBeNull();
      expect(result.doc.blocks).toHaveLength(2);
      expect(result.doc.blocks[0].lines[0]).toBe('Test Song');
    });

    test('redo after snapshot undo works', () => {
      const um = new UndoManager();
      const doc = makeTestDoc();

      um.pushSnapshot(doc);

      // Mutate
      const mutatedDoc = createDocument([createTextBlock(['mutated'])]);

      // Undo
      const undoResult = um.undo(mutatedDoc);
      expect(undoResult.doc.blocks[0].lines[0]).toBe('Test Song');

      // Redo
      const redoResult = um.redo(undoResult.doc);
      expect(redoResult).not.toBeNull();
      expect(redoResult.doc.blocks[0].lines[0]).toBe('mutated');
    });
  });

  describe('mixed ops and snapshots', () => {
    test('interleaved ops and snapshots undo correctly', () => {
      const um = new UndoManager();
      const doc = createDocument([createTextBlock(['start'])]);

      // Op 1: insert char
      const op1 = createInsertCharOp(0, 0, 5, '1');
      op1.apply(doc);
      um.pushOp(op1);
      expect(doc.blocks[0].lines[0]).toBe('start1');

      // Op 2: snapshot before complex change
      um.pushSnapshot(doc);
      doc.blocks[0].lines[0] = 'complex_change';

      // Op 3: another char insert
      const op3 = createInsertCharOp(0, 0, 14, '!');
      op3.apply(doc);
      um.pushOp(op3);
      expect(doc.blocks[0].lines[0]).toBe('complex_change!');

      // Undo op3
      um.undo(doc);
      expect(doc.blocks[0].lines[0]).toBe('complex_change');

      // Undo snapshot (restores to 'start1')
      const result = um.undo(doc);
      expect(result.doc.blocks[0].lines[0]).toBe('start1');
    });
  });

  describe('redo cleared on new edit', () => {
    test('new edit clears redo stack', () => {
      const um = new UndoManager();
      const doc = createDocument([createTextBlock(['hello'])]);

      const op1 = createInsertCharOp(0, 0, 5, '1');
      op1.apply(doc);
      um.pushOp(op1);

      // Undo
      um.undo(doc);
      expect(um.canRedo()).toBe(true);

      // New edit should clear redo
      const op2 = createInsertCharOp(0, 0, 5, '2');
      op2.apply(doc);
      um.pushOp(op2);

      expect(um.canRedo()).toBe(false);
    });

    test('snapshot push clears redo stack', () => {
      const um = new UndoManager();
      const doc = createDocument([createTextBlock(['hello'])]);

      const op1 = createInsertCharOp(0, 0, 5, '1');
      op1.apply(doc);
      um.pushOp(op1);

      um.undo(doc);
      expect(um.canRedo()).toBe(true);

      um.pushSnapshot(doc);
      expect(um.canRedo()).toBe(false);
    });
  });

  describe('clear', () => {
    test('clear empties both stacks', () => {
      const um = new UndoManager();
      const doc = createDocument([createTextBlock(['hello'])]);

      um.pushOp(createInsertCharOp(0, 0, 0, 'a'));
      um.pushSnapshot(doc);

      expect(um.canUndo()).toBe(true);

      um.clear();
      expect(um.canUndo()).toBe(false);
      expect(um.canRedo()).toBe(false);
    });
  });
});
