# Guitar Tab Editor

A web application for writing and editing guitar tablature files. Loads and saves tab text files.

Edit modes:
- **Raw Edit** — edit the tab as plain text
- **Note Edit** — note-by-note editing with a guitar fretboard panel
- **Fingerpick Edit** — chord-based entry with a chord table and string selector

## Local setup

```bash
# Clone the repository
git clone https://github.com/zvikabh/guitar-tab-editor.git
cd guitar-tab-editor

# Install dev dependencies (for testing only)
npm install
```

## Running locally

Since there's no build step, you can serve the files directly with any static server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js (npx)
npx serve .

# Then open http://localhost:8000 in your browser
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npx jest --watch

# Run a specific test file
npx jest tests/model/parser.test.js
```

Tests use Jest with `--experimental-vm-modules` for ES module support.
