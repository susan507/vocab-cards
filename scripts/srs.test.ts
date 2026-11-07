import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  answer,
  answerProgress,
  answerReview,
  chapterSessionIds,
  daysBetween,
  DRILL_AT,
  drillPile,
  dueSessionIds,
  forDirection,
  isDue,
  isUntouched,
  nextDueIn,
  openReview,
  parseReview,
  parseSession,
  progressKey,
  removeFromReview,
  removeWord,
  reviewCurrent,
  reviewOrder,
  setRetired,
  shakiestIds,
  startReview,
  startSession,
  strength,
} from '../src/lib/srs.ts';
import type { Progress, ProgressMap, Review, Session } from '../src/lib/srs.ts';
import type { Word } from '../src/lib/types.ts';

const words: Word[] = Array.from({ length: 6 }, (_, i) => ({
  id: String(i),
  es: `es${i}`,
  en: `en${i}`,
}));
const key = (i: number) => `b:${i}`;
const now = new Date('2026-01-01T12:00:00Z');
const keep = (ids: readonly string[]) => [...ids];
const reverse = (ids: readonly string[]) => [...ids].reverse();

/** Answers the session's words in queue order; `yes` decides per word id. */
function run(s: Session, yes: (id: string, s: Session) => boolean, log: string[] = []) {
  while (s.queue.length) {
    log.push(`${s.stage}${s.round}:${s.queue[0]}`);
    s = answer(s, yes(s.queue[0], s), keep);
  }
  return log;
}

test('rounds repeat the latest No pile, then the round-1 No pile is revised until all Yes', () => {
  const s = startSession(['a', 'b', 'c', 'd'], '2026-01-01', keep);
  assert.deepEqual([s.stage, s.round, s.queue], ['main', 1, ['a', 'b', 'c', 'd']]);
  // Round 1: b and c wrong. Round 2: c wrong again. Round 3: c right.
  // Revise b, c (the round-1 No pile): c wrong once more, then right.
  const misses = new Map([
    ['main1', ['b', 'c']],
    ['main2', ['c']],
    ['revise1', ['c']],
  ]);
  const log = run(s, (id, cur) => !misses.get(`${cur.stage}${cur.round}`)?.includes(id));
  assert.deepEqual(log, [
    'main1:a',
    'main1:b',
    'main1:c',
    'main1:d',
    'main2:b',
    'main2:c',
    'main3:c',
    'revise1:b',
    'revise1:c',
    'revise2:c',
  ]);
});

test('each round is shuffled; piles count the current round only', () => {
  let s = startSession(['a', 'b', 'c'], 'd', reverse);
  assert.deepEqual(s.queue, ['c', 'b', 'a']);
  s = answer(s, false, reverse);
  s = answer(s, true, reverse);
  assert.deepEqual([s.yes, s.no, s.queue], [['b'], ['c'], ['a']]);
  s = answer(s, false, reverse);
  assert.deepEqual([s.round, s.queue, s.yes, s.no], [2, ['a', 'c'], [], []]);
});

test('all Yes in round 1 ends the session with no revision stage', () => {
  assert.deepEqual(
    run(startSession(['a', 'b'], 'd', keep), () => true),
    ['main1:a', 'main1:b'],
  );
  assert.deepEqual(startSession([], 'd', keep).queue, []);
});

test('retiring a word takes it out of the session, including the revision pile', () => {
  let s = startSession(['a', 'b'], 'd', keep);
  s = answer(s, false, keep); // a missed
  s = removeWord(s, 'b', keep); // b retired on screen: round 2 starts with a
  assert.deepEqual([s.round, s.queue], [2, ['a']]);
  s = removeWord(s, 'a', keep);
  assert.deepEqual([s.queue, s.missed], [[], []]);
});

const at = (box: number, last: string): Progress => ({ box, last, updatedAt: '' });

