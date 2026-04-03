/**
 * Fingerpick Edit panel: chord table + custom chord textbox + mini string schematic.
 */

import { CHORD_TABLE, CHORD_TABLE_COLUMNS, CHORD_DB, EXTENDED_CHORDS, lookupChord } from '../model/chords.js';

const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];

export class FingerpickPanel {
  constructor(containerEl, app) {
    this.containerEl = containerEl;
    this.app = app;
    this._built = false;
    this.activeChord = null; // { name, frets }
    this._chordTableEl = null;
    this._miniStringsEl = null;
    this._customInput = null;
  }

  build() {
    if (this._built) return;
    this._built = true;
    this.containerEl.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'd-flex align-items-start gap-3';

    // 1. Time signature (flush left)
    wrapper.appendChild(this._buildTimeSigControl());

    // 2. Centered group: schematic + custom input + chord table
    const centerGroup = document.createElement('div');
    centerGroup.className = 'd-flex align-items-start gap-3 mx-auto';

    this._miniStringsEl = this._buildMiniStrings();
    centerGroup.appendChild(this._miniStringsEl);
    this._chordTableEl = this._buildChordTable();
    centerGroup.appendChild(this._chordTableEl);

    wrapper.appendChild(centerGroup);

    this.containerEl.appendChild(wrapper);
  }

