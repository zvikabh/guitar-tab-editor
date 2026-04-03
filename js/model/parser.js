/**
 * Parser: converts raw tab text into a Document model.
 */

import { createDocument, createTextBlock, createTabRowBlock } from './document.js';
import {
  parseLabeledTabLine,
  isUnlabeledTabLine,
  extractRightAnnotation,
  isBlankLine,
  STANDARD_STRING_LABELS,
} from '../utils/tab-utils.js';

/**
 * Parse a raw tab text string into a Document.
 * @param {string} text
 * @returns {Object} Document
 */
export function parseTabText(text) {
  // Normalize line endings: strip \r (CRLF → LF)
  const rawLines = text.replace(/\r/g, '').split('\n');
  // Remove trailing empty line that split() creates from trailing newline
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
    rawLines.pop();
  }

  const blocks = [];
  const consumed = new Set(); // Track which line indices have been consumed

  // First pass: find all tab rows
  const tabRows = findAllTabRows(rawLines);

  // Mark tab row lines as consumed and collect pre/post lines for each
  for (const row of tabRows) {
    for (let i = row.startIdx; i <= row.endIdx; i++) {
      consumed.add(i);
    }

    // Walk backwards from tab start to collect pre-lines
    const preLines = [];
    let i = row.startIdx - 1;
    while (i >= 0 && !consumed.has(i) && !isBlankLine(rawLines[i])) {
      preLines.unshift(rawLines[i]);
      consumed.add(i);
      i--;
    }

    // Walk forwards from tab end to collect post-lines
    const postLines = [];
    i = row.endIdx + 1;
    while (i < rawLines.length && !consumed.has(i) && !isBlankLine(rawLines[i])) {
      postLines.push(rawLines[i]);
      consumed.add(i);
      i++;
    }

    row.preLines = preLines;
    row.postLines = postLines;
  }

  // Second pass: build blocks in order
  let currentTextLines = [];

  function flushTextLines() {
    if (currentTextLines.length > 0) {
      blocks.push(createTextBlock(currentTextLines));
      currentTextLines = [];
    }
  }

  // Create a map from line index to tab row
  const lineToTabRow = new Map();
  for (const row of tabRows) {
    // Map all lines belonging to this tab row (pre, tab strings, post)
    for (const preLineIdx of findPreLineIndices(rawLines, row, consumed)) {
      lineToTabRow.set(preLineIdx, row);
    }
    for (let idx = row.startIdx; idx <= row.endIdx; idx++) {
      lineToTabRow.set(idx, row);
    }
    for (const postLineIdx of findPostLineIndices(rawLines, row, consumed)) {
      lineToTabRow.set(postLineIdx, row);
    }
  }

  // Build a set of tab row start indices for block insertion
  const tabRowFirstLine = new Map();
  for (const row of tabRows) {
    // Find the earliest line belonging to this row
    let earliest = row.startIdx;
    for (let i = row.startIdx - 1; i >= 0; i--) {
      if (consumed.has(i) && lineToTabRow.get(i) === row) {
        earliest = i;
      } else {
        break;
      }
    }
    tabRowFirstLine.set(earliest, row);
  }

  const emittedTabRows = new Set();

  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
    if (consumed.has(lineIdx)) {
      // This line belongs to a tab row — check if we should emit the block
      const row = lineToTabRow.get(lineIdx);
      if (row && !emittedTabRows.has(row)) {
        flushTextLines();
        emittedTabRows.add(row);

        // Parse string lines, extracting right annotations
        const strings = [];
        const rightAnnotations = [];
        const labels = [];

        for (let s = 0; s < 6; s++) {
          const rawLine = rawLines[row.startIdx + s];
          const labelParsed = parseLabeledTabLine(rawLine);

          let label, fullContent;
          if (labelParsed) {
            label = labelParsed.label;
            fullContent = labelParsed.content;
          } else {
            // Unlabeled — strip leading | if present
            label = STANDARD_STRING_LABELS[s];
            fullContent = rawLine.startsWith('|') ? rawLine.substring(1) : rawLine;
          }

          const { content, annotation } = extractRightAnnotation(fullContent);
          labels.push(label);
          strings.push(content);
          rightAnnotations.push(annotation);
        }

        blocks.push(createTabRowBlock({
          preLines: row.preLines,
          strings,
          postLines: row.postLines,
          rightAnnotations,
          labels,
        }));
      }
      continue;
    }

    // Non-consumed line — accumulate as text
    currentTextLines.push(rawLines[lineIdx]);
  }

  flushTextLines();

  // Infer document style
  const style = inferStyle(blocks);

  return createDocument(blocks, style);
}

/**
 * Find all groups of 6 consecutive tab lines in the input.
 * @param {string[]} lines
 * @returns {Array<{startIdx: number, endIdx: number, type: string}>}
 */
