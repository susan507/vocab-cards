import { shuffle, wordKey } from './books';
import type { Word } from './types';

/**
 * Leitner boxes plus Yes/No pile sessions, like studying with physical cards.
 * Days are local calendar days as `YYYY-MM-DD`.
 */

/** One word's progress. `updatedAt` (ISO) decides which copy wins when syncing. */
export type Progress = {
  /** 1..MAX_BOX; absent until the word's first answer. */
  box?: number;
  /** Day of the last answer that moved the box (the first of that day). */
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

/** Calendar days since the last answer ÷ the box interval; 1 or more is due. */
const overdue = (p: Progress & { box: number; last: string }, day: string) =>
  daysBetween(p.last, day) / intervalDays(p.box);

export const isDue = (p: Progress | undefined, day: string) => studied(p) && overdue(p, day) >= 1;

/**
 * Only a word's first answer of the day moves its box: No to box 1, Yes up one box, or further
 * when it was remembered after a longer gap (to the largest box whose interval fits the gap).
 * A never-seen word goes to box 2 on Yes. Later answers that day return `prev` unchanged.
 */
export function answerProgress(
  prev: Progress | undefined,
  yes: boolean,
  day: string,
  now: Date,
): Progress {
  if (prev && studied(prev) && prev.last === day) return prev;
  const gap = studied(prev) ? daysBetween(prev.last, day) : 0;
  const credit = gap >= 1 ? Math.floor(Math.log2(gap)) + 1 : 0;
  return {
    ...prev,
    box: yes ? Math.min(MAX_BOX, Math.max((prev?.box ?? 1) + 1, credit)) : 1,
    last: day,
    updatedAt: now.toISOString(),
  };
}

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

type Seen = { id: string; box: number; days: number; score: number };

/** Studied, non-retired words, most overdue first; ties longest since the last answer, then book order. */
function seenByOverdue(
  words: readonly Word[],
  bookId: string,
  progress: ProgressMap,
  day: string,
  dir: Direction,
): Seen[] {
  const seen: Seen[] = [];
  for (const word of words) {
    const p = progress[progressKey(bookId, word, dir)];
    if (!studied(p) || p.retired) continue;
    seen.push({ id: word.id, box: p.box, days: daysBetween(p.last, day), score: overdue(p, day) });
  }
  return seen.sort((a, b) => b.score - a.score || b.days - a.days);
}

/** The next chapter session: due and box-1 words, most overdue first, then never-seen words in book order. */
export function dueSessionIds(
  words: readonly Word[],
  bookId: string,
  progress: ProgressMap,
  day: string,
  dir: Direction,
): string[] {
  const due = seenByOverdue(words, bookId, progress, day, dir).filter(
    s => s.score >= 1 || s.box === 1,
  );
  const unseen = words.filter(w => {
    const p = progress[progressKey(bookId, w, dir)];
    return !studied(p) && !p?.retired;
  });
  return [...due.map(s => s.id), ...unseen.map(w => w.id)];
}

export const SHAKIEST = 20;

/** "Practise the shakiest anyway": the studied words in the lowest boxes, most overdue first. */
export const shakiestIds = (
  words: readonly Word[],
  bookId: string,
  progress: ProgressMap,
  day: string,
  dir: Direction,
) =>
  seenByOverdue(words, bookId, progress, day, dir)
    .sort((a, b) => a.box - b.box)
    .slice(0, SHAKIEST)
    .map(s => s.id);

/** Days until the next studied word is due (0 if one already is); undefined when none are studied. */
export function nextDueIn(
  words: readonly Word[],
  bookId: string,
  progress: ProgressMap,
  day: string,
  dir: Direction,
): number | undefined {
  const waits = seenByOverdue(words, bookId, progress, day, dir).map(s =>
    Math.max(0, intervalDays(s.box) - s.days),
  );
  return waits.length ? Math.min(...waits) : undefined;
}

/** "Review all" order: every studied, non-retired word in the book, most overdue first. */
export const reviewOrder = (
  words: readonly Word[],
  bookId: string,
  progress: ProgressMap,
  day: string,
  dir: Direction,
) => seenByOverdue(words, bookId, progress, day, dir).map(s => s.id);

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
    sum += Math.max(0, 1 - overdue(p, day));
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

/** Saved but never answered: safe to rebuild with the current deck rules. */
export const isUntouched = (s: Session) =>
  s.stage === 'main' && s.round === 1 && !s.yes.length && !s.no.length;

export const startSession = (ids: readonly string[], day: string, mix: Mix = shuffle): Session =>
  nextRound({ day, stage: 'main', round: 0, queue: [], yes: [], no: [...ids], missed: [] }, mix);

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
      missed: !yes && s.stage === 'main' && s.round === 1 ? [...s.missed, id] : s.missed,
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

/**
 * "Review all": one ongoing queue over `reviewOrder`, minus the words already answered from it
 * today (`done`) and the No pile. When the pile reaches DRILL_AT (or on demand, or when the queue
 * runs out) it's drilled: rounds of just those words until each gets a Yes, then back to the queue.
 */
export type Review = { day: string; done: string[]; pile: string[]; drill: Session | null };

export const DRILL_AT = 10;

export const startReview = (day: string): Review => ({ day, done: [], pile: [], drill: null });

/** The word on screen, or undefined when the queue has run out. */
export function reviewCurrent(r: Review, order: readonly string[]) {
  if (r.drill) return r.drill.queue[0];
  const skip = new Set([...r.done, ...r.pile]);
  return order.find(id => !skip.has(id));
}

/** Rounds of the No pile, starting straight at the revision stage so it ends once each word has a Yes. */
export const drillPile = (r: Review, mix: Mix = shuffle): Review => ({
  ...r,
  done: [...r.done, ...r.pile],
  pile: [],
  drill: nextRound(
    { day: r.day, stage: 'revise', round: 0, queue: [], yes: [], no: [...r.pile], missed: [] },
    mix,
  ),
});

/** Ends a finished drill and drills the pile once the queue has run out. */
function settle(r: Review, order: readonly string[], mix: Mix): Review {
  if (r.drill && !r.drill.queue.length) r = { ...r, drill: null };
  if (!r.drill && r.pile.length && reviewCurrent(r, order) === undefined) return drillPile(r, mix);
  return r;
}

export const openReview = (r: Review, order: readonly string[], mix: Mix = shuffle) =>
  settle(r, order, mix);

export function answerReview(
  r: Review,
  yes: boolean,
  order: readonly string[],
  mix: Mix = shuffle,
): Review {
  const id = reviewCurrent(r, order);
  if (id === undefined) return r;
  if (r.drill) return settle({ ...r, drill: answer(r.drill, yes, mix) }, order, mix);
  const next = yes ? { ...r, done: [...r.done, id] } : { ...r, pile: [...r.pile, id] };
  return next.pile.length >= DRILL_AT ? drillPile(next, mix) : settle(next, order, mix);
}

/** Takes a retired word out of the review wherever it is. */
export const removeFromReview = (
  r: Review,
  id: string,
  order: readonly string[],
  mix: Mix = shuffle,
): Review =>
  settle(
    {
      ...r,
      done: [...r.done, id],
      pile: r.pile.filter(i => i !== id),
      drill: r.drill && removeWord(r.drill, id, mix),
    },
    order,
    mix,
  );

/** A saved review, only if it's from `day`. An older saved "Review all" session finishes as a drill. */
export function parseReview(raw: string | null | undefined, day: string): Review | null {
  const legacy = parseSession(raw, day);
  if (legacy)
    return {
      day,
      done: [...legacy.queue, ...legacy.yes, ...legacy.no, ...legacy.missed],
      pile: [],
      drill: legacy,
    };
  try {
    const r = JSON.parse(raw ?? 'null') as Review | null;
    const drill = r?.drill ? parseSession(JSON.stringify(r.drill), day) : null;
    if (r?.day !== day || !isIds(r.done) || !isIds(r.pile) || (r.drill && !drill)) return null;
    return { day, done: r.done, pile: r.pile, drill };
  } catch {
    return null;
  }
}