test('boxes: Yes up one (unseen goes to box 2), No back to box 1, capped at 7', () => {
  const day = '2026-01-10';
  assert.equal(answerProgress(undefined, true, day, now).box, 2);
  assert.equal(answerProgress(undefined, false, day, now).box, 1);
  assert.equal(answerProgress(at(5, '2026-01-01'), false, day, now).box, 1);
  assert.equal(answerProgress(at(7, '2026-01-01'), true, day, now).box, 7);
  assert.equal(answerProgress(at(3, '2026-01-09'), true, day, now).box, 4);
  assert.equal(answerProgress(undefined, true, day, now).last, day);
});

test('only the first answer of the day moves the box, in any session', () => {
  const day = '2026-01-10';
  const no = answerProgress(at(4, '2026-01-01'), false, day, now);
  assert.equal(no.box, 1);
  assert.equal(answerProgress(no, true, day, now), no);
  const yes = answerProgress(undefined, true, day, now);
  assert.equal(answerProgress(yes, false, day, now), yes);
  assert.equal(answerProgress(yes, true, '2026-01-11', now).box, 3);
});

test('Yes after a gap jumps to the largest box whose interval fits the gap', () => {
  // Box 2 last seen 10 days ago: intervals 1, 2, 4, 8 fit, so box 4.
  assert.equal(answerProgress(at(2, '2026-01-01'), true, '2026-01-11', now).box, 4);
  assert.equal(answerProgress(at(1, '2026-01-01'), true, '2026-01-05', now).box, 3);
  assert.equal(answerProgress(at(5, '2026-01-01'), true, '2026-01-11', now).box, 6);
  assert.equal(answerProgress(at(1, '2025-01-01'), true, '2026-01-01', now).box, 7);
  assert.equal(answerProgress(at(2, '2025-01-01'), false, '2026-01-01', now).box, 1);
});

test('box n is due 2^(n-1) calendar days after its last answer', () => {
  const p = (box: number) => ({ box, last: '2026-01-30', updatedAt: '' });
  assert.equal(isDue(p(1), '2026-01-30'), false);
  assert.equal(isDue(p(1), '2026-01-31'), true);
  assert.equal(isDue(p(3), '2026-02-02'), false);
  assert.equal(isDue(p(3), '2026-02-03'), true);
  assert.equal(isDue(p(7), '2026-04-04'), true);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // across a DST change
  assert.equal(isDue(undefined, '2026-01-01'), false);
});

test('chapter deck: due and box-1 words most overdue first, then unseen in book order', () => {
  const day = '2026-01-10';
  const progress: ProgressMap = {
    [key(0)]: at(3, '2026-01-08'), // not due (2/4)
    [key(1)]: at(1, '2026-01-10'), // box 1, answered today
    [key(2)]: at(2, '2026-01-07'), // 3/2 = 1.5
    [key(3)]: at(1, '2026-01-07'), // 3/1 = 3
    [key(5)]: { retired: true, updatedAt: '' },
  };
  assert.deepEqual(dueSessionIds(words, 'b', progress, day, 'esEn'), ['3', '2', '1', '4']);
  // A fresh chapter is the whole chapter in book order.
  assert.deepEqual(dueSessionIds(words, 'b', {}, day, 'esEn'), ['0', '1', '2', '3', '4', '5']);
});

test('same-day comeback is just the words answered No', () => {
  const day = '2026-01-10';
  let progress: ProgressMap = {};
  for (const w of words)
    progress[key(Number(w.id))] = answerProgress(undefined, w.id !== '2' && w.id !== '4', day, now);
  // Re-drilled to Yes later that day: still box 1.
  progress = { ...progress, [key(2)]: answerProgress(progress[key(2)], true, day, now) };
  assert.deepEqual(dueSessionIds(words, 'b', progress, day, 'esEn'), ['2', '4']);
});

