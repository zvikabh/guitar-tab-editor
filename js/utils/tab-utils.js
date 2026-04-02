/**
 * Shared helpers for tab line detection, right annotation parsing, etc.
 */

/**
 * Standard string labels in order (high to low): e, B, G, D, A, E
 */
export const STANDARD_STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];

/**
 * Regex matching a labeled tab line: optional note letter + optional accidental + pipe.
 * Captures: (1) label, (2) rest of line
 * Supports alternate tunings — any letter a-g/A-G with optional #/b/♭/♯.
 */
const LABELED_TAB_RE = /^([a-gA-G][#b♭♯]?)([|‖])(.*)$/;

/**
 * Regex matching an unlabeled tab line: starts with | and contains primarily tab characters.
 */
const UNLABELED_TAB_RE = /^\|[-0-9|:hpbsrvx/\\~.\s]+$/;

/**
 * Characters that are valid inside tab content (between pipes or after label|).
 */
const TAB_CONTENT_CHARS = /^[-0-9|:hpbsrvx/\\~.\s]+$/;

/**
 * Tests whether a single line looks like a labeled tab string line.
 * @param {string} line
 * @returns {{ label: string, content: string } | null}
 */
export function parseLabeledTabLine(line) {
  const m = line.match(LABELED_TAB_RE);
  if (!m) return null;
  // If separator is ‖, it's part of a repeat marker — include it in content
  const separator = m[2];
  const rawContent = m[3];
  const content = separator === '‖' ? '‖' + rawContent : rawContent;
  return { label: m[1], content };
}

/**
 * Tests whether a single line looks like an unlabeled tab string line.
 * Must start with | and contain primarily tab characters.
 * @param {string} line
 * @returns {boolean}
 */
export function isUnlabeledTabLine(line) {
  return UNLABELED_TAB_RE.test(line.trimEnd());
}

/**
 * Attempts to detect 6 consecutive tab lines starting at the given index.
 * Returns the range and type, or null if not found.
 * @param {string[]} lines - All lines of the file
 * @param {number} startIdx - Index to start looking from
 * @returns {{ startIdx: number, endIdx: number, type: 'labeled'|'unlabeled', labels: string[] } | null}
 */
export function detectTabRow(lines, startIdx) {
  if (startIdx + 5 >= lines.length) return null;

  // Try labeled first
  const labeledResults = [];
  for (let i = 0; i < 6; i++) {
    const parsed = parseLabeledTabLine(lines[startIdx + i]);
    if (!parsed) break;
    labeledResults.push(parsed);
  }
  if (labeledResults.length === 6) {
    return {
      startIdx,
      endIdx: startIdx + 5,
      type: 'labeled',
      labels: labeledResults.map(r => r.label),
    };
  }

  // Try unlabeled
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
    // Check similar length (within 20% of max)
    const maxLen = Math.max(...lengths);
    const minLen = Math.min(...lengths);
    if (maxLen > 0 && minLen >= maxLen * 0.5) {
      return {
        startIdx,
        endIdx: startIdx + 5,
        type: 'unlabeled',
        labels: STANDARD_STRING_LABELS, // assume standard tuning
      };
    }
  }

  return null;
}

/**
 * Extracts right-side annotations from a tab string line.
 * For lines with a trailing |: text after the last |
 * For lines without trailing |: text separated by 2+ spaces from tab content
 * @param {string} line - The raw tab string line (content portion, after label|)
 * @returns {{ content: string, annotation: string }}
 */
export function extractRightAnnotation(line) {
  // Check for text after final | (ASCII pipe)
  const lastPipe = line.lastIndexOf('|');
  if (lastPipe !== -1) {
    const afterPipe = line.substring(lastPipe + 1);
    if (afterPipe.trim() !== '') {
      // Annotations are separated from the tab by leading whitespace (e.g., "| x2").
      // Tab content directly follows the pipe with no space (e.g., "|-3---").
      // So: if afterPipe starts with a space, it's an annotation.
      // If it starts with a tab character (dash, digit, colon, ‖), it's content.
      if (/^\s/.test(afterPipe)) {
        return {
          content: line.substring(0, lastPipe + 1),
          annotation: afterPipe.trimStart(),
        };
      }
      // Starts with tab content character — it's part of the tab, not an annotation
      return { content: line, annotation: '' };
    }
    // Trailing pipe with nothing after — content includes the pipe
    return { content: line, annotation: '' };
  }

  // No pipe at end — check for whitespace-separated annotation
  const match = line.match(/^(.*?\S)\s{2,}(\S.*)$/);
  if (match) {
    return { content: match[1], annotation: match[2] };
  }

  return { content: line, annotation: '' };
}

/**
 * Checks if a line is blank (empty or only whitespace).
 * @param {string} line
 * @returns {boolean}
 */
export function isBlankLine(line) {
  return line.trimEnd() === '';
}