function findAllTabRows(lines) {
  const rows = [];
  const usedLines = new Set();
  let i = 0;

  while (i < lines.length) {
    if (usedLines.has(i)) { i++; continue; }

    const row = detectTabRowAt(lines, i);
    if (row) {
      rows.push(row);
      for (let j = row.startIdx; j <= row.endIdx; j++) {
        usedLines.add(j);
      }
      i = row.endIdx + 1;
    } else {
      i++;
    }
  }

  return rows;
}

/**
 * Try to detect a tab row starting at the given line index.
 * @param {string[]} lines
 * @param {number} startIdx
 * @returns {{ startIdx: number, endIdx: number, type: string } | null}
 */
function detectTabRowAt(lines, startIdx) {
  if (startIdx + 5 >= lines.length) return null;

  // Try labeled: 6 consecutive lines matching label|content
  const labelResults = [];
  for (let i = 0; i < 6; i++) {
    const line = lines[startIdx + i];
    if (line === undefined) break;
    const parsed = parseLabeledTabLine(line);
    if (!parsed) break;
    labelResults.push(parsed);
  }
  if (labelResults.length === 6) {
    return { startIdx, endIdx: startIdx + 5, type: 'labeled' };
  }

  // Try unlabeled: 6 consecutive lines starting with | and containing tab chars
  let unlabeledCount = 0;
  const lengths = [];
  for (let i = 0; i < 6; i++) {
    const line = lines[startIdx + i];
    if (line === undefined) break;
    if (isUnlabeledTabLine(line)) {
      unlabeledCount++;
      lengths.push(line.trimEnd().length);
    } else {
      break;
    }
  }
  if (unlabeledCount === 6) {
    const maxLen = Math.max(...lengths);
    const minLen = Math.min(...lengths);
    if (maxLen > 0 && minLen >= maxLen * 0.5) {
      return { startIdx, endIdx: startIdx + 5, type: 'unlabeled' };
    }
  }

  return null;
}

/**
 * Helper to find pre-line indices for a tab row.
 */
function findPreLineIndices(rawLines, row, consumed) {
  const indices = [];
  let i = row.startIdx - 1;
  while (i >= 0 && consumed.has(i)) {
    indices.unshift(i);
    i--;
  }
  return indices;
}

/**
 * Helper to find post-line indices for a tab row.
 */
function findPostLineIndices(rawLines, row, consumed) {
  const indices = [];
  let i = row.endIdx + 1;
  while (i < rawLines.length && consumed.has(i)) {
    indices.push(i);
    i++;
  }
  return indices;
}

/**
 * Infer document style from the first TabRowBlock and spacing patterns.
 * @param {Block[]} blocks
 * @returns {Object}
 */
function inferStyle(blocks) {
  const style = {
    blankLinesBetweenRows: 1,
    preLineTypes: [],
    postLineTypes: [],
  };

  // Find first tab row to infer line type positions
  const firstTabRow = blocks.find(b => b.type === 'tabrow');
  if (firstTabRow) {
    // Classify pre-lines
    for (const line of firstTabRow.preLines) {
      const type = classifyAssociatedLine(line);
      if (type && !style.preLineTypes.includes(type)) {
        style.preLineTypes.push(type);
      }
    }
    // Classify post-lines
    for (const line of firstTabRow.postLines) {
      const type = classifyAssociatedLine(line);
      if (type && !style.postLineTypes.includes(type)) {
        style.postLineTypes.push(type);
      }
    }
  }

  // Infer blank lines between tab rows
  const tabRowIndices = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type === 'tabrow') tabRowIndices.push(i);
  }
  if (tabRowIndices.length >= 2) {
    // Check what's between first two tab rows
    const between = [];
    for (let i = tabRowIndices[0] + 1; i < tabRowIndices[1]; i++) {
      if (blocks[i].type === 'text') {
        const blankCount = blocks[i].lines.filter(l => isBlankLine(l)).length;
        between.push(blankCount);
      }
    }
    if (between.length > 0) {
      style.blankLinesBetweenRows = Math.max(...between, 1);
    }
  }

  return style;
}

/**
 * Classify an associated line (pre or post) as chord, lyric, or timing.
 * @param {string} line
 * @returns {'chord'|'lyric'|'timing'|null}
 */
function classifyAssociatedLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Timing line: contains beat markers like "1 + 2 + 3 + 4 +"
  if (/^\|?\s*[1-4]\s*[+&]/.test(trimmed) || /[1-4]\s*\+\s*[1-4]/.test(trimmed)) {
    return 'timing';
  }

  // Chord line: predominantly chord symbols
  // Match lines that contain chord names like C, Am, G/B, Fmaj7, etc.
  const chordPattern = /^[\s|]*([A-G][#b♭♯]?(m|M|maj|min|dim|aug|sus|add|[0-9/()_-])*\s*)+$/;
  if (chordPattern.test(trimmed)) {
    return 'chord';
  }

  // Otherwise assume lyrics or other text
  return 'lyric';
}