  _buildTimeSigControl() {
    const div = document.createElement('div');
    div.className = 'time-sig-control p-2';
    div.innerHTML = `
      <div class="form-check form-check-sm mb-1">
        <input class="form-check-input" type="checkbox" id="tsFpEnabled">
        <label class="form-check-label small" for="tsFpEnabled">Time Sig</label>
      </div>
      <div class="d-flex gap-1 ts-inputs" style="opacity: 0.4">
        <input type="number" class="form-control form-control-sm" id="tsFpBeats" value="4" min="1" max="16" style="width:42px">
        <span class="align-self-center small">/</span>
        <select class="form-select form-select-sm" id="tsFpBeatValue" style="width:58px">
          <option value="4" selected>4</option>
          <option value="8">8</option>
          <option value="2">2</option>
        </select>
      </div>
    `;
    const checkbox = div.querySelector('#tsFpEnabled');
    const inputs = div.querySelector('.ts-inputs');
    const beatsInput = div.querySelector('#tsFpBeats');
    const beatValueSelect = div.querySelector('#tsFpBeatValue');

    const syncTimeSig = () => {
      inputs.style.opacity = checkbox.checked ? '1' : '0.4';
      this.app.timeSigEnabled = checkbox.checked;
      this.app.timeSigBeats = parseInt(beatsInput.value, 10) || 4;
      this.app.timeSigBeatValue = parseInt(beatValueSelect.value, 10) || 4;
    };

    checkbox.addEventListener('change', syncTimeSig);
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

  _buildChordTable() {
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'chord-table-wrapper flex-grow-1 overflow-x-auto';

    const table = document.createElement('table');
    table.className = 'chord-table';

    // Data rows (no header — chords are self-explanatory)
    const tbody = document.createElement('tbody');
    // Determine which columns are "overflow" (sharp/flat roots)
    const overflowCols = new Set([1, 3, 6, 8, 10]); // C#, E♭, F#, A♭, B♭

    for (let row = 0; row < CHORD_TABLE.length; row++) {
      const tr = document.createElement('tr');
      for (let col = 0; col < CHORD_TABLE[row].length; col++) {
        const chordName = CHORD_TABLE[row][col];
        const td = document.createElement('td');

        if (chordName && CHORD_DB[chordName]) {
          td.textContent = chordName;
          td.className = 'chord-cell';
          td.dataset.chord = chordName;

          // Visual distinction for overflow cells (rows 3-4 in sharp/flat columns)
          if (row >= 2 && overflowCols.has(col)) {
            td.classList.add('chord-overflow');
          }

          td.addEventListener('click', () => this._selectChord(chordName));

          // Hover: show mini fretboard diagram
          td.addEventListener('mouseenter', () => {
            const chord = CHORD_DB[chordName];
            if (chord) {
              td.title = `${chordName}: ${chord.frets.map(f => f === null ? 'x' : f).join(' ')}`;
            }
          });
        } else {
          td.className = 'chord-cell chord-empty';
        }

        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableWrapper.appendChild(table);

    const tip = document.createElement('div');
    tip.className = 'chord-table-tip';
    tip.textContent = 'Tip: To select these or any other chords, start typing the chord name.';
    tableWrapper.appendChild(tip);

    return tableWrapper;
  }

  _buildMiniStrings() {
    const div = document.createElement('div');
    div.className = 'mini-strings-panel';

    // Horizontal chord diagram: strings are horizontal (matching tab layout),
    // frets are vertical columns. Rotated 90° from standard chord diagrams.
    const NUM_FRETS_SHOWN = 5;
    const svgNS = 'http://www.w3.org/2000/svg';
    const stringSpacing = 18;
    const fretSpacing = 28;
    const leftPad = 20; // space for open/muted markers left of nut
    const topPad = 10;
    const svgW = leftPad + NUM_FRETS_SHOWN * fretSpacing + 14;
    const svgH = topPad + 5 * stringSpacing + 22; // +22 for string number labels below

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', svgW);
    svg.setAttribute('height', svgH);
    svg.setAttribute('class', 'chord-diagram-svg');

    // Draw strings (horizontal lines) with varying widths
    const stringWidths = [1, 1.5, 2, 1, 2, 3]; // e,B,G,D,A,E
    const stringColors = ['#999', '#999', '#999', '#b8860b', '#b8860b', '#b8860b'];
    for (let s = 0; s < 6; s++) {
      const y = topPad + s * stringSpacing;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', leftPad);
      line.setAttribute('x2', leftPad + NUM_FRETS_SHOWN * fretSpacing);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', stringColors[s]);
      line.setAttribute('stroke-width', stringWidths[s]);
      svg.appendChild(line);
    }

    // Draw fret lines (vertical)
    const nutExtend = 5; // nut extends past top and bottom strings
    for (let f = 0; f <= NUM_FRETS_SHOWN; f++) {
      const x = leftPad + f * fretSpacing;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', x);
      line.setAttribute('x2', x);
      if (f === 0) {
        // Nut extends past the strings
        line.setAttribute('y1', topPad - nutExtend);
        line.setAttribute('y2', topPad + 5 * stringSpacing + nutExtend);
      } else {
        line.setAttribute('y1', topPad);
        line.setAttribute('y2', topPad + 5 * stringSpacing);
      }
      line.setAttribute('stroke', f === 0 ? '#333' : '#bbb');
      line.setAttribute('stroke-width', f === 0 ? 3 : 1);
      svg.appendChild(line);
    }

    // Clickable areas per string (full width, covers dots)
    // Left-click: insert note. Right-click: modify chord voicing.
    for (let s = 0; s < 6; s++) {
      const y = topPad + s * stringSpacing;
      const clickArea = document.createElementNS(svgNS, 'rect');
      clickArea.setAttribute('x', 0);
      clickArea.setAttribute('y', y - stringSpacing / 2);
      clickArea.setAttribute('width', svgW);
      clickArea.setAttribute('height', stringSpacing);
      clickArea.setAttribute('fill', 'transparent');
      clickArea.setAttribute('cursor', 'pointer');
      clickArea.addEventListener('click', (e) => this._onStringClick(s, e));
      clickArea.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._onStringRightClick(s, e);
      });
      svg.appendChild(clickArea);
    }

    // String number labels below
    for (let s = 0; s < 6; s++) {
      const y = topPad + s * stringSpacing;
      const numText = document.createElementNS(svgNS, 'text');
      numText.setAttribute('x', leftPad + NUM_FRETS_SHOWN * fretSpacing + 8);
      numText.setAttribute('y', y + 4);
      numText.setAttribute('text-anchor', 'middle');
      numText.setAttribute('font-size', '9');
      numText.setAttribute('fill', '#999');
      numText.textContent = s + 1;
      svg.appendChild(numText);
    }

    // Groups for dynamic content (pointer-events: none so clicks pass through to rects)
    const dotsGroup = document.createElementNS(svgNS, 'g');
    dotsGroup.setAttribute('class', 'chord-dots');
    dotsGroup.setAttribute('pointer-events', 'none');
    svg.appendChild(dotsGroup);

    const markersGroup = document.createElementNS(svgNS, 'g');
    markersGroup.setAttribute('class', 'chord-markers');
    markersGroup.setAttribute('pointer-events', 'none');
    svg.appendChild(markersGroup);

    // Prevent default context menu on the diagram
    svg.addEventListener('contextmenu', (e) => e.preventDefault());

    this._diagramSvg = svg;
    this._dotsGroup = dotsGroup;
    this._markersGroup = markersGroup;
    this._diagramParams = { stringSpacing, fretSpacing, leftPad, topPad, svgNS, numFrets: NUM_FRETS_SHOWN };

    // Chord name display
    const nameDisplay = document.createElement('div');
    nameDisplay.className = 'mini-chord-name text-center small fw-bold mt-1';
    nameDisplay.id = 'activeChordName';
    nameDisplay.textContent = '—';

    div.appendChild(svg);
    div.appendChild(nameDisplay);
    return div;
  }

  // --- Interaction ---

  _selectChord(chordName) {
    const chord = lookupChord(chordName);
    if (!chord) return;

    this.activeChord = chord;

    // Highlight selected cell
    this.containerEl.querySelectorAll('.chord-cell.active').forEach(el => el.classList.remove('active'));
    const cell = this.containerEl.querySelector(`.chord-cell[data-chord="${chordName}"]`);
    if (cell) cell.classList.add('active');

    // Update mini strings display
    this._updateMiniDiagram();

    // Update name display
    const nameEl = this.containerEl.querySelector('#activeChordName');
    if (nameEl) nameEl.textContent = chordName;

    // Refocus editor so keyboard shortcuts (1-6, arrows, etc.) work immediately
    document.getElementById('tab-editor')?.focus();
  }

  /**
   * Right-click on the chord diagram to modify the chord voicing for a string.
   * - Click on a fret position: set that string to that fret
   * - Click on the existing fret dot: set to open (0)
   * - Click on the open circle: set to muted (null)
   * - Click on the muted X: set to open (0)
   */
  _onStringRightClick(stringIdx, event) {
    // If no chord selected, create a blank one to start editing
    if (!this.activeChord) {
      this.activeChord = { name: 'Custom', frets: [null, null, null, null, null, null] };
    }

    const { fretSpacing, leftPad, numFrets } = this._diagramParams;
    const svgRect = this._diagramSvg.getBoundingClientRect();
    const clickX = event.clientX - svgRect.left;

    const currentFret = this.activeChord.frets[stringIdx];

    // Determine what was clicked based on X position
    if (clickX < leftPad) {
      // Clicked in the open/muted marker area (left of nut)
      if (currentFret === null) {
        // Muted → open
        this.activeChord.frets[stringIdx] = 0;
      } else if (currentFret === 0) {
        // Open → muted
        this.activeChord.frets[stringIdx] = null;
      } else {
        // Has a fret → open
        this.activeChord.frets[stringIdx] = 0;
      }
    } else {
      // Clicked on the fretboard — determine which fret
      const relX = clickX - leftPad;

      // Compute fret offset (for higher chords)
      const playedFrets = this.activeChord.frets.filter(f => f !== null && f > 0);
      const maxFret = playedFrets.length > 0 ? Math.max(...playedFrets) : 1;
      const minFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 1;
      const offset = maxFret <= numFrets ? 0 : minFret - 1;

      const clickedDisplayFret = Math.round(relX / fretSpacing + 0.5);
      const clickedFret = clickedDisplayFret + offset;

      if (clickedFret < 1 || clickedFret > 24) return;

      if (currentFret === clickedFret) {
        // Clicked on the existing fret → set to open
        this.activeChord.frets[stringIdx] = 0;
      } else {
        // Set to the clicked fret
        this.activeChord.frets[stringIdx] = clickedFret;
      }
    }

    // Reverse lookup BEFORE saving — find if the new voicing matches a known chord.
    // Don't save back to the original DB entry (that would corrupt the standard voicing).
    const matchedName = this._reverseLookupChord(this.activeChord.frets);

    // Refresh the diagram
    this._updateMiniDiagram();

    // Update name display and highlight
    const nameEl = this.containerEl.querySelector('#activeChordName');
    this.containerEl.querySelectorAll('.chord-cell.active').forEach(el => el.classList.remove('active'));

    if (matchedName && matchedName !== this.activeChord.name) {
      // Matches a different known chord
      this.activeChord.name = matchedName;
      if (nameEl) nameEl.textContent = matchedName;
      const cell = this.containerEl.querySelector(`.chord-cell[data-chord="${matchedName}"]`);
      if (cell) cell.classList.add('active');
    } else if (matchedName) {
      // Still matches the same chord (e.g., toggled back to original)
      if (nameEl) nameEl.textContent = matchedName;
      const cell = this.containerEl.querySelector(`.chord-cell[data-chord="${matchedName}"]`);
      if (cell) cell.classList.add('active');
    } else {
      // No match — show modified name
      if (nameEl) nameEl.textContent = this.activeChord.name + '*';
    }
  }

  _onStringClick(stringIdx, event) {
    if (!this.activeChord) {
      this._showMessage('Select a chord first, then click a string.');
      return;
    }

    const fret = this.activeChord.frets[stringIdx];
    if (fret === null) {
      this._showMessage(`String ${stringIdx + 1} is not played in ${this.activeChord.name}.`);
      return;
    }

    // Set chord mode based on shift BEFORE calling insertFret
    this.app.chordMode = !!(event && event.shiftKey);

    const mode = this.app.getActiveMode();
    if (mode && mode.insertFret) {
      mode.insertFret(stringIdx, fret);
    }

    document.getElementById('tab-editor')?.focus();
  }

  /** Reverse-lookup: find a chord name whose frets match the given voicing. */
  _reverseLookupChord(frets) {
    // Search table chords first (preferred names), then extended
    for (const db of [CHORD_DB, EXTENDED_CHORDS]) {
      for (const [name, chord] of Object.entries(db)) {
        if (chord.frets.length === 6 &&
            chord.frets.every((f, i) => f === frets[i])) {
          return name;
        }
      }
    }
    return null;
  }

  _updateMiniDiagram() {
    if (!this.activeChord || !this._dotsGroup) return;

    const { stringSpacing, fretSpacing, leftPad, topPad, svgNS, numFrets } = this._diagramParams;

    this._dotsGroup.innerHTML = '';
    this._markersGroup.innerHTML = '';

    const frets = this.activeChord.frets;

    // Determine fret offset for higher chords
    const playedFrets = frets.filter(f => f !== null && f > 0);
    const minFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 1;
    const maxFret = playedFrets.length > 0 ? Math.max(...playedFrets) : 1;
    const offset = maxFret <= numFrets ? 0 : minFret - 1;

    for (let s = 0; s < 6; s++) {
      const y = topPad + s * stringSpacing;
      const fret = frets[s];

      if (fret === null) {
        // X marker left of nut
        const marker = document.createElementNS(svgNS, 'text');
        marker.setAttribute('x', leftPad - 10);
        marker.setAttribute('y', y + 4);
        marker.setAttribute('text-anchor', 'middle');
        marker.setAttribute('font-size', '11');
        marker.setAttribute('fill', '#c00');
        marker.textContent = '×';
        this._markersGroup.appendChild(marker);
      } else if (fret === 0) {
        // Open string: circle left of nut
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', leftPad - 10);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', 4);
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#333');
        circle.setAttribute('stroke-width', 1.5);
        this._markersGroup.appendChild(circle);
      } else {
        // Filled dot at fret position (horizontal: x = fret column, y = string row)
        const displayFret = fret - offset;
        const x = leftPad + (displayFret - 0.5) * fretSpacing;
        const dot = document.createElementNS(svgNS, 'circle');
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y);
        dot.setAttribute('r', 6);
        dot.setAttribute('fill', '#333');
        this._dotsGroup.appendChild(dot);
      }
    }

