import { shuffle, wordKey } from './books';
import type { Word } from './types';

/**
 * Leitner boxes plus Yes/No pile sessions, like studying with physical cards.
 * Days are local calendar days as `YYYY-MM-DD`.
 */

/** One word's progress. `updatedAt` (ISO) decides which copy wins when syncing. */
export type Progress = {
  /** 1..MAX_BOX; absent until the word's first round-1 answer. */
  box?: number;
  /** Day of the last round-1 answer. */
  last?: string;
  retired?: boolean;
  updatedAt: string;
};
export type ProgressMap = Record<string, Progress>;

/** Which side is the prompt. Each direction is a separate spaced-repetition deck. */
export const DIRECTIONS = { esEn: 'ES → EN', enEs: 'EN → ES' } as const;
export type Direction = keyof typeof DIRECTIONS;

/** A storage key for `dir`. ES→EN keeps the plain key, so data saved before directions existed stays ES→EN. */
export const forDirection = (key: string, dir: Direction) => (dir === 'enEs' ? `${key}:en` : key);

/** A word's key in a `ProgressMap` (and its `word_progress.word_id`). */
export const progressKey = (bookId: string, word: Word, dir: Direction) =>
  forDirection(wordKey(bookId, word), dir);

export const MAX_BOX = 7;

/** Box n comes back every 2^(n-1) days: 1, 2, 4 … 64. */
export const intervalDays = (box: number) => 2 ** (box - 1);

const pad = (n: number) => String(n).padStart(2, '0');

export const today = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const dayNumber = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

export const isProgress = (p: unknown): p is Progress => {
  if (!p || typeof p !== 'object') return false;
  const { box, last, updatedAt } = p as Progress;
  return (
    typeof updatedAt === 'string' &&
    (box === undefined || (Number.isInteger(box) && box >= 1 && box <= MAX_BOX)) &&
    (last === undefined || /^\d{4}-\d\d-\d\d$/.test(last))
  );
};

export function parseProgress(raw: string | null | undefined): ProgressMap {
  try {
    const map: unknown = JSON.parse(raw ?? '{}');
    if (!map || typeof map !== 'object') return {};
    return Object.fromEntries(Object.entries(map).filter(([, p]) => isProgress(p)));
  } catch {
    return {};
  }
}

const studied = (p: Progress | undefined): p is Progress & { box: number; last: string } =>
  !!p?.box && !!p.last;

export const isDue = (p: Progress | undefined, day: string) =>
  studied(p) && daysBetween(p.last, day) >= intervalDays(p.box);

/** A round-1 answer: Yes moves the word up a box (an unseen word counts as box 1), No sends it to box 1. */
export const answerProgress = (
  prev: Progress | undefined,
  yes: boolean,
  day: string,
  now: Date,
): Progress => ({
  ...prev,
  box: yes ? Math.min(MAX_BOX, (prev?.box ?? 1) + 1) : 1,
  last: day,
  updatedAt: now.toISOString(),
});

export const setRetired = (prev: Progress | undefined, retired: boolean, now: Date): Progress => ({
  ...prev,
  retired,
  updatedAt: now.toISOString(),
});

/** A chapter session: every word that isn't retired. */
export const chapterSessionIds = (
  words: readonly Word[],
  bookId: string,
  progress: ProgressMap,
  dir: Direction,
) => words.filter(w => !progress[progressKey(bookId, w, dir)]?.retired).map(w => w.id);

/** "Review all": due words and up to `newLimit` never-answered words, in book order. */
export function reviewSessionIds(
  words: readonly Word[],
  bookId: string,
  progress: ProgressMap,
  newLimit: number,
  day: string,
  dir: Direction,
): string[] {
  const ids: string[] = [];
  let fresh = 0;
  for (const word of words) {
    const p = progress[progressKey(bookId, word, dir)];
    if (p?.retired) continue;
    if (isDue(p, day)) ids.push(word.id);
    else if (!studied(p) && fresh < newLimit) {
      ids.push(word.id);
      fresh++;
    }
  }
  return ids;
}

/** How fresh the studied, non-retired words are (1 just answered, 0 due); undefined when none are studied. */
export function strength(
  words: readonly Word[],
  bookId: string,
  progress: ProgressMap,
  day: string,
  dir: Direction,
): number | undefined {
  let sum = 0;
  let n = 0;
  for (const word of words) {
    const p = progress[progressKey(bookId, word, dir)];
    if (!studied(p) || p.retired) continue;
    sum += Math.max(0, 1 - daysBetween(p.last, day) / intervalDays(p.box));
    n++;
  }
  return n ? sum / n : undefined;
}

/**
 * A session in rounds. `main`: round 1 is the whole deck, each later round the previous round's No pile,
 * until a round has no No. Then `revise`: the round-1 No pile (`missed`) in rounds the same way.
 * `queue[0]` is the word on screen; the session is over when the queue is empty.
 */
export type Session = {
  day: string;
  stage: 'main' | 'revise';
  round: number;
  queue: string[];
  yes: string[];
  no: string[];
  missed: string[];
};

type Mix = (ids: readonly string[]) => string[];

export const startSession = (ids: readonly string[], day: string, mix: Mix = shuffle): Session =>
  nextRound({ day, stage: 'main', round: 0, queue: [], yes: [], no: [...ids], missed: [] }, mix);

/** Only round 1 of the main stage moves Leitner boxes. */
export const isFirstRound = (s: Session) => s.stage === 'main' && s.round === 1;

function nextRound(s: Session, mix: Mix): Session {
  if (s.queue.length) return s;
  if (s.no.length) return { ...s, round: s.round + 1, queue: mix(s.no), yes: [], no: [] };
  if (s.stage === 'main' && s.missed.length)
    return { ...s, stage: 'revise', round: 1, queue: mix(s.missed), yes: [], no: [] };
  return { ...s, yes: [], no: [] };
}

export function answer(s: Session, yes: boolean, mix: Mix = shuffle): Session {
  const [id, ...queue] = s.queue;
  if (id === undefined) return s;
  return nextRound(
    {
      ...s,
      queue,
      yes: yes ? [...s.yes, id] : s.yes,
      no: yes ? s.no : [...s.no, id],
      missed: !yes && isFirstRound(s) ? [...s.missed, id] : s.missed,
    },
    mix,
  );
}

/** Takes a retired word out of the session wherever it is. */
export function removeWord(s: Session, id: string, mix: Mix = shuffle): Session {
  const drop = (ids: string[]) => ids.filter(i => i !== id);
  return nextRound(
    { ...s, queue: drop(s.queue), yes: drop(s.yes), no: drop(s.no), missed: drop(s.missed) },
    mix,
  );
}

const isIds = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(i => typeof i === 'string');

/** A saved session, only if it's from `day`. */
export function parseSession(raw: string | null | undefined, day: string): Session | null {
  try {
    const s = JSON.parse(raw ?? 'null') as Session | null;
    if (
      s?.day !== day ||
      (s.stage !== 'main' && s.stage !== 'revise') ||
      typeof s.round !== 'number' ||
      ![s.queue, s.yes, s.no, s.missed].every(isIds)
    )
      return null;
    return s;
  } catch {
    return null;
  }
}
