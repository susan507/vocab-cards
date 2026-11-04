// The book format every importer produces. Keep it source-agnostic:
// importers live in scripts/import/, the app only ever reads this shape.

export type Word = {
  /** Stable within its book across re-imports; see `wordKey` for the global key. */
  id: string;
  es: string;
  en: string;
  /** Absolute URL. The native app swaps it for a local file when downloaded. */
  audio?: string;
  image?: string;
};

export type Section = {
  /** Omitted when a chapter has no subtopics. */
  title?: string;
  words: Word[];
};

/** An outside page for extra study, opened in the browser. */
export type Link = { title: string; url: string };

export type Chapter = {
  title: string;
  sections: Section[];
  links?: Link[];
};

export type Book = {
  id: string;
  title: string;
  source: { name: string; url: string };
  chapters: Chapter[];
};

/** A book without its words: small enough to bundle eagerly for the home and chapter screens. */
export type CatalogBook = Omit<Book, 'chapters'> & {
  chapters: {
    title: string;
    sections: { title?: string; count: number }[];
    links?: Link[];
  }[];
};

export type Catalog = Record<string, CatalogBook>;
