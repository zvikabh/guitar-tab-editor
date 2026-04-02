/**
 * Custom editor component: renders document blocks as DOM elements,
 * handles click-to-position, and manages block-level re-rendering.
 */

export class Editor {
  /**
   * @param {HTMLElement} containerEl - The #tab-editor element
   * @param {Object} document - The Document model
   */
  constructor(containerEl, document) {
    this.containerEl = containerEl;
    this.document = document;
    this._blockElements = [];
  }

  /**
   * Set the document and render it.
   * @param {Object} document
   */
  setDocument(document) {
    this.document = document;
    this.renderAll();
  }

  /**
   * Render the entire document to the DOM.
   */
  renderAll() {
    this.containerEl.innerHTML = '';
    this._blockElements = [];

    if (!this.document) return;

    for (let i = 0; i < this.document.blocks.length; i++) {
      const block = this.document.blocks[i];
      const el = this._renderBlock(block, i);
      this.containerEl.appendChild(el);
      this._blockElements.push(el);
    }
  }

  /**
   * Re-render a single block (e.g., after an edit).
   * @param {number} blockIndex
   */
  renderBlock(blockIndex) {
    if (!this.document || blockIndex >= this.document.blocks.length) return;

    const block = this.document.blocks[blockIndex];
    const newEl = this._renderBlock(block, blockIndex);

    if (this._blockElements[blockIndex]) {
      this.containerEl.replaceChild(newEl, this._blockElements[blockIndex]);
    } else {
      this.containerEl.appendChild(newEl);
    }
    this._blockElements[blockIndex] = newEl;
  }

  /**
   * Get the DOM element for a block.
   * @param {number} blockIndex
   * @returns {HTMLElement|null}
   */
  getBlockElement(blockIndex) {
    return this._blockElements[blockIndex] || null;
  }

  /**
   * Find which block and line was clicked.
   * @param {Event} event - Click event
   * @returns {{ blockIndex: number, lineEl: HTMLElement, lineType: string, lineIndex: number } | null}
   */
  findClickTarget(event) {
    // Find the closest .line element
    const lineEl = event.target.closest('.line');
    if (!lineEl) {
      // Clicked in the editor but not on a line — find nearest block
      const blockEl = event.target.closest('.block');
      if (!blockEl) return null;
      const blockIndex = parseInt(blockEl.dataset.blockIdx, 10);
      // Position at end of last line in block
      const lines = blockEl.querySelectorAll('.line');
      if (lines.length === 0) return null;
      const lastLine = lines[lines.length - 1];
      return {
        blockIndex,
        lineEl: lastLine,
        lineType: lastLine.dataset.lineType || 'text',
        lineIndex: lines.length - 1,
      };
    }

    const blockEl = lineEl.closest('.block');
    if (!blockEl) return null;

    const blockIndex = parseInt(blockEl.dataset.blockIdx, 10);
    const allLines = Array.from(blockEl.querySelectorAll('.line'));
    const lineIndex = allLines.indexOf(lineEl);
    const lineType = lineEl.dataset.lineType || 'text';

    return { blockIndex, lineEl, lineType, lineIndex };
  }

  /**
   * Render a single block to a DOM element.
   * @param {Object} block
   * @param {number} index
   * @returns {HTMLElement}
   */
  _renderBlock(block, index) {
    const div = document.createElement('div');
    div.className = `block block-${block.type}`;
    div.dataset.blockIdx = index;

    if (block.type === 'text') {
      for (const line of block.lines) {
        const lineEl = document.createElement('div');
        lineEl.className = 'line line-text';
        lineEl.dataset.lineType = 'text';
        if (line) {
          lineEl.textContent = line;
        } else {
          // Empty lines need a <br> to be selectable/copyable
          lineEl.appendChild(document.createElement('br'));
        }
        div.appendChild(lineEl);
      }
    } else if (block.type === 'tabrow') {
      // Pre-lines
      for (const line of block.preLines) {
        const lineEl = document.createElement('div');
        lineEl.className = 'line line-pre';
        lineEl.dataset.lineType = 'pre';
        lineEl.textContent = line;
        div.appendChild(lineEl);
      }

      // Tab string lines
      for (let s = 0; s < 6; s++) {
        const lineEl = document.createElement('div');
        lineEl.className = 'line line-tab';
        lineEl.dataset.lineType = 'tab';
        lineEl.dataset.string = s;

        // Skip the | separator if content starts with a repeat marker (‖: or :‖)
        const content = block.strings[s];
        const sep = (content.startsWith('‖:') || content.startsWith(':‖')) ? '' : '|';
        let text = `${block.labels[s]}${sep}${content}`;
        if (block.rightAnnotations[s]) {
          text += ` ${block.rightAnnotations[s]}`;
        }
        lineEl.textContent = text;
        div.appendChild(lineEl);
      }

      // Post-lines
      for (const line of block.postLines) {
        const lineEl = document.createElement('div');
        lineEl.className = 'line line-post';
        lineEl.dataset.lineType = 'post';
        lineEl.textContent = line;
        div.appendChild(lineEl);
      }
    }

    return div;
  }
}
