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
   * Save text to file.
   * @param {string} text
   */
  async save(text) {
    if (this.fileHandle) {
      return this._saveFSA(text);
    }
    return this._saveFallback(text);
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

  async _saveFSA(text) {
    try {
      const writable = await this.fileHandle.createWritable();
      await writable.write(text);
      await writable.close();
    } catch (e) {
      // Fall back to download if write fails
      this._saveFallback(text);
    }
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
