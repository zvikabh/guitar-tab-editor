/**
 * Test parsing files with unicode repeat markers (‖: and :‖).
 */

import { parseTabText } from '../../js/model/parser.js';
import { renderDocument } from '../../js/model/renderer.js';

describe('Parse file with unicode repeat markers', () => {
  test('parses Good Riddance intro with ‖: and :‖', () => {
    const input =
      'Good Riddance (Time of Your Life)\n' +
      'Green Day\n' +
      '\n' +
      '[Intro]\n' +
      '   G\n' +
      'e‖:------------------:‖\n' +
      'B‖:------------------:‖\n' +
      'G‖:-------0----------:‖\n' +
      'D‖:---------0--------:‖\n' +
      'A‖:------------------:‖\n' +
      'E‖:-3---3------------:‖\n';

    const doc = parseTabText(input);

    // Should have at least one tabrow block
    const tabRows = doc.blocks.filter(b => b.type === 'tabrow');
    expect(tabRows.length).toBeGreaterThanOrEqual(1);

    // The tab row should have notes
    const tabRow = tabRows[0];
    expect(tabRow.strings).toHaveLength(6);
  });

  test('parses full Good Riddance snippet', () => {
    const input =
      'Good Riddance (Time of Your Life)\n' +
      'Green Day\n' +
      '\n' +
      '[Intro]\n' +
      '   G\n' +
      'e‖:------------------:‖\n' +
      'B‖:------------------:‖\n' +
      'G‖:-------0----------:‖\n' +
      'D‖:---------0--------:‖\n' +
      'A‖:------------------:‖\n' +
      'E‖:-3---3------------:‖\n' +
      '\n' +
      '   G                                   Cadd9             D       \n' +
      'e|-----------------|-----------------|-----------------|------------------|\n' +
      'B|-------3---------|-------3---------|-------3---------|-------3----------|\n' +
      'G|---------0---0---|---------0---0---|---------0---0---|-----2---2---0----|\n' +
      'D|-----------0-----|-----0-----0-----|-----2-----2-----|-0---------0------|\n' +
      'A|-----------------|-----------------|-3---------------|------------------|\n' +
      'E|-3---3-----------|-3---------------|-----------------|------------------|\n';

    const doc = parseTabText(input);

    const tabRows = doc.blocks.filter(b => b.type === 'tabrow');
    expect(tabRows).toHaveLength(2);
  });

  test('roundtrip of unicode repeat markers', () => {
    const input =
      'e‖:-------0----------:‖\n' +
      'B‖:------------------:‖\n' +
      'G‖:------------------:‖\n' +
      'D‖:------------------:‖\n' +
      'A‖:------------------:‖\n' +
      'E‖:-3---3------------:‖\n';

    const doc = parseTabText(input);
    const text = renderDocument(doc);
    expect(text).toBe(input);
  });

  test('no extraneous space before last bar in Good Riddance second row', () => {
    const input =
      '   G                                   Cadd9             D          \n' +
      'e‖:-----------------|-----------------|-----------------|-----------------:‖\n' +
      'B‖:-------3---------|-------3---------|-------3---------|-------3---------:‖\n' +
      'G‖:---------0---0---|---------0---0---|---------0---0---|-----2---2---0---:‖\n' +
      'D‖:-----------0-----|-----0-----0-----|-----2-----2-----|-0---------0-----:‖\n' +
      'A‖:-----------------|-----------------|-3---------------|-----------------:‖\n' +
      'E‖:-3---3-----------|-3---------------|-----------------|-----------------:‖\n';

    const doc = parseTabText(input);
    const text = renderDocument(doc);

    // Should roundtrip exactly — no extraneous spaces
    expect(text).toBe(input);

    // Specifically check no space before the last bar section
    const eLine = text.split('\n').find(l => l.startsWith('e'));
    expect(eLine).not.toContain('| -');
    expect(eLine).not.toContain('| ');
  });
});
