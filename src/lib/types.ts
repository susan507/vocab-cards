// The book format every importer produces. Keep it source-agnostic:
// importers live in scripts/import/, the app only ever reads this shape.

export type Word = {
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

export type Chapter = {
  title: string;
  sections: Section[];
};

export type Book = {
  id: string;
  title: string;
  source: { name: string; url: string };
  chapters: Chapter[];
};
