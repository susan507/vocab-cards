// "Gente al día 1" glossary importer: the text of the student's PDF glossary -> private/gente-al-dia-1.json
// The source is copyrighted, so the output stays in the gitignored private/ folder and is imported
// in the app's Settings, never bundled. Usage: npm run import:gente-al-dia -- <glossary.pdf>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Book, Word } from '../../src/lib/types.ts';

export const UNITS = 13;

// "U2_A9_A", "U5_MUNDOS", "C. GR._U5", "C. GR. VERB._U3"; "C. GR._VERB." has no unit.
const TAG = /(?:C\. GR\.(?: VERB\.)?_)?U(\d{1,2})(?:_[A-ZÚ0-9]+)*|C\. GR\._VERB\./;

/** Stressed-a feminine nouns take "el" in the singular, as the other books show them. */
const EL_FEMININE = new Set(
  'agua águila ala alma ama alga ancla área arma asma aula ave habla hacha hada hambre'.split(' '),
);

const ARTICLES: Record<string, string> = {
  m: 'el',
  f: 'la',
  'm/f': 'el/la',
  'm pl': 'los',
  'f pl': 'las',
  'm/f pl': 'los/las',
};

function withArticle(form: string): string | undefined {
  const m = /^(.+?) (m\/f pl|m\/f|m pl|f pl|m|f)((?: \(.*\))?)$/.exec(form);
  if (!m) return undefined;
  const [, noun, gender, rest] = m;
  const article =
    gender === 'f' && EL_FEMININE.has(noun.split(' ')[0].toLowerCase()) ? 'el' : ARTICLES[gender];
  return `${article} ${noun}${rest}`;
}

/** "trumbo m, trumba f" -> "el trumbo, la trumba"; adjectives and verbs stay as printed. */
export function readable(headword: string): string {
  // "quiblos/as pl": an adjective's plural marker adds nothing to its "/as".
  if (headword.endsWith('/as pl')) return headword.slice(0, -3);
  const forms = headword.split(', ');
  const converted = forms.map(withArticle);
  return converted.every(Boolean) ? converted.join(', ') : (withArticle(headword) ?? headword);
}

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export type Entry = { es: string; en: string; unit?: number };

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

/**
 * Parses `pdftohtml -xml` output. Headwords are the only bold text, so a bold run after an
 * entry's tag starts the next entry; text between a headword and its tag (gender, verb
 * irregularities) belongs to the headword, and everything after the tag is the English.
 * Returns the entries plus the text of any that didn't come out as headword + tag + English.
 */
export function parseGlossary(xml: string): { entries: Entry[]; unparsed: string[] } {
  const glossaryFonts = new Set(
    [...xml.matchAll(/<fontspec id="(\d+)" size="(\d+)" family="[^"]*Ubuntu/g)]
      .filter(m => Number(m[2]) >= 14)
      .map(m => m[1]),
  );
  const letterFonts = new Set(
    [...xml.matchAll(/<fontspec id="(\d+)" size="(\d+)"/g)]
      .filter(m => Number(m[2]) >= 50)
      .map(m => m[1]),
  );
  let started = false;
  let top = '';
  let current: { text: string; tagged: boolean } | undefined;
  const entries: { text: string; tagged: boolean }[] = [];
  for (const [, t, font, content] of xml.matchAll(
    /<text top="(\d+)"[^>]*font="(\d+)"[^>]*>(.*?)<\/text>/g,
  )) {
    // The abbreviations key ends at the first letter heading.
    if (letterFonts.has(font) && /^(<b>)?([a-z])\2*(<\/b>)?$/.test(content)) started = true;
    if (!started || !glossaryFonts.has(font)) continue;
    const gap = t === top ? '' : ' ';
    top = t;
    for (const [, bold, plain] of content.matchAll(/<b>(.*?)<\/b>|([^<]+)/g)) {
      const text = decode(bold ?? plain);
      if (bold !== undefined && (!current || current.tagged)) {
        current = { text: '', tagged: false };
        entries.push(current);
      }
      if (!current) continue;
      current.text += (current.text ? gap : '') + text;
      if (bold === undefined && TAG.test(current.text)) current.tagged = true;
    }
  }
  const parsed: Entry[] = [];
  const unparsed: string[] = [];
  for (const { text } of entries) {
    const line = text
      .replace(/\s+/g, ' ')
      .replace(/ ,/g, ',')
      .replace(/(\w)- (?=[a-z])/g, '$1-')
      .trim();
    const tag = TAG.exec(line);
    const es = tag && line.slice(0, tag.index).trim();
    const en = tag && line.slice(tag.index + tag[0].length).trim();
    if (!tag || !es || !en || TAG.test(en)) {
      unparsed.push(line);
      continue;
    }
    parsed.push({ es, en, ...(tag[1] !== undefined && { unit: Number(tag[1]) }) });
  }
  return { entries: parsed, unparsed };
}

export function buildBook(entries: Entry[]): Book {
  const chapters = Array.from({ length: UNITS }, (_, n) => ({
    title: `Unidad ${n}`,
    sections: [{ words: [] as Word[] }],
  }));
  const seen = new Map<string, number>();
  for (const { es: headword, en, unit } of entries) {
    const chapter = unit === undefined ? undefined : chapters[unit];
    if (!chapter) continue;
    const es = readable(headword);
    const base = slug(es);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    chapter.sections[0].words.push({ id: n > 1 ? `${base}-${n}` : base, es, en });
  }
  return {
    id: 'gente-al-dia-1',
    title: 'Gente al día 1',
    source: { name: 'Campus Difusión', url: 'https://campus.difusion.com' },
    chapters,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pdf = process.argv[2];
  if (!pdf) throw new Error('Usage: npm run import:gente-al-dia -- <glossary.pdf>');
  const { entries, unparsed } = parseGlossary(
    execFileSync('pdftohtml', ['-xml', '-i', '-stdout', pdf], {
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    }),
  );
  const book = buildBook(entries);
  mkdirSync('private', { recursive: true });
  const out = `private/${book.id}.json`;
  writeFileSync(out, JSON.stringify(book, null, 2) + '\n');
  for (const c of book.chapters) console.log(`${c.title}: ${c.sections[0].words.length}`);
  const noUnit = entries.filter(e => e.unit === undefined);
  console.log(
    `${book.chapters.reduce((n, c) => n + c.sections[0].words.length, 0)} words -> ${out}`,
  );
  if (noUnit.length) console.log(`No unit, left out: ${noUnit.map(e => e.es).join('; ')}`);
  console.log(`Unparsed lines: ${unparsed.length}`);
  for (const l of unparsed) console.log(`  ${l}`);
}
