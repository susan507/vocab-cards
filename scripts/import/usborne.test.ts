import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRaw, parseTitle } from './usborne.ts';

test('parseTitle', () => {
  assert.deepEqual(parseTitle('la bañera (bath)'), { es: 'la bañera', en: 'bath' });
  assert.deepEqual(parseTitle('la espalda (back (of body))'), {
    es: 'la espalda',
    en: 'back (of body)',
  });
  assert.deepEqual(parseTitle('el disco compacto (CD)*'), { es: 'el disco compacto', en: 'CD' });
  assert.deepEqual(parseTitle('la arcilla (clay) (clay)'), { es: 'la arcilla', en: 'clay' });
  assert.deepEqual(parseTitle('los cachorros de león'), {
    es: 'los cachorros de león',
    en: 'lion cubs',
  });
});

test('parseRaw groups subtopics under one chapter, in order', () => {
  const chapters = parseRaw(
    [
      '# header',
      '#4-5 La casa – Baño',
      'A1|el agua (water)',
      '#4-5 La casa – Hall',
      'A2|la mesa (table)',
      '#6-7 La cocina',
      'A3|la llave (key)',
    ].join('\n'),
  );
  assert.deepEqual(
    chapters.map(c => [c.title, c.sections.map(s => s.title)]),
    [
      ['4-5 La casa', ['Baño', 'Hall']],
      ['6-7 La cocina', [undefined]],
    ],
  );
  assert.match(chapters[0].sections[0].words[0].audio!, /\/A1\.mp3$/);
});
