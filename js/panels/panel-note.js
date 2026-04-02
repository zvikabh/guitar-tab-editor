/**
 * Note Edit panel: guitar fretboard schematic.
 * CSS Grid layout: 6 rows (strings) × columns (open + frets 1-24).
 * Clicking a cell inserts that note at the cursor position.
 */

const NUM_FRETS = 19; // Visible frets (scrollable to 24)
const MAX_FRETS = 24;

// Fret dot markers (standard guitar inlays)
const DOT_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_DOT_FRETS = [12, 24];

const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];

export class NotePanel {
  /**
   * @param {HTMLElement} containerEl - The #panel-note element
   * @param {Object} app - The app controller
   */
  constructor(containerEl, app) {
    this.containerEl = containerEl;
    this.app = app;
    this._built = false;
  }

  /**
   * Build the fretboard UI (called once).
   */
  build() {
    if (this._built) return;
    this._built = true;

    this.containerEl.innerHTML = '';

    // Left side: time signature controls
    const leftPanel = document.createElement('div');
    leftPanel.className = 'd-flex align-items-start gap-3';

    const tsControl = this._buildTimeSigControl();
    leftPanel.appendChild(tsControl);

    // Fretboard
    const fretboard = this._buildFretboard();
    leftPanel.appendChild(fretboard);

    this.containerEl.appendChild(leftPanel);
  }

  _buildTimeSigControl() {
    const div = document.createElement('div');
    div.className = 'time-sig-control p-2';
    div.innerHTML = `
      <div class="form-check form-check-sm mb-1">
        <input class="form-check-input" type="checkbox" id="tsEnabled">
        <label class="form-check-label small" for="tsEnabled">Time Sig</label>
      </div>
      <div class="d-flex gap-1 ts-inputs" style="opacity: 0.4">
        <input type="number" class="form-control form-control-sm" id="tsBeats" value="4" min="1" max="16" style="width:42px">
        <span class="align-self-center small">/</span>
        <select class="form-select form-select-sm" id="tsBeatValue" style="width:58px">
          <option value="4" selected>4</option>
          <option value="8">8</option>
          <option value="2">2</option>
        </select>
      </div>
    `;

    const checkbox = div.querySelector('#tsEnabled');
    const inputs = div.querySelector('.ts-inputs');
    const beatsInput = div.querySelector('#tsBeats');
    const beatValueSelect = div.querySelector('#tsBeatValue');

    const syncTimeSig = () => {
      inputs.style.opacity = checkbox.checked ? '1' : '0.4';
      this.app.timeSigEnabled = checkbox.checked;
      this.app.timeSigBeats = parseInt(beatsInput.value, 10) || 4;
      this.app.timeSigBeatValue = parseInt(beatValueSelect.value, 10) || 4;
    };

    checkbox.addEventListener('change', syncTimeSig);
    // Auto-enable checkbox when user modifies the numbers
    beatsInput.addEventListener('input', () => {
      checkbox.checked = true;
      syncTimeSig();
    });
    beatValueSelect.addEventListener('change', () => {
      checkbox.checked = true;
      syncTimeSig();
    });

    return div;
  }

  _buildFretboard() {
    const wrapper = document.createElement('div');
    wrapper.className = 'fretboard-wrapper flex-grow-1 overflow-x-auto';

    const grid = document.createElement('div');
    grid.className = 'fretboard-grid';
    grid.style.display = 'grid';
    // +1 column for the label, then MAX_FRETS fret cells
    grid.style.gridTemplateColumns = `32px repeat(${MAX_FRETS}, 1fr)`;
    grid.style.gridTemplateRows = 'repeat(7, auto)'; // 6 strings + 1 fret numbers row
    grid.style.gap = '0';
    grid.style.minWidth = `${MAX_FRETS * 40 + 32}px`;

    // Build cells: 6 strings × (label + 24 frets)
    for (let s = 0; s < 6; s++) {
      // String label — clicking it produces fret 0 (open string)
      const label = document.createElement('div');
      label.className = 'fret-label';
      label.textContent = STRING_NAMES[s];
      label.style.cursor = 'pointer';
      label.title = `Open ${STRING_NAMES[s]} string (fret 0)`;
      label.addEventListener('click', (e) => this._onFretClick(s, 0, e));
      grid.appendChild(label);

      // Fret cells: f=0 is fret 1, f=1 is fret 2, etc.
      for (let f = 0; f < MAX_FRETS; f++) {
        const fretNum = f + 1; // fret 1-based
        const cell = document.createElement('div');
        cell.className = 'fret-cell';
        cell.dataset.string = s;
        cell.dataset.fret = fretNum;

        // String visualization
        const stringLine = document.createElement('div');
        stringLine.className = `string-line string-${s}`;
        cell.appendChild(stringLine);

        cell.addEventListener('click', (e) => this._onFretClick(s, fretNum, e));
        grid.appendChild(cell);
      }
    }

    // Fret number row below the grid: 0 under label, 1..N under frets
    const zeroCell = document.createElement('div');
    zeroCell.className = 'fret-number-cell';
    zeroCell.textContent = '0';
    grid.appendChild(zeroCell);
    for (let f = 0; f < MAX_FRETS; f++) {
      const fretNum = f + 1;
      const numCell = document.createElement('div');
      numCell.className = 'fret-number-cell';
      if (fretNum <= 12 || fretNum % 2 === 0) {
        numCell.textContent = fretNum;
      }
      grid.appendChild(numCell);
    }

    wrapper.appendChild(grid);
    return wrapper;
  }

  _onFretClick(stringIdx, fret, event) {
    // Set chord mode based on shift BEFORE calling insertFret
    this.app.chordMode = !!(event && event.shiftKey);

    const mode = this.app.getActiveMode();
    if (mode && mode.insertFret) {
      mode.insertFret(stringIdx, fret);
    }

    document.getElementById('tab-editor')?.focus();
  }

  /**
   * Highlight the notes currently under the cursor.
   * @param {(string|null)[]} notes - 6-element array of current notes
   */
  highlightNotes(notes) {
    // Clear existing highlights
    this.containerEl.querySelectorAll('.fret-cell.active').forEach(el => {
      el.classList.remove('active');
    });

    if (!notes) return;

    for (let s = 0; s < 6; s++) {
      const note = notes[s];
      if (note && /^\d+$/.test(note)) {
        const fret = parseInt(note, 10);
        const cell = this.containerEl.querySelector(
          `.fret-cell[data-string="${s}"][data-fret="${fret}"]`
        );
        if (cell) cell.classList.add('active');
      }
    }
  }
}
