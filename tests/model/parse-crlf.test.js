/**
 * Test that CRLF line endings (Windows) are handled correctly.
 */

import { parseTabText } from '../../js/model/parser.js';
import { renderDocument } from '../../js/model/renderer.js';

describe('CRLF line endings', () => {
  test('tab file with CRLF line endings parses correctly', () => {
    const input =
      'Song Title\r\n' +
      'Artist\r\n' +
      '\r\n' +
      '   Am\r\n' +
      'e|---0---|\r\n' +
      'B|---1---|\r\n' +
      'G|---2---|\r\n' +
      'D|---2---|\r\n' +
      'A|---0---|\r\n' +
      'E|-------|\r\n' +
      '   hello\r\n';

    const doc = parseTabText(input);

    // Should find at least one tab row
    const tabRows = doc.blocks.filter(b => b.type === 'tabrow');
    expect(tabRows).toHaveLength(1);

    // Tab row should have the note
    expect(tabRows[0].strings[0]).toContain('0');

    // Pre-line should have chord name
    expect(tabRows[0].preLines[0].trim()).toBe('Am');

    // Post-line should have lyrics
    expect(tabRows[0].postLines[0].trim()).toBe('hello');
  });

  test('D.txt with CRLF parses as tab not text', () => {
    const input =
      '\r\n' +
      '   D              D            \r\n' +
      'e|-------2-----‖:-------2-----:‖\r\n' +
      'B|-----3---3---‖:-----3---3---:‖\r\n' +
      'G|---2-------2-‖:---2-------2-:‖\r\n' +
      'D|-0-----------‖:-0-----------:‖\r\n' +
      'A|-------------‖:-------------:‖\r\n' +
      'E|-------------‖:-------------:‖\r\n' +
      '   1 . 2 . 3 .    1 . 2 . 3 .  \r\n' +
      '\r\n';

    const doc = parseTabText(input);

    const tabRows = doc.blocks.filter(b => b.type === 'tabrow');
    expect(tabRows).toHaveLength(1);
    expect(tabRows[0].strings[0]).toContain('2');
  });

  test('roundtrip with CRLF produces LF output', () => {
    const input =
      'e|---0---|\r\n' +
      'B|---1---|\r\n' +
      'G|---2---|\r\n' +
      'D|---2---|\r\n' +
      'A|---0---|\r\n' +
      'E|-------|\r\n';

    const doc = parseTabText(input);
    const output = renderDocument(doc);

    // Output should use LF, not CRLF
    expect(output).not.toContain('\r');
    // Should still roundtrip the content
    expect(output).toContain('e|---0---|');
  });
});
