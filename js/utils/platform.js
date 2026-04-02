/**
 * Platform detection for keyboard shortcut display.
 */

const isMac = typeof navigator !== 'undefined'
  ? /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
  : false;

/**
 * Returns the platform-appropriate modifier key label.
 * @returns {'⌘' | 'Ctrl'}
 */
export function modifierKey() {
  return isMac ? '⌘' : 'Ctrl';
}

/**
 * Formats a keyboard shortcut for display in tooltips.
 * @param {string} key - The key (e.g., 'Z', 'S', 'Shift+Z')
 * @returns {string} e.g., '⌘+Z' on Mac, 'Ctrl+Z' on PC
 */
export function shortcutLabel(key) {
  return `${modifierKey()}+${key}`;
}

/**
 * Returns true if the event has the platform-appropriate modifier key pressed.
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function hasModifier(event) {
  return isMac ? event.metaKey : event.ctrlKey;
}
