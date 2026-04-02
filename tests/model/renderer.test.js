import { renderDocument } from '../../js/model/renderer.js';
import { createDocument, createTextBlock, createTabRowBlock } from '../../js/model/document.js';

describe('renderDocument', () => {
  test('renders a simple text block', () => {
    const doc = createDocument([
      createTextBlock(['Hello World', 'Line 2']),
    ]);

    const result = renderDocument(doc);
    expect(result).toBe('Hello World\nLine 2\n');
  });

  test('renders a simple tab row block', () => {
    const doc = createDocument([
      createTabRowBlock({
        strings: [
          '---0---|',
          '---1---|',
          '---0---|',
          '---2---|',
          '---3---|',
          '-------|',
        ],
      }),
    ]);

    const result = renderDocument(doc);
    const lines = result.split('\n');
    expect(lines[0]).toBe('e|---0---|');
    expect(lines[1]).toBe('B|---1---|');
    expect(lines[5]).toBe('E|-------|');
  });

  test('renders tab row with pre-lines and post-lines', () => {
    const doc = createDocument([
      createTabRowBlock({
        preLines: ['   Am              G'],
        strings: [
          '---0---0---|---3---3---|',
          '---1---1---|---0---0---|',
          '---2---2---|---0---0---|',
          '---2---2---|---0---0---|',
          '---0---0---|---2---2---|',
          '-----------|---3---3---|',
        ],
        postLines: ['   hello    world'],
      }),
    ]);

    const result = renderDocument(doc);
    const lines = result.split('\n');
    expect(lines[0]).toBe('   Am              G');
    expect(lines[1]).toBe('e|---0---0---|---3---3---|');
    expect(lines[7]).toBe('   hello    world');
  });

  test('renders right annotations', () => {
    const doc = createDocument([
      createTabRowBlock({
        strings: [
          '---0---0---|',
          '---1---1---|',
          '---2---2---|',
          '---2---2---|',
          '---0---0---|',
          '-----------|',
        ],
        rightAnnotations: ['', '', '', 'x2', '', ''],
      }),
    ]);

    const result = renderDocument(doc);
    const lines = result.split('\n');
    expect(lines[3]).toBe('D|---2---2---| x2');
    expect(lines[0]).toBe('e|---0---0---|');
  });

  test('renders multiple right annotations on different strings', () => {
    const doc = createDocument([
      createTabRowBlock({
        strings: [
          '---0---|',
          '---1---|',
          '---2---|',
          '---2---|',
          '---0---|',
          '-------|',
        ],
        rightAnnotations: ['', '', 'x3', '(short)', '', ''],
      }),
    ]);

    const result = renderDocument(doc);
    const lines = result.split('\n');
    expect(lines[2]).toBe('G|---2---| x3');
    expect(lines[3]).toBe('D|---2---| (short)');
  });

  test('renders alternate tuning labels', () => {
    const doc = createDocument([
      createTabRowBlock({
        strings: [
          '---0---|',
          '---1---|',
          '---0---|',
          '---2---|',
          '---3---|',
          '---0---|',
        ],
        labels: ['e', 'B', 'G', 'D', 'A', 'D'],
      }),
    ]);

    const result = renderDocument(doc);
    const lines = result.split('\n');
    expect(lines[5]).toBe('D|---0---|');
    expect(lines[0]).toBe('e|---0---|');
  });

  test('renders mixed text and tab blocks', () => {
    const doc = createDocument([
      createTextBlock(['Test Song', 'Test Artist', '']),
      createTextBlock(['[Verse]']),
      createTabRowBlock({
        preLines: ['   Am'],
        strings: [
          '---0---|',
          '---1---|',
          '---2---|',
          '---2---|',
          '---0---|',
          '-------|',
        ],
        postLines: ['   hello'],
      }),
      createTextBlock(['']),
    ]);

    const result = renderDocument(doc);
    expect(result).toContain('Test Song');
    expect(result).toContain('[Verse]');
    expect(result).toContain('   Am');
    expect(result).toContain('e|---0---|');
    expect(result).toContain('   hello');
  });
});
