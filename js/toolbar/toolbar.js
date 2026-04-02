/**
 * Toolbar: initializes button bindings and manages toolbar state.
 */

import { shortcutLabel } from '../utils/platform.js';

export class Toolbar {
  /**
   * @param {Object} app - The app controller
   */
  constructor(app) {
    this.app = app;
    this._initTooltips();
    this._bindModeSelector();
    this._bindFileButtons();
    this._bindUndoRedo();
    this._bindNoteLength();
    this._bindInsertButtons();
  }

  _initTooltips() {
    const tips = {
      modeRaw: 'Raw Edit — edit as plain text',
      modeNote: 'Note Edit — click frets to add notes',
      modeFingerpick: 'Fingerpick Edit — select chord, then pluck strings',
      btnOpen: `Open File (${shortcutLabel('O')})`,
      btnSave: `Save File (${shortcutLabel('S')})`,
      btnUndo: `Undo (${shortcutLabel('Z')})`,
      btnRedo: `Redo (${shortcutLabel('Shift+Z')})`,
      len16: 'Sixteenth note (1/16)',
      len8: 'Eighth note (1/8)',
      len4: 'Quarter note (1/4)',
      len2: 'Half note (1/2)',
      btnBar: 'Add Bar Line',
      btnRepeatStart: 'Add Repeat Start ‖:',
      btnRepeatEnd: 'Add Repeat End :‖',
      btnRest: 'Add Rest (Space)',
      btnChord: 'Chord Mode — add multiple notes at same position (Shift+Click)',
    };

    for (const [id, tip] of Object.entries(tips)) {
      let el = document.getElementById(id);
      if (!el) continue;
      // For radio inputs, put tooltip on the label instead
      if (el.tagName === 'INPUT' && el.type === 'radio') {
        el = document.querySelector(`label[for="${id}"]`);
        if (!el) continue;
      }
      el.title = tip;
      el.setAttribute('data-bs-toggle', 'tooltip');
      el.setAttribute('data-bs-placement', 'bottom');
    }

    // Initialize Bootstrap tooltips
    const tooltipEls = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipEls.forEach(el => new bootstrap.Tooltip(el));
  }

  _bindModeSelector() {
    const radios = document.querySelectorAll('input[name="editMode"]');
    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.app.setMode(e.target.value);
      });
    });
  }

  _bindFileButtons() {
    document.getElementById('btnOpen').addEventListener('click', () => this.app.open());
    document.getElementById('btnSave').addEventListener('click', () => this.app.save());
  }

  _bindUndoRedo() {
    document.getElementById('btnUndo').addEventListener('click', () => this.app.undo());
    document.getElementById('btnRedo').addEventListener('click', () => this.app.redo());
  }

  _bindNoteLength() {
    const radios = document.querySelectorAll('input[name="noteLength"]');
    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.app.noteLength = e.target.value;
      });
    });
  }

  _bindInsertButtons() {
    document.getElementById('btnBar')?.addEventListener('click', () => this.app.insertBar());
    document.getElementById('btnRepeatStart')?.addEventListener('click', () => this.app.insertRepeatStart());
    document.getElementById('btnRepeatEnd')?.addEventListener('click', () => this.app.insertRepeatEnd());
    document.getElementById('btnRest')?.addEventListener('click', () => this.app.insertRest());
    document.getElementById('btnChord')?.addEventListener('click', () => this.app.toggleChordMode());
  }

  /**
   * Update undo/redo button disabled state.
   */
  updateUndoRedoButtons() {
    document.getElementById('btnUndo').disabled = !this.app.undoManager.canUndo();
    document.getElementById('btnRedo').disabled = !this.app.undoManager.canRedo();
  }

  /**
   * Update mode-dependent button visibility.
   * @param {string} mode - 'raw', 'note', or 'fingerpick'
   */
  updateModeButtons(mode) {
    const modeDependent = document.querySelectorAll('.mode-dependent');
    if (mode === 'raw') {
      modeDependent.forEach(el => el.classList.add('disabled-mode'));
    } else {
      modeDependent.forEach(el => el.classList.remove('disabled-mode'));
    }

    // Show the correct panel
    document.querySelectorAll('.panel-content').forEach(el => el.classList.add('d-none'));
    const panelId = `panel-${mode}`;
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.remove('d-none');
  }
}
