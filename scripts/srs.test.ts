import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  answer,
  answerProgress,
  chapterSessionIds,
  daysBetween,
  isDue,
  isFirstRound,
  parseSession,
  removeWord,
  reviewSessionIds,
  setRetired,
  startSession,
  strength,
} from '../src/lib/srs.ts';
import type { ProgressMap, Session } from '../src/lib/srs.ts';
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
  assert.deepEqual(s.queue, ['a', 'b', 'c', 'd']);
  assert.equal(isFirstRound(s), true);
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

test('boxes: Yes moves up one (unseen counts as box 1), No back to box 1, capped at 7', () => {
  const day = '2026-01-01';
  assert.equal(answerProgress(undefined, true, day, now).box, 2);
  assert.equal(answerProgress(undefined, false, day, now).box, 1);
  assert.equal(answerProgress({ box: 5, updatedAt: '' }, false, day, now).box, 1);
  assert.equal(answerProgress({ box: 7, updatedAt: '' }, true, day, now).box, 7);
  assert.equal(answerProgress(undefined, true, day, now).last, day);
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

test('review deck: due and unseen words in book order, unseen capped; retired skipped', () => {
  const progress: ProgressMap = {
    [key(1)]: { box: 1, last: '2026-01-01', updatedAt: '' }, // due on the 2nd
    [key(3)]: { box: 3, last: '2026-01-01', updatedAt: '' }, // due on the 5th
    [key(4)]: { retired: true, updatedAt: '' },
  };
  assert.deepEqual(reviewSessionIds(words, 'b', progress, 2, '2026-01-02'), ['0', '1', '2']);
  assert.deepEqual(reviewSessionIds(words, 'b', progress, 0, '2026-01-05'), ['1', '3']);
  assert.deepEqual(reviewSessionIds(words, 'b', progress, 9, '2026-01-01'), ['0', '2', '5']);
});

test('chapter deck is every word except retired ones; restoring brings a word back', () => {
  const retired = setRetired(undefined, true, now);
  assert.deepEqual(chapterSessionIds(words, 'b', { [key(2)]: retired }), ['0', '1', '3', '4', '5']);
  const restored = setRetired(retired, false, now);
  assert.equal(chapterSessionIds(words, 'b', { [key(2)]: restored }).length, 6);
  assert.deepEqual(reviewSessionIds(words, 'b', { [key(2)]: restored }, 9, '2026-01-01').length, 6);
});

test('strength: nothing until studied, full when fresh, shrinking to 0 when due; retired ignored', () => {
  const progress: ProgressMap = {
    [key(0)]: { box: 2, last: '2026-01-01', updatedAt: '' },
    [key(1)]: { box: 3, last: '2026-01-01', updatedAt: '' },
    [key(2)]: { box: 1, last: '2025-12-01', retired: true, updatedAt: '' },
  };
  assert.equal(strength(words, 'b', {}, '2026-01-01'), undefined);
  assert.equal(strength(words.slice(2), 'b', progress, '2026-01-01'), undefined);
  assert.equal(strength(words, 'b', progress, '2026-01-01'), 1);
  assert.equal(strength(words, 'b', progress, '2026-01-02'), (0.5 + 0.75) / 2);
  assert.equal(strength(words, 'b', progress, '2026-02-01'), 0);
});

test('a saved session resumes only on the same day', () => {
  const s = startSession(['a'], '2026-01-01', keep);
  assert.deepEqual(parseSession(JSON.stringify(s), '2026-01-01'), s);
  assert.equal(parseSession(JSON.stringify(s), '2026-01-02'), null);
  assert.equal(parseSession('null', '2026-01-01'), null);
  assert.equal(parseSession('{"day":"2026-01-01"}', '2026-01-01'), null);
});
