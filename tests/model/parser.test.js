import { parseTabText } from '../../js/model/parser.js';

describe('parseTabText', () => {
  describe('basic tab row detection', () => {
    test('parses a simple labeled tab row', () => {
      const text = [
        'e|---0---1---|',
        'B|---1---0---|',
        'G|---0---0---|',
        'D|---2---2---|',
        'A|---3---3---|',
        'E|-----------|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.blocks).toHaveLength(1);
      expect(doc.blocks[0].type).toBe('tabrow');
      expect(doc.blocks[0].strings).toHaveLength(6);
      expect(doc.blocks[0].labels).toEqual(['e', 'B', 'G', 'D', 'A', 'E']);
    });

    test('parses unlabeled tab lines starting with |', () => {
      const text = [
        '|---0---1---|',
        '|---1---0---|',
        '|---0---0---|',
        '|---2---2---|',
        '|---3---3---|',
        '|-----------|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.blocks).toHaveLength(1);
      expect(doc.blocks[0].type).toBe('tabrow');
      // Default labels assumed for unlabeled
      expect(doc.blocks[0].labels).toEqual(['e', 'B', 'G', 'D', 'A', 'E']);
    });

    test('parses tab lines without trailing pipe', () => {
      const text = [
        'e|---0---1---',
        'B|---1---0---',
        'G|---0---0---',
        'D|---2---2---',
        'A|---3---3---',
        'E|-----------',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.blocks).toHaveLength(1);
      expect(doc.blocks[0].type).toBe('tabrow');
    });
  });

  describe('alternate tunings', () => {
    test('accepts non-standard string labels (drop D)', () => {
      const text = [
        'e|---0---|',
        'B|---1---|',
        'G|---0---|',
        'D|---2---|',
        'A|---3---|',
        'D|---0---|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.blocks).toHaveLength(1);
      expect(doc.blocks[0].type).toBe('tabrow');
      expect(doc.blocks[0].labels[5]).toBe('D');
    });

    test('accepts accidental in string label', () => {
      const text = [
        'e|---0---|',
        'B|---1---|',
        'G|---0---|',
        'D|---2---|',
        'A|---3---|',
        'C#|--0---|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.blocks).toHaveLength(1);
      expect(doc.blocks[0].labels[5]).toBe('C#');
    });
  });

  describe('pre-lines and post-lines', () => {
    test('collects chord line above tab row', () => {
      const text = [
        '   Am              G',
        'e|---0---0---0---|---3---3---|',
        'B|---1---1---1---|---0---0---|',
        'G|---2---2---2---|---0---0---|',
        'D|---2---2---2---|---0---0---|',
        'A|---0---0---0---|---2---2---|',
        'E|---------------|---3---3---|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.blocks).toHaveLength(1);
      expect(doc.blocks[0].type).toBe('tabrow');
      expect(doc.blocks[0].preLines).toEqual(['   Am              G']);
    });

    test('collects lyric line below tab row', () => {
      const text = [
        'e|---0---0---|',
        'B|---1---1---|',
        'G|---2---2---|',
        'D|---2---2---|',
        'A|---0---0---|',
        'E|-----------|',
        '   hello world',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.blocks[0].postLines).toEqual(['   hello world']);
    });

    test('collects timing line below tab row', () => {
      const text = [
        'e|---0---0---0---0---|',
        'B|---1---1---1---1---|',
        'G|---2---2---2---2---|',
        'D|---2---2---2---2---|',
        'A|---0---0---0---0---|',
        'E|-------------------|',
        ' | 1 + 2 + 3 + 4 + |',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.blocks[0].postLines).toEqual([' | 1 + 2 + 3 + 4 + |']);
    });

    test('stops collecting pre/post at blank line', () => {
      const text = [
        'Song Title',
        '',
        '   Am',
        'e|---0---|',
        'B|---1---|',
        'G|---2---|',
        'D|---2---|',
        'A|---0---|',
        'E|-------|',
        '   lyrics here',
        '',
        'Some other text',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      // "Song Title" and blank line are text blocks
      // "   Am" is preLine, "   lyrics here" is postLine
      // Blank line and "Some other text" are separate text blocks
      const tabBlock = doc.blocks.find(b => b.type === 'tabrow');
      expect(tabBlock.preLines).toEqual(['   Am']);
      expect(tabBlock.postLines).toEqual(['   lyrics here']);
    });

    test('collects both chord and lyric lines with correct ordering', () => {
      const text = [
        '   C              G',
        'e|---0---0---0---|---3---3---|',
        'B|---1---1---1---|---0---0---|',
        'G|---0---0---0---|---0---0---|',
        'D|---2---2---2---|---0---0---|',
        'A|---3---3---3---|---2---2---|',
        'E|---------------|---3---3---|',
        '   singing a     song today',
        ' | 1 + 2 + 3 + 4 + | 1 + 2 + 3 + 4 + |',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      const tabBlock = doc.blocks.find(b => b.type === 'tabrow');
      expect(tabBlock.preLines).toEqual(['   C              G']);
      expect(tabBlock.postLines).toHaveLength(2);
      expect(tabBlock.postLines[0]).toBe('   singing a     song today');
    });
  });

  describe('right annotations', () => {
    test('extracts annotation after final pipe', () => {
      const text = [
        'e|---0---0---0---0---0---|',
        'B|---1---1---1---1---1---|',
        'G|---2---2---2---2---2---|',
        'D|---2---2---2---2---2---| x2',
        'A|---0---0---0---0---0---|',
        'E|-----------------------|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      const block = doc.blocks[0];
      expect(block.rightAnnotations[0]).toBe('');
      expect(block.rightAnnotations[3]).toBe('x2');
    });

    test('extracts multiple annotations on different strings', () => {
      const text = [
        'e|---0---0---0---|',
        'B|---1---1---1---|',
        'G|---2---2---2---| x3',
        'D|---2---2---2---| (repeat)',
        'A|---0---0---0---|',
        'E|---------------|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      const block = doc.blocks[0];
      expect(block.rightAnnotations[2]).toBe('x3');
      expect(block.rightAnnotations[3]).toBe('(repeat)');
    });

    test('extracts annotation from line without trailing pipe via whitespace', () => {
      const text = [
        'e|---0---0---0---0-',
        'B|---1---1---1---1-',
        'G|---2---2---2---2-',
        'D|---2---2---2---2-  x2',
        'A|---0---0---0---0-',
        'E|-----------------',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      const block = doc.blocks[0];
      expect(block.rightAnnotations[3]).toBe('x2');
    });
  });

  describe('text blocks', () => {
    test('parses title and artist as text blocks', () => {
      const text = [
        'My Test Song',
        'By Test Artist',
        '',
        'e|---0---|',
        'B|---1---|',
        'G|---2---|',
        'D|---2---|',
        'A|---0---|',
        'E|-------|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      // First block should be text with title and artist
      expect(doc.blocks[0].type).toBe('text');
      expect(doc.blocks[0].lines).toContain('My Test Song');
      expect(doc.blocks[0].lines).toContain('By Test Artist');
    });

    test('section headers stay as text blocks', () => {
      const text = [
        '[Verse 1]',
        '   Am',
        'e|---0---|',
        'B|---1---|',
        'G|---2---|',
        'D|---2---|',
        'A|---0---|',
        'E|-------|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      // [Verse 1] should be a text block (not consumed as preLine since
      // the chord line "   Am" is between it and the tab)
      // Actually, [Verse 1] and Am are both adjacent non-blank lines before the tab.
      // Both should be preLines.
      const tabBlock = doc.blocks.find(b => b.type === 'tabrow');
      expect(tabBlock.preLines).toContain('[Verse 1]');
      expect(tabBlock.preLines).toContain('   Am');
    });

    test('standalone chord+lyric lines become text blocks', () => {
      const text = [
        'Am           G',
        '  Hello darkness my old friend',
        '',
        'e|---0---|',
        'B|---1---|',
        'G|---2---|',
        'D|---2---|',
        'A|---0---|',
        'E|-------|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      // The chord+lyric lines are separated from the tab by a blank line,
      // so they should be a text block
      const textBlocks = doc.blocks.filter(b => b.type === 'text');
      expect(textBlocks.length).toBeGreaterThanOrEqual(1);
      const firstText = textBlocks[0];
      expect(firstText.lines).toContain('Am           G');
    });

    test('preserves blank lines as text blocks', () => {
      const text = [
        'Title',
        '',
        '',
        'e|---0---|',
        'B|---1---|',
        'G|---2---|',
        'D|---2---|',
        'A|---0---|',
        'E|-------|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      // Should have text block with title and blank lines before the tab row
      const textBlocks = doc.blocks.filter(b => b.type === 'text');
      expect(textBlocks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('multiple tab rows', () => {
    test('parses consecutive tab rows separated by blank line', () => {
      const text = [
        'e|---0---|',
        'B|---1---|',
        'G|---0---|',
        'D|---2---|',
        'A|---3---|',
        'E|-------|',
        '',
        'e|---3---|',
        'B|---0---|',
        'G|---0---|',
        'D|---0---|',
        'A|---2---|',
        'E|---3---|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      const tabRows = doc.blocks.filter(b => b.type === 'tabrow');
      expect(tabRows).toHaveLength(2);
    });
  });

  describe('techniques and special notation', () => {
    test('handles hammer-on notation (h)', () => {
      const text = [
        'e|---0h2---|',
        'B|---1-----|',
        'G|---0-----|',
        'D|---2-----|',
        'A|---3-----|',
        'E|---------|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.blocks[0].type).toBe('tabrow');
      expect(doc.blocks[0].strings[0]).toContain('0h2');
    });

    test('handles pull-off notation (p)', () => {
      const text = [
        'e|---1p0---|',
        'B|---1-----|',
        'G|---0-----|',
        'D|---2-----|',
        'A|---3-----|',
        'E|---------|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.blocks[0].strings[0]).toContain('1p0');
    });

    test('handles repeat signs on subset of strings', () => {
      const text = [
        'e|-----------------|',
        'B|:1---------1-----|',
        'G|-------0-------0-|',
        'D|-----2-------2---|',
        'A|:3-------3-------|',
        'E|-----------------|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      const block = doc.blocks[0];
      expect(block.strings[1]).toContain(':');
      expect(block.strings[4]).toContain(':');
    });
  });

  describe('section header with annotation', () => {
    test('preserves section header annotations like [Chorus] (all we are)', () => {
      const text = [
        '[Chorus] (all we are)',
        '',
        'e|---0---|',
        'B|---1---|',
        'G|---2---|',
        'D|---2---|',
        'A|---0---|',
        'E|-------|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      const textBlock = doc.blocks.find(b =>
        b.type === 'text' && b.lines.some(l => l.includes('[Chorus]'))
      );
      expect(textBlock).toBeTruthy();
      expect(textBlock.lines[0]).toBe('[Chorus] (all we are)');
    });
  });

  describe('style inference', () => {
    test('infers chord line in pre position', () => {
      const text = [
        '   Am',
        'e|---0---|',
        'B|---1---|',
        'G|---2---|',
        'D|---2---|',
        'A|---0---|',
        'E|-------|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.style.preLineTypes).toContain('chord');
    });

    test('infers lyric line in post position', () => {
      const text = [
        'e|---0---|',
        'B|---1---|',
        'G|---2---|',
        'D|---2---|',
        'A|---0---|',
        'E|-------|',
        '   hello world',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.style.postLineTypes).toContain('lyric');
    });

    test('infers timing line in post position', () => {
      const text = [
        'e|---0---0---0---0---|',
        'B|---1---1---1---1---|',
        'G|---2---2---2---2---|',
        'D|---2---2---2---2---|',
        'A|---0---0---0---0---|',
        'E|-------------------|',
        ' | 1 + 2 + 3 + 4 + |',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.style.postLineTypes).toContain('timing');
    });

    test('infers blank lines between rows', () => {
      const text = [
        'e|---0---|',
        'B|---1---|',
        'G|---0---|',
        'D|---2---|',
        'A|---3---|',
        'E|-------|',
        '',
        '',
        'e|---3---|',
        'B|---0---|',
        'G|---0---|',
        'D|---0---|',
        'A|---2---|',
        'E|---3---|',
      ].join('\n') + '\n';

      const doc = parseTabText(text);
      expect(doc.style.blankLinesBetweenRows).toBe(2);
    });
  });

  describe('complex document', () => {
    test('parses a full song-like structure', () => {
      const text = [
        'Test Song',
        'Test Artist',
        'Capo 3',
        '',
        '[Intro]',
        '',
        '   C              G',
        'e|---0-------0---|---3-------3---|',
        'B|-----1-------1-|-----0-------0-|',
        'G|-------0---0---|-------0---0---|',
        'D|-----2-------2-|-----0-------0-|',
        'A|-3-------3-----|-----2-------2-|',
        'E|---------------|-3-------3-----|',
        '',
        '[Verse]',
        '   Am             G',
        'e|---0-------0---|---3-------3---|',
        'B|-----1-------1-|-----0-------0-|',
        'G|-------2---2---|-------0---0---|',
        'D|-----2-------2-|-----0-------0-|',
        'A|-0-------0-----|-----2-------2-|',
        'E|---------------|-3-------3-----|',
        '   here are some   words to sing',
      ].join('\n') + '\n';

      const doc = parseTabText(text);

      // Should have text blocks and tab rows
      const textBlocks = doc.blocks.filter(b => b.type === 'text');
      const tabRows = doc.blocks.filter(b => b.type === 'tabrow');

      expect(tabRows).toHaveLength(2);

      // First tab row has chord pre-line
      expect(tabRows[0].preLines.some(l => l.includes('C'))).toBe(true);

      // Second tab row has chord pre-line and lyric post-line
      expect(tabRows[1].preLines.some(l => l.includes('Am'))).toBe(true);
      expect(tabRows[1].postLines.some(l => l.includes('words'))).toBe(true);
    });
  });
});
