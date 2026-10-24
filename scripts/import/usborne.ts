// Usborne Quicklinks importer: raw/usborne-ftw-es.txt -> src/data/books/usborne-ftw-es.json
// Raw file is captured from the page's window.linksConfig (see README "Importing").
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Book, Chapter, Word } from '../../src/lib/types.ts';

const AUDIO_BASE =
  'https://usborne.com/media/usborne/files/quicklinks-library/spanish_sound_clips/';

// Source typos / gaps, keyed by the raw title.
const FIXES: Record<string, Partial<Word>> = {
  'el cochecito de niño': { en: 'pram' },
  'los cachorros de león': { en: 'lion cubs' },
  'la revista (magazina)': { en: 'magazine' },
  'el mecánico (mechanic - female)': { en: 'mechanic - male' },
  'la mecánica (mechanic - male)': { en: 'mechanic - female' },
};

/** "la espalda (back (of body))*" -> { es: "la espalda", en: "back (of body)" } */
export function parseTitle(raw: string): Pick<Word, 'es' | 'en'> {
  const title = raw.replace(/\*$/, '').trim();
  const open = title.indexOf(' (');
  if (open === -1) return { es: title, en: '', ...FIXES[raw] };
  let depth = 0;
  let close = open + 1;
  for (; close < title.length; close++) {
    if (title[close] === '(') depth++;
    if (title[close] === ')' && --depth === 0) break;
  }
  return { es: title.slice(0, open), en: title.slice(open + 2, close), ...FIXES[raw] };
}

export function parseRaw(text: string): Chapter[] {
  const chapters: Chapter[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('# ')) continue;
    if (line.startsWith('#')) {
      // "4-5 La casa (At home) – El cuarto de baño (Bathroom)" -> chapter + subtopic
      const [chapterTitle, sectionTitle] = line.slice(1).split(' – ');
      let chapter = chapters.at(-1);
      if (chapter?.title !== chapterTitle)
        chapters.push((chapter = { title: chapterTitle, sections: [] }));
      chapter.sections.push({ title: sectionTitle, words: [] });
      continue;
    }
    const [code, title] = line.split('|');
    const section = chapters.at(-1)?.sections.at(-1);
    if (!section || !title) throw new Error(`Bad line: ${line}`);
    section.words.push({ ...parseTitle(title), audio: `${AUDIO_BASE}${code}.mp3` });
  }
  return chapters;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const book: Book = {
    id: 'usborne-ftw-es',
    title: 'First Thousand Words in Spanish',
    source: {
      name: 'Usborne Quicklinks',
      url: 'https://usborne.com/gb/quicklinks/quicklink/first-thousand-words-in-spanish',
    },
    chapters: parseRaw(readFileSync('raw/usborne-ftw-es.txt', 'utf8')),
  };
  writeFileSync(`src/data/books/${book.id}.json`, JSON.stringify(book, null, 2) + '\n');
  const words = book.chapters.flatMap(c => c.sections).reduce((n, s) => n + s.words.length, 0);
  console.log(`${book.id}: ${book.chapters.length} chapters, ${words} words`);
}
