import { parseTabText } from '../../js/model/parser.js';
import { renderDocument } from '../../js/model/renderer.js';

describe('roundtrip: parse → render', () => {
  function expectRoundtrip(input) {
    const doc = parseTabText(input);
    const output = renderDocument(doc);
    expect(output).toBe(input);
  }

  test('simple tab row roundtrips', () => {
    expectRoundtrip(
      'e|---0---1---|\n' +
      'B|---1---0---|\n' +
      'G|---0---0---|\n' +
      'D|---2---2---|\n' +
      'A|---3---3---|\n' +
      'E|-----------|\n'
    );
  });

  test('tab row with chord pre-line roundtrips', () => {
    expectRoundtrip(
      '   Am              G\n' +
      'e|---0---0---0---|---3---3---|\n' +
      'B|---1---1---1---|---0---0---|\n' +
      'G|---2---2---2---|---0---0---|\n' +
      'D|---2---2---2---|---0---0---|\n' +
      'A|---0---0---0---|---2---2---|\n' +
      'E|---------------|---3---3---|\n'
    );
  });

  test('tab row with lyric post-line roundtrips', () => {
    expectRoundtrip(
      'e|---0---0---|\n' +
      'B|---1---1---|\n' +
      'G|---2---2---|\n' +
      'D|---2---2---|\n' +
      'A|---0---0---|\n' +
      'E|-----------|\n' +
      '   hello world\n'
    );
  });

  test('tab row with timing post-line roundtrips', () => {
    expectRoundtrip(
      'e|---0---0---0---0---|\n' +
      'B|---1---1---1---1---|\n' +
      'G|---2---2---2---2---|\n' +
      'D|---2---2---2---2---|\n' +
      'A|---0---0---0---0---|\n' +
      'E|-------------------|\n' +
      ' | 1 + 2 + 3 + 4 + |\n'
    );
  });

  test('tab row with right annotation roundtrips', () => {
    expectRoundtrip(
      'e|---0---0---0---|\n' +
      'B|---1---1---1---|\n' +
      'G|---2---2---2---|\n' +
      'D|---2---2---2---| x2\n' +
      'A|---0---0---0---|\n' +
      'E|---------------|\n'
    );
  });

  test('tab row with multiple right annotations roundtrips', () => {
    expectRoundtrip(
      'e|---0---0---|\n' +
      'B|---1---1---|\n' +
      'G|---2---2---| x3\n' +
      'D|---2---2---| (repeat)\n' +
      'A|---0---0---|\n' +
      'E|-----------|\n'
    );
  });

  test('full song-like document roundtrips', () => {
    expectRoundtrip(
      'Test Song\n' +
      'Test Artist\n' +
      'Capo 3\n' +
      '\n' +
      '[Intro]\n' +
      '\n' +
      '   C              G\n' +
      'e|---0-------0---|---3-------3---|\n' +
      'B|-----1-------1-|-----0-------0-|\n' +
      'G|-------0---0---|-------0---0---|\n' +
      'D|-----2-------2-|-----0-------0-|\n' +
      'A|-3-------3-----|---------2-----|\n' +
      'E|---------------|-3-------3-----|\n' +
      '\n' +
      '[Verse]\n' +
      '   Am             G\n' +
      'e|---0-------0---|---3-------3---|\n' +
      'B|-----1-------1-|-----0-------0-|\n' +
      'G|-------2---2---|-------0---0---|\n' +
      'D|-----2-------2-|-----0-------0-|\n' +
      'A|-0-------0-----|---------2-----|\n' +
      'E|---------------|-3-------3-----|\n' +
      '   here are some   words to sing\n'
    );
  });

  test('tab with repeat signs on subset of strings roundtrips', () => {
    expectRoundtrip(
      'e|-----------------|\n' +
      'B|:1---------1-----|\n' +
      'G|-------0-------0-|\n' +
      'D|-----2-------2---|\n' +
      'A|:3-------3-------|\n' +
      'E|-----------------|\n'
    );
  });

  test('tab with hammer-on and pull-off roundtrips', () => {
    expectRoundtrip(
      'e|---0h2---1p0---|\n' +
      'B|---1-----------|\n' +
      'G|---0-----------|\n' +
      'D|---2-----------|\n' +
      'A|---3-----------|\n' +
      'E|---------------|\n'
    );
  });

  test('drop D tuning roundtrips', () => {
    expectRoundtrip(
      'e|---0---|\n' +
      'B|---1---|\n' +
      'G|---0---|\n' +
      'D|---2---|\n' +
      'A|---3---|\n' +
      'D|---0---|\n'
    );
  });

  test('tab with both chord and lyric lines plus section header roundtrips', () => {
    expectRoundtrip(
      '[Verse 1]\n' +
      '   Am\n' +
      'e|---0---0---|\n' +
      'B|---1---1---|\n' +
      'G|---2---2---|\n' +
      'D|---2---2---|\n' +
      'A|---0---0---|\n' +
      'E|-----------|\n' +
      '   la la la\n'
    );
  });

  // --- Features from example files (synthetic, copyright-free) ---

  test('fingerpicking pattern with quarter/eighth note spacing', () => {
    // Like Dust in the Wind: quarter note first, then eighth notes
    expectRoundtrip(
      '   C                 Cmaj7\n' +
      'e|-----------------|------------------|\n' +
      'B|-1---------1-----|-0----------0-----|\n' +
      'G|-------0-------0-|--------0-------0-|\n' +
      'D|-----2-------2---|------2-------2---|\n' +
      'A|-3-------3-------|-3--------3-------|\n' +
      'E|-----------------|------------------|\n'
    );
  });

  test('repeat signs on subset of strings', () => {
    // Like Dust in the Wind verse: colons only on B and A strings
    expectRoundtrip(
      'e|-----------------|\n' +
      'B|:1---------1-----|\n' +
      'G|-------0-------0-|\n' +
      'D|-----2-------2---|\n' +
      'A|:3-------3-------|\n' +
      'E|-----------------|\n'
    );
  });

  test('repeat end signs on subset of strings', () => {
    expectRoundtrip(
      'e|-----------------|\n' +
      'B|-1---------1----:|\n' +
      'G|-------0-------0-|\n' +
      'D|-----2-------2---|\n' +
      'A|-3-------3------:|\n' +
      'E|-----------------|\n'
    );
  });

  test('right annotation x2 on one string', () => {
    // Like Everybody Hurts: x2 after closing pipe on D string
    expectRoundtrip(
      'e|-------2-----------2---|\n' +
      'B|-----3---3-------3---3-|\n' +
      'G|---2-------2---2-------|\n' +
      'D|-0-----------0---------| x2\n' +
      'A|-------------------------|\n' +
      'E|-------------------------|\n'
    );
  });

  test('multiple right annotations on different strings', () => {
    // Like Everybody Hurts chorus: x3 on G, parenthetical on D
    expectRoundtrip(
      'e|-------0-----------0---|\n' +
      'B|-----0---0-------0---0-|\n' +
      'G|---0-------0---0-------| x3\n' +
      'D|-------------------------| (cut short)\n' +
      'A|-------------------------|\n' +
      'E|-0-----------0---------|\n'
    );
  });

  test('timing markers below tab row', () => {
    // Like Such Great Heights: beat counting line below
    expectRoundtrip(
      '   C                 G\n' +
      'e|-------0---------|-------3---------|\n' +
      'B|-1-------------1-|-0-------------0-|\n' +
      'G|---0-------0-----|---0-------0-----|\n' +
      'D|-----2-------2---|-----0-------0---|\n' +
      'A|-3-------3-------|---------2-------|\n' +
      'E|-----------------|-3---------------|\n' +
      ' | 1 + 2 + 3 + 4 + | 1 + 2 + 3 + 4 + |\n'
    );
  });

  test('pull-off notation (1p0)', () => {
    // Like Sound of Silence: 1p0 pull-off
    expectRoundtrip(
      'e|---1---1---0---0-|\n' +
      'B|-----1-------1---|\n' +
      'G|-2-------0-------|\n' +
      'D|-----------------|\n' +
      'A|-----------------|\n' +
      'E|-----------------|\n'
    );
  });

  test('capo note and section headers with annotations', () => {
    expectRoundtrip(
      'My Song\n' +
      'My Artist\n' +
      'Capo 6\n' +
      '\n' +
      '[Verse 1]\n' +
      '   Asus2\n' +
      'e|---0---0---0---0-|\n' +
      'B|-----0-------0---|\n' +
      'G|-2-------2-------|\n' +
      'D|-----------------|\n' +
      'A|-----------------|\n' +
      'E|-----------------|\n' +
      '\n' +
      '[Chorus] (repeat)\n' +
      '   G\n' +
      'e|-3---3---3---3---|\n' +
      'B|---0-------0-----|\n' +
      'G|-0---0---0---0---|\n' +
      'D|-----------------|\n' +
      'A|-----------------|\n' +
      'E|-3-------3-------|\n'
    );
  });

  test('standalone chord+lyric section (no tabs)', () => {
    // Like Sound of Silence verse 2 / Everybody Hurts verses
    expectRoundtrip(
      'Am           G\n' +
      '   Hello darkness, my old friend,\n' +
      '                           Am\n' +
      'I\'ve come to talk with you again,\n'
    );
  });

  test('multiple tab rows with double blank line separation', () => {
    expectRoundtrip(
      'e|---0---|\n' +
      'B|---1---|\n' +
      'G|---0---|\n' +
      'D|---2---|\n' +
      'A|---3---|\n' +
      'E|-------|\n' +
      '\n' +
      '\n' +
      'e|---3---|\n' +
      'B|---0---|\n' +
      'G|---0---|\n' +
      'D|---0---|\n' +
      'A|---2---|\n' +
      'E|---3---|\n'
    );
  });

  test('hammer-on in tab content (0h2)', () => {
    expectRoundtrip(
      'e|---0h2---1p0---|\n' +
      'B|---1-----------|\n' +
      'G|---0-----------|\n' +
      'D|---2-----------|\n' +
      'A|---3-----------|\n' +
      'E|---------------|\n'
    );
  });

  test('complex chord names above tab', () => {
    // Like Such Great Heights: Fmaj7(add9), F5
    expectRoundtrip(
      '   Fmaj7(add9)                         C\n' +
      'e|-----------------|-------0---------|\n' +
      'B|-------0---------|-------------1---|\n' +
      'G|-0-------------0-|---0-------0-----|\n' +
      'D|---0-------0-----|-----2-------2---|\n' +
      'A|-----3-------3---|-3-------3-------|\n' +
      'E|-1-------1-------|-----------------|\n'
    );
  });

  test('full song structure: title, capo, sections, tabs, lyrics', () => {
    expectRoundtrip(
      'My Original Song\n' +
      'By Test Author\n' +
      'Capo 3\n' +
      '\n' +
      '[Intro]\n' +
      '\n' +
      '   Am              Em\n' +
      'e|---0-------0---|---0-------0---|\n' +
      'B|-----1-------1-|-----0-------0-|\n' +
      'G|-------2---2---|-------0---0---|\n' +
      'D|-----2-------2-|-----2-------2-|\n' +
      'A|-0-------0-----|---2-------2---|\n' +
      'E|---------------|-0-------0-----|\n' +
      '\n' +
      '[Verse]\n' +
      '   C              G\n' +
      'e|---0-------0---|---3-------3---|\n' +
      'B|-----1-------1-|-----0-------0-|\n' +
      'G|-------0---0---|-------0---0---|\n' +
      'D|-----2-------2-|-----0-------0-|\n' +
      'A|-3-------3-----|---------2-----|\n' +
      'E|---------------|-3-------3-----|\n' +
      '   walking down     a dusty road\n' +
      '\n' +
      '[Chorus]\n' +
      'C     G        Am\n' +
      '  And here we are again\n' +
      'F              C\n' +
      '  singing the same old song\n'
    );
  });
});
