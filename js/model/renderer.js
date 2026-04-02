/**
 * Renderer: converts a Document model back to raw tab text.
 */

import { parseLabeledTabLine } from '../utils/tab-utils.js';

/**
 * Render a Document to a text string.
 * @param {Object} document - The Document model
 * @returns {string}
 */
export function renderDocument(document) {
  const outputLines = [];

  for (const block of document.blocks) {
    if (block.type === 'text') {
      for (const line of block.lines) {
        outputLines.push(line);
      }
    } else if (block.type === 'tabrow') {
      renderTabRowBlock(block, outputLines);
    }
  }

  // Join with newlines and add a trailing newline
  return outputLines.join('\n') + '\n';
}

/**
 * Render a TabRowBlock into output lines.
 * @param {Object} block - TabRowBlock
 * @param {string[]} outputLines - Array to push lines onto
 */
function renderTabRowBlock(block, outputLines) {
  // Pre-lines
  for (const line of block.preLines) {
    outputLines.push(line);
  }

  // String lines with labels and right annotations
  for (let i = 0; i < 6; i++) {
    const label = block.labels[i];
    const content = block.strings[i];
    const annotation = block.rightAnnotations[i] || '';

    // Use label| as prefix, but if content starts with a repeat marker (‖: or :|),
    // skip the | to avoid e|‖: — just use e‖: instead.
    let separator = '|';
    if (content.startsWith('‖:') || content.startsWith(':‖')) {
      separator = '';
    }
    let line = `${label}${separator}${content}`;
    if (annotation) {
      line += ` ${annotation}`;
    }

    outputLines.push(line);
  }

  // Post-lines
  for (const line of block.postLines) {
    outputLines.push(line);
  }
}
