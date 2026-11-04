import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBook, parseGlossary, readable } from './gente-al-dia.ts';

// Invented entries in the shape of `pdftohtml -xml` output (the real glossary is copyrighted).
const xml = `
<fontspec id="1" size="12" family="X+Ubuntu-Light" color="#000000"/>
<fontspec id="2" size="52" family="X+Vectora-Black" color="#000000"/>
<fontspec id="3" size="15" family="X+Ubuntu" color="#000000"/>
<fontspec id="4" size="14" family="X+Ubuntu-Light" color="#000000"/>
<text top="10" left="1" width="1" height="1" font="3"><b>key  </b>ignored</text>
<text top="20" left="1" width="1" height="1" font="4">U1 <b>unidad 1  </b>unit 1</text>
<text top="30" left="1" width="1" height="1" font="2"><b>bb</b></text>
<text top="40" left="1" width="1" height="1" font="3"><b>trumbo</b></text>
<text top="40" left="1" width="1" height="1" font="3"> m, </text>
<text top="40" left="1" width="1" height="1" font="3"><b>trumba</b></text>
<text top="40" left="1" width="1" height="1" font="3"> f  </text>
<text top="40" left="1" width="1" height="1" font="4">U3_A9_B </text>
<text top="40" left="1" width="1" height="1" font="3">trumbo keeper</text>
<text top="60" left="1" width="1" height="1" font="3"><b>flinco/a </b></text>
<text top="60" left="1" width="1" height="1" font="4">C. GR._U12 </text>
<text top="60" left="1" width="1" height="1" font="3">flinky and </text>
<text top="80" left="1" width="1" height="1" font="3">cheer- ful</text>
<text top="90" left="1" width="1" height="1" font="1">7</text>
<text top="100" left="1" width="1" height="1" font="3"><b>zorpo de vela muy</b></text>
<text top="120" left="1" width="1" height="1" font="3"><b>grande</b></text>
<text top="120" left="1" width="1" height="1" font="3"> m  </text>
<text top="140" left="1" width="1" height="1" font="4">U0_MUNDOS </text>
<text top="140" left="1" width="1" height="1" font="3">big zorp boat</text>
<text top="160" left="1" width="1" height="1" font="3"><b>bliquer</b></text>
<text top="160" left="1" width="1" height="1" font="3"> (ue) </text>
<text top="160" left="1" width="1" height="1" font="4">C. GR. VERB._U3 </text>
<text top="160" left="1" width="1" height="1" font="3">to bliq &amp; sip</text>
<text top="180" left="1" width="1" height="1" font="3"><b>glimar </b></text>
<text top="180" left="1" width="1" height="1" font="4">C. GR._VERB. </text>
<text top="180" left="1" width="1" height="1" font="3">to glim</text>
<text top="220" left="1" width="1" height="1" font="3"><b>plusco/a </b></text>
<text top="220" left="1" width="1" height="1" font="4">U3 </text>
<text top="220" left="1" width="1" height="1" font="3">plusky</text>
<text top="240" left="1" width="1" height="1" font="3"><b>vurto </b></text>
<text top="240" left="1" width="1" height="1" font="4">U4 </text>
`;

test('parseGlossary joins wrapped headwords and English, skipping the key and page numbers', () => {
  const { entries, unparsed } = parseGlossary(xml);
  assert.deepEqual(entries, [
    { es: 'trumbo m, trumba f', en: 'trumbo keeper', unit: 3 },
    { es: 'flinco/a', en: 'flinky and cheer-ful', unit: 12 },
    { es: 'zorpo de vela muy grande m', en: 'big zorp boat', unit: 0 },
    { es: 'bliquer (ue)', en: 'to bliq & sip', unit: 3 },
    { es: 'glimar', en: 'to glim' },
    { es: 'plusco/a', en: 'plusky', unit: 3 },
  ]);
  assert.deepEqual(unparsed, ['vurto U4']);
});

test('readable turns gender markers into articles', () => {
  assert.equal(readable('trumbo m, trumba f'), 'el trumbo, la trumba');
  assert.equal(readable('trumba f'), 'la trumba');
  assert.equal(readable('alma f'), 'el alma');
  assert.equal(readable('alma gemela f'), 'el alma gemela');
  assert.equal(readable('quelpa m/f'), 'el/la quelpa');
  assert.equal(readable('zingas f pl'), 'las zingas');
  assert.equal(readable('zongos m pl'), 'los zongos');
  assert.equal(readable('flup (de zap) m'), 'el flup (de zap)');
  assert.equal(readable('jorfe m/f, jorfa f'), 'el/la jorfe, la jorfa');
  assert.equal(readable('plusco/a'), 'plusco/a');
  assert.equal(readable('quiblos/as pl'), 'quiblos/as');
  assert.equal(readable('bliquer (ue)'), 'bliquer (ue)');
});

test('buildBook files words under their unit in order, with unique ids', () => {
  const book = buildBook([
    { es: 'zamco m', en: 'zam', unit: 2 },
    { es: 'zamco m', en: 'zammy', unit: 2 },
    { es: 'blen', en: 'blenly', unit: 0 },
    { es: 'glimar', en: 'to glim' },
  ]);
  assert.equal(book.chapters.length, 13);
  assert.equal(book.chapters[12].title, 'Unidad 12');
  assert.deepEqual(book.chapters[2].sections, [
    {
      words: [
        { id: 'el-zamco', es: 'el zamco', en: 'zam' },
        { id: 'el-zamco-2', es: 'el zamco', en: 'zammy' },
      ],
    },
  ]);
  assert.deepEqual(book.chapters[0].sections[0].words, [{ id: 'blen', es: 'blen', en: 'blenly' }]);
});
