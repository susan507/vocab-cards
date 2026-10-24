// DK Illustrated Dictionary importer: fetches the Spanish and English content.json
// and joins them by (unit, exercise) -> src/data/books/dk-idic-es.json
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeCatalog } from '../build-catalog.ts';
import type { Book, Chapter } from '../../src/lib/types.ts';

const BASE = 'https://d2hmvvndovjpc2.cloudfront.net/efeidic/en/';

export type DkContent = {
  chapters: {
    chapter: number;
    title: string;
    units: { unit: number; exercises: { exercise: number; text: string; filename: string }[] }[];
  }[];
};

// English misnumbered or blank in the source, keyed by Spanish `${unit}/${exercise}`.
const FIXES: Record<string, string> = {
  '7.2/23': 'to die',
  '7.2/24': 'funeral',
  '117.4/0': 'Fencing',
  '117.4/1': 'to lunge',
  '117.4/2': 'to parry',
  '117.4/3': 'hilt',
  '117.4/4': 'foil',
  '117.4/5': 'blade',
  '117.4/6': 'épée',
  '152.1/0': 'Africa',
  '152.2/0': 'South America',
  '152.3/0': 'North America, Central America and the Caribbean',
  '153.1/0': 'Oceania',
  '153.2/0': 'Asia',
  '153.3/0': 'Europe',
};

export function buildChapters(es: DkContent, en: DkContent, fixes = FIXES): Chapter[] {
  const enChapters = new Map(en.chapters.map(c => [c.chapter, c.title]));
  const enText = new Map<string, string>();
  for (const c of en.chapters)
    for (const u of c.units)
      for (const e of u.exercises) {
        const key = `${u.unit}/${e.exercise}`;
        if (!enText.has(key)) enText.set(key, e.text);
      }
  const both = (es: string, en = '') => (en ? `${es} (${en})` : es);
  return es.chapters.map(c => ({
    title: `${c.chapter} ${both(c.title, enChapters.get(c.chapter))}`,
    sections: c.units.map(u => {
      const words = u.exercises.map(e => {
        const key = `${u.unit}/${e.exercise}`;
        return {
          es: e.text,
          en: fixes[key] ?? enText.get(key) ?? '',
          audio: `${BASE}es/audio/${e.filename}`,
        };
      });
      return { title: both(words[0].es, words[0].en), words };
    }),
  }));
}

async function fetchContent(lang: string): Promise<DkContent> {
  const res = await fetch(`${BASE}${lang}/content.json`);
  if (!res.ok) throw new Error(`${lang}: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const [es, en] = await Promise.all([fetchContent('es'), fetchContent('en')]);
  const book: Book = {
    id: 'dk-idic-es',
    title: 'DK Illustrated Dictionary (Spanish)',
    source: { name: 'DK Illustrated Dictionary', url: 'https://apps.dk.com/idic/en/audio/es' },
    chapters: buildChapters(es, en),
  };
  writeFileSync(`src/data/books/${book.id}.json`, JSON.stringify(book, null, 2) + '\n');
  writeCatalog();
  const sections = book.chapters.flatMap(c => c.sections);
  const words = sections.flatMap(s => s.words);
  const missing = words.filter(w => !w.en).map(w => w.es);
  console.log(
    `${book.id}: ${book.chapters.length} chapters, ${sections.length} sections, ${words.length} words`,
  );
  if (missing.length) console.log(`No English: ${missing.join(', ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();