test('caught up: empty deck, next due, shakiest and whole chapter', () => {
  const day = '2026-01-10';
  const progress: ProgressMap = Object.fromEntries(
    words.map((w, i) => [key(i), at(2 + (i % 3), '2026-01-09')]),
  );
  progress[key(5)] = { ...progress[key(5)], retired: true };
  assert.deepEqual(dueSessionIds(words, 'b', progress, day, 'esEn'), []);
  assert.equal(nextDueIn(words, 'b', progress, day, 'esEn'), 1);
  assert.equal(nextDueIn(words, 'b', {}, day, 'esEn'), undefined);
  // Boxes 2,3,4,2,3: lowest first; within box 2, ties keep book order.
  assert.deepEqual(shakiestIds(words, 'b', progress, day, 'esEn'), ['0', '3', '1', '4', '2']);
  assert.deepEqual(chapterSessionIds(words, 'b', progress, 'esEn'), ['0', '1', '2', '3', '4']);
  const many: Word[] = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, es: '', en: '' }));
  const seen = Object.fromEntries(many.map(w => [`b:${w.id}`, at(3, '2026-01-09')]));
  assert.equal(shakiestIds(many, 'b', seen, day, 'esEn').length, 20);
});

test('chapter deck is every word except retired ones; restoring brings a word back', () => {
  const retired = setRetired(undefined, true, now);
  assert.deepEqual(chapterSessionIds(words, 'b', { [key(2)]: retired }, 'esEn'), [
    '0',
    '1',
    '3',
    '4',
    '5',
  ]);
  const restored = setRetired(retired, false, now);
  assert.equal(chapterSessionIds(words, 'b', { [key(2)]: restored }, 'esEn').length, 6);
  assert.equal(dueSessionIds(words, 'b', { [key(2)]: restored }, '2026-01-01', 'esEn').length, 6);
});

test('book review: seen words only, most overdue first, ties longest since last answer', () => {
  const day = '2026-01-10';
  const progress: ProgressMap = {
    [key(0)]: at(1, '2026-01-08'), // 2/1 = 2, 2 days
    [key(1)]: at(2, '2026-01-06'), // 4/2 = 2, 4 days
    [key(2)]: at(3, '2026-01-09'), // 0.25
    [key(3)]: at(1, '2026-01-10'), // answered today: 0
    [key(4)]: { ...at(1, '2025-01-01'), retired: true },
  };
  assert.deepEqual(reviewOrder(words, 'b', progress, day, 'esEn'), ['1', '0', '2', '3']);
});

