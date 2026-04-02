/**
 * File I/O: open and save tab files.
 * Uses File System Access API when available, with upload/download fallback.
 */

export class FileIO {
  constructor() {
    /** @type {FileSystemFileHandle|null} */
    this.fileHandle = null;
    this.fileName = 'untitled.txt';
  }

  /**
   * Open a file. Returns the text content.
   * @returns {Promise<{ text: string, name: string } | null>}
   */
  async open() {
    if (window.showOpenFilePicker) {
      return this._openFSA();
    }
    return this._openFallback();
  }

  /**
   * Save text to file. Shows a save dialog for filename.
   * @param {string} text
   * @param {string} [suggestedName] - Default filename suggestion
   */
  async save(text, suggestedName) {
    const defaultName = suggestedName || this.fileName || 'untitled.txt';

    if (window.showSaveFilePicker) {
      return this._saveFSADialog(text, defaultName);
    }
    return this._saveFallbackDialog(text, defaultName);
  }

  // --- File System Access API ---

  async _openFSA() {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Tab files',
          accept: { 'text/plain': ['.txt', '.tab'] },
        }],
      });
      this.fileHandle = handle;
      this.fileName = handle.name;
      const file = await handle.getFile();
      const text = await file.text();
      return { text, name: handle.name };
    } catch (e) {
      if (e.name === 'AbortError') return null; // User cancelled
      throw e;
    }
  }

  async _saveFSADialog(text, defaultName) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultName,
        types: [{
          description: 'Tab files',
          accept: { 'text/plain': ['.txt', '.tab'] },
        }],
      });
      this.fileHandle = handle;
      this.fileName = handle.name;
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
    } catch (e) {
      if (e.name === 'AbortError') return; // User cancelled
      // Fall back to download
      this._saveFallbackDialog(text, defaultName);
    }
  }

  _saveFallbackDialog(text, defaultName) {
    const fileName = prompt('Save as:', defaultName);
    if (!fileName) return; // User cancelled

    this.fileName = fileName;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Fallback ---

  async _openFallback() {
    return new Promise((resolve) => {
      const input = document.getElementById('fileInput');
      input.value = '';

      const handler = () => {
        input.removeEventListener('change', handler);
        const file = input.files[0];
        if (!file) { resolve(null); return; }

        this.fileName = file.name;
        this.fileHandle = null;

        const reader = new FileReader();
        reader.onload = () => resolve({ text: reader.result, name: file.name });
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      };

      input.addEventListener('change', handler);
      input.click();
    });
  }

  _saveFallback(text) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