    // Show fret number if offset > 0
    if (offset > 0) {
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', leftPad + fretSpacing / 2);
      label.setAttribute('y', topPad - 3);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', '#666');
      label.textContent = `${offset + 1}fr`;
      this._markersGroup.appendChild(label);
    }
  }

  /**
   * Handle keyboard shortcut 1-6 for string selection.
   * @param {number} stringNum - 1-6
   */
  onStringKey(stringNum) {
    this._onStringClick(stringNum - 1, null);
  }

  // --- Keyboard chord search dialog ---

  /**
   * Open the chord search dialog, pre-filled with an initial letter.
   * @param {string} initialChar - The letter that triggered the dialog (A-G)
   */
  showChordSearch(initialChar) {
    this._removeChordSearch();

    const overlay = document.createElement('div');
    overlay.className = 'chord-search-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'chord-search-dialog';

    const label = document.createElement('div');
    label.className = 'chord-search-label';
    label.textContent = 'Chord:';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'chord-search-input';
    input.value = initialChar.toUpperCase();
    input.placeholder = 'e.g. Am7, Dsus4';

    const hint = document.createElement('div');
    hint.className = 'chord-search-hint';
    hint.textContent = 'Press Enter to select, Escape to cancel';

    const matchDisplay = document.createElement('div');
    matchDisplay.className = 'chord-search-match';

    dialog.appendChild(label);
    dialog.appendChild(input);
    dialog.appendChild(matchDisplay);
    dialog.appendChild(hint);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    this._chordSearchOverlay = overlay;

    // Show initial match
    this._updateChordSearchMatch(input.value, matchDisplay);

    // Focus the input
    setTimeout(() => input.focus(), 0);

    input.addEventListener('input', () => {
      this._updateChordSearchMatch(input.value, matchDisplay);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const name = input.value.trim();
        if (name) {
          const chord = lookupChord(name);
          if (chord) {
            this._selectChord(chord.name);
          } else {
            // Unknown chord — prompt for frets
            this._removeChordSearch();
            this._promptCustomChord(name);
            return;
          }
        }
        this._removeChordSearch();
        document.getElementById('tab-editor')?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this._removeChordSearch();
        document.getElementById('tab-editor')?.focus();
      }
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this._removeChordSearch();
        document.getElementById('tab-editor')?.focus();
      }
    });
  }

  _updateChordSearchMatch(text, matchEl) {
    const name = text.trim();
    if (!name) {
      matchEl.textContent = '';
      return;
    }
    const chord = lookupChord(name);
    if (chord) {
      const fretStr = chord.frets.map(f => f === null ? 'x' : f).join(' ');
      matchEl.textContent = `${chord.name}: ${fretStr}`;
      matchEl.classList.remove('no-match');
    } else {
      // Try partial match across both databases
      const allChordNames = [...new Set([...Object.keys(CHORD_DB), ...Object.keys(EXTENDED_CHORDS)])];
      const partial = allChordNames.filter(k =>
        k.toLowerCase().startsWith(name.toLowerCase())
      );
      if (partial.length > 0) {
        matchEl.textContent = `Suggestions: ${partial.slice(0, 5).join(', ')}`;
        matchEl.classList.remove('no-match');
      } else if (name.length >= 2) {
        // The algorithmic generator can handle it — show an encouraging message
        matchEl.textContent = 'Press Enter to try generating this chord';
        matchEl.classList.remove('no-match');
      } else {
        matchEl.textContent = 'No match — Enter to define custom chord';
        matchEl.classList.add('no-match');
      }
    }
  }

  _promptCustomChord(name) {
    const input = prompt(
      `Chord "${name}" not found. Enter fret positions (e B G D A E), use x for unplayed:\n` +
      `Example: 0 1 2 2 0 x`
    );
    if (input) {
      const parts = input.trim().split(/\s+/);
      if (parts.length === 6) {
        const frets = parts.map(p => p === 'x' || p === 'X' ? null : parseInt(p, 10));
        if (frets.every(f => f === null || (!isNaN(f) && f >= 0 && f <= 24))) {
          EXTENDED_CHORDS[name] = { frets };
          this._selectChord(name);
          return;
        }
      }
      alert('Invalid fret positions. Use 6 space-separated numbers (0-24) or x.');
    }
  }

  _removeChordSearch() {
    if (this._chordSearchOverlay) {
      this._chordSearchOverlay.remove();
      this._chordSearchOverlay = null;
    }
  }

  _showMessage(msg) {
    // Show a brief toast-like message near the panel
    let toast = this.containerEl.querySelector('.fp-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'fp-toast';
      this.containerEl.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }
}
