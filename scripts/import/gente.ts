// SpanishDict "Gente Hoy 1" importer: textbook page + each unit's vocab list pages
// (data from window.SD_COMPONENT_DATA) -> src/data/books/gente-hoy-1.json
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeCatalog } from '../build-catalog.ts';
import type { Book, Chapter, Section, Word } from '../../src/lib/types.ts';

const SITE = 'https://www.spanishdict.com';
const IMAGE_HOST = 'https://sd-hegemone-production.sdcdns.com';
const TEXTBOOK_URL = `${SITE}/textbooks/26`;

export type SdTextbook = {
  sections: {
    name: string;
    articles: { title: string; path: string }[];
    vocabLists: { id: number; name: string; slug: string }[];
  }[];
};

export type SdList = {
  vocabList: { name: string };
  vocabTranslations: { id: number; translationId: number; createdAt: string; isDeleted: boolean }[];
  translations: {
    id: number;
    translation: string;
    senseId: number;
    translationImageId: number | null;
    headwordArticle: string | null;
    headwordAudioUrl: string | null;
  }[];
  senses: { id: number; wordId: number }[];
  words: { id: number; source: string }[];
  translationImages: { id: number; path: string }[];
};

// Wrong article or sense in the source, keyed by vocabTranslation id. Audio keeps the original.
const FIXES: Record<string, Partial<Word>> = {
  '77261': { es: 'Venezuela' },
  '77267': { es: 'Cuba' },
  '77365': { es: 'el ama de casa', en: 'housewife' },
  '77518': { es: 'el delfín' },
  '77601': { es: 'rosa', en: 'pink' },
  '77602': { es: 'naranja' },
  '78765': { es: 'el agua con gas' },
  '78766': { es: 'el agua sin gas' },
  '78984': { en: 'half past' },
  '79137': { es: 'el microondas' },
};
const TITLE_FIXES: Record<string, string> = {
  'Gente Hoy 1 - Unidad 1 - gente qu estudia español':
    'Gente Hoy 1 - Unidad 1 - gente que estudia español',
};

export function componentData<T>(html: string): T {
  const m = html.match(/window\.SD_COMPONENT_DATA\s*=\s*(\{.*?\});\s*<\/script>/s);
  if (!m) throw new Error('No SD_COMPONENT_DATA');
  return JSON.parse(m[1]);
}

export function buildSection(list: SdList, fixes = FIXES): Section {
  const translations = new Map(list.translations.map(t => [t.id, t]));
  const senses = new Map(list.senses.map(s => [s.id, s]));
  const words = new Map(list.words.map(w => [w.id, w]));
  const images = new Map(list.translationImages.map(i => [i.id, i.path]));
  // The site lists newest additions first.
  const entries = list.vocabTranslations
    .filter(v => !v.isDeleted)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  return {
    title: TITLE_FIXES[list.vocabList.name] ?? list.vocabList.name,
    words: entries.map(v => {
      const t = translations.get(v.translationId)!;
      const source = words.get(senses.get(t.senseId)!.wordId)!.source;
      const image = t.translationImageId && images.get(t.translationImageId);
      return {
        id: String(v.id),
        es: t.headwordArticle ? `${t.headwordArticle} ${source}` : source,
        en: t.translation,
        ...(t.headwordAudioUrl && { audio: t.headwordAudioUrl }),
        ...(image && { image: IMAGE_HOST + image.replace('/original/', '/300/') }),
        ...fixes[v.id],
      };
    }),
  };
}

export const buildChapter = (
  unit: SdTextbook['sections'][number],
  lists: SdList[],
  fixes = FIXES,
): Chapter => ({
  title: unit.name,
  sections: lists.map(l => buildSection(l, fixes)),
  ...(unit.articles.length && {
    links: unit.articles.map(a => ({ title: a.title, url: SITE + a.path })),
  }),
});

async function fetchData<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return componentData<T>(await res.text());
}

// Some older source images are gone (403), so keep only ones that load.
async function dropDeadImages(words: Word[]) {
  const queue = [...new Set(words.flatMap(w => w.image ?? []))];
  const dead = new Set<string>();
  const worker = async () => {
    for (let url = queue.pop(); url; url = queue.pop())
      if (!(await fetch(url, { method: 'HEAD' })).ok) dead.add(url);
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  for (const w of words) if (w.image && dead.has(w.image)) delete w.image;
}

async function main() {
  const { textbook } = await fetchData<{ textbook: SdTextbook }>(TEXTBOOK_URL);
  const chapters: Chapter[] = [];
  for (const unit of textbook.sections) {
    const lists: SdList[] = [];
    for (const l of unit.vocabLists)
      lists.push(await fetchData<SdList>(`${SITE}/lists/${l.id}/${l.slug}`));
    chapters.push(buildChapter(unit, lists));
  }
  await dropDeadImages(chapters.flatMap(c => c.sections).flatMap(s => s.words));
  const book: Book = {
    id: 'gente-hoy-1',
    title: 'Gente Hoy 1',
    source: { name: 'SpanishDict', url: TEXTBOOK_URL },
    chapters,
  };
  writeFileSync(`src/data/books/${book.id}.json`, JSON.stringify(book, null, 2) + '\n');
  writeCatalog();
  const sections = chapters.flatMap(c => c.sections);
  const words = sections.flatMap(s => s.words);
  console.log(
    `${book.id}: ${chapters.length} chapters, ${sections.length} sections, ${words.length} words, ` +
      `${words.filter(w => !w.audio).length} without audio, ${words.filter(w => !w.image).length} without image`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();