const ids = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`);

test('book review: Yes leaves the queue, No piles up, the pile is drilled at 10', () => {
  const order = ids(15);
  let r = startReview('d');
  r = answerReview(r, true, order, keep);
  assert.deepEqual([r.done, reviewCurrent(r, order)], [['w0'], 'w1']);
  for (let i = 0; i < DRILL_AT - 1; i++) r = answerReview(r, false, order, keep);
  assert.equal(r.pile.length, 9);
  assert.equal(r.drill, null);
  r = answerReview(r, false, order, keep);
  assert.deepEqual(r.pile, []);
  assert.deepEqual(r.drill?.queue, ids(11).slice(1));
  // Drill: w1 wrong once, everything else right; then back to the queue at w11.
  const log: string[] = [];
  while (r.drill) {
    const id = reviewCurrent(r, order)!;
    log.push(id);
    r = answerReview(r, !(id === 'w1' && log.length === 1), order, keep);
  }
  assert.deepEqual(log, [...ids(11).slice(1), 'w1']);
  assert.equal(reviewCurrent(r, order), 'w11');
});

test('book review: the pile can be drilled on demand, and when the queue runs out', () => {
  const order = ids(3);
  let r = answerReview(startReview('d'), false, order, keep);
  r = drillPile(r, keep);
  assert.deepEqual([r.pile, r.drill?.queue], [[], ['w0']]);
  r = answerReview(r, true, order, keep);
  assert.deepEqual([r.drill, reviewCurrent(r, order)], [null, 'w1']);
  r = answerReview(r, false, order, keep);
  r = answerReview(r, true, order, keep); // w2 was last: the pile (w1) is drilled
  assert.deepEqual(r.drill?.queue, ['w1']);
  r = answerReview(r, true, order, keep);
  assert.equal(reviewCurrent(r, order), undefined);
  // Words seen since (e.g. in a chapter) join the queue.
  assert.equal(reviewCurrent(r, [...order, 'w9']), 'w9');
  // A saved pile with nothing left in the queue is drilled when opened.
  const saved: Review = { day: 'd', done: ['w0', 'w1'], pile: ['w2'], drill: null };
  assert.deepEqual(openReview(saved, order, keep).drill?.queue, ['w2']);
});

test('book review: retiring takes a word out of the queue, pile and drill', () => {
  const order = ids(4);
  let r = answerReview(startReview('d'), false, order, keep);
  r = removeFromReview(r, 'w1', order, keep);
  assert.deepEqual([r.pile, reviewCurrent(r, order)], [['w0'], 'w2']);
  r = drillPile(answerReview(r, false, order, keep), keep);
  r = removeFromReview(r, 'w0', order, keep);
  assert.deepEqual(r.drill?.queue, ['w2']);
});

test('book review state resumes the same day; an old saved session finishes as a drill', () => {
  const r: Review = {
    day: '2026-01-01',
    done: ['a'],
    pile: ['b'],
    drill: startSession(['c'], '2026-01-01', keep),
  };
  assert.deepEqual(parseReview(JSON.stringify(r), '2026-01-01'), r);
  assert.equal(parseReview(JSON.stringify(r), '2026-01-02'), null);
  assert.equal(parseReview('{"day":"2026-01-01","done":[]}', '2026-01-01'), null);
  assert.equal(parseReview('null', '2026-01-01'), null);
  const legacy = startSession(['x', 'y'], '2026-01-01', keep);
  assert.deepEqual(parseReview(JSON.stringify(legacy), '2026-01-01'), {
    day: '2026-01-01',
    done: ['x', 'y'],
    pile: [],
    drill: legacy,
  });
});

test('book review reaches every word over days of partial reviews (no starvation)', () => {
  let seed = 1;
  const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const many: Word[] = Array.from({ length: 400 }, (_, i) => ({ id: String(i), es: '', en: '' }));
  const start = '2026-01-01';
  const dayAt = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
  let progress: ProgressMap = Object.fromEntries(
    many.map(w => [`b:${w.id}`, at(1 + Math.floor(rand() * 7), dayAt(-Math.floor(rand() * 30)))]),
  );
  const reached = new Set<string>();
  assert.equal(dayAt(0), start);
  // The last to come up are box-7 words, about 2.4 intervals in at this light load.
  for (let d = 0; d < 200; d++) {
    const day = dayAt(d);
    const order = reviewOrder(many, 'b', progress, day, 'esEn');
    let r = openReview(startReview(day), order, keep);
    // Some days are skipped; the rest stop after 5–25 answers.
    for (let n = rand() < 0.2 ? 0 : 5 + Math.floor(rand() * 20); n > 0; n--) {
      const id = reviewCurrent(r, order);
      if (id === undefined) break;
      if (!r.drill) reached.add(id);
      const yes = rand() < 0.8;
      const k = `b:${id}`;
      progress = { ...progress, [k]: answerProgress(progress[k], yes, day, now) };
      r = answerReview(r, yes, order, keep);
    }
  }
  assert.equal(reached.size, many.length);
});

test('strength: nothing until studied, full when fresh, shrinking to 0 when due; retired ignored', () => {
  const progress: ProgressMap = {
    [key(0)]: { box: 2, last: '2026-01-01', updatedAt: '' },
    [key(1)]: { box: 3, last: '2026-01-01', updatedAt: '' },
    [key(2)]: { box: 1, last: '2025-12-01', retired: true, updatedAt: '' },
  };
  assert.equal(strength(words, 'b', {}, '2026-01-01', 'esEn'), undefined);
  assert.equal(strength(words.slice(2), 'b', progress, '2026-01-01', 'esEn'), undefined);
  assert.equal(strength(words, 'b', progress, '2026-01-01', 'esEn'), 1);
  assert.equal(strength(words, 'b', progress, '2026-01-02', 'esEn'), (0.5 + 0.75) / 2);
  assert.equal(strength(words, 'b', progress, '2026-02-01', 'esEn'), 0);
});

test('a saved session resumes only on the same day', () => {
  const s = startSession(['a'], '2026-01-01', keep);
  assert.deepEqual(parseSession(JSON.stringify(s), '2026-01-01'), s);
  assert.equal(parseSession(JSON.stringify(s), '2026-01-02'), null);
  assert.equal(parseSession('null', '2026-01-01'), null);
  assert.equal(parseSession('{"day":"2026-01-01"}', '2026-01-01'), null);
});

test('directions are separate decks; legacy keys read as ES→EN', () => {
  const day = '2026-01-02';
  // Progress saved before directions existed uses the plain word key.
  const legacy: ProgressMap = {
    [key(0)]: { box: 1, last: '2026-01-01', updatedAt: '' },
    [key(1)]: { retired: true, updatedAt: '' },
  };
  assert.equal(progressKey('b', words[0], 'esEn'), key(0));
  assert.equal(progressKey('b', words[0], 'enEs'), `${key(0)}:en`);
  assert.deepEqual(dueSessionIds(words, 'b', legacy, day, 'esEn'), ['0', '2', '3', '4', '5']);
  assert.deepEqual(reviewOrder(words, 'b', legacy, day, 'esEn'), ['0']);
  assert.deepEqual(reviewOrder(words, 'b', legacy, day, 'enEs'), []);
  assert.equal(chapterSessionIds(words, 'b', legacy, 'esEn').length, 5);
  assert.equal(chapterSessionIds(words, 'b', legacy, 'enEs').length, 6);
  assert.equal(strength(words, 'b', legacy, day, 'enEs'), undefined);

  // Answering and retiring in EN→ES leave ES→EN as it was.
  const both: ProgressMap = {
    ...legacy,
    [progressKey('b', words[0], 'enEs')]: answerProgress(undefined, true, day, now),
    [progressKey('b', words[2], 'enEs')]: setRetired(undefined, true, now),
  };
  assert.equal(both[key(0)].box, 1);
  assert.equal(both[`${key(0)}:en`].box, 2);
  assert.deepEqual(reviewOrder(words, 'b', both, day, 'esEn'), ['0']);
  assert.deepEqual(reviewOrder(words, 'b', both, day, 'enEs'), ['0']);
  assert.deepEqual(dueSessionIds(words, 'b', both, day, 'enEs'), ['1', '3', '4', '5']);
  assert.deepEqual(chapterSessionIds(words, 'b', both, 'enEs'), ['0', '1', '3', '4', '5']);
  assert.equal(strength(words, 'b', both, day, 'esEn'), 0);
  assert.equal(strength(words, 'b', both, day, 'enEs'), 1);

  // Saved sessions and review state live under per-direction keys.
  assert.equal(forDirection('session/b/all', 'esEn'), 'session/b/all');
  assert.notEqual(forDirection('session/b/all', 'enEs'), forDirection('session/b/all', 'esEn'));
});

test('an unanswered saved session counts as untouched; any answer makes it real', () => {
  const s = startSession(['a', 'b', 'c'], '2026-11-07', ids => [...ids]);
  assert.equal(isUntouched(s), true);
  assert.equal(isUntouched(answer(s, true)), false);
  assert.equal(isUntouched(answer(s, false)), false);
});
