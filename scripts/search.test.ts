import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchTopics, topicFromKey, topicKey, topicLabels } from '../src/lib/books.ts';

const labels = (q: string) => searchTopics(q).map(t => topicLabels(t).slice(1).join(' › '));

test('search matches chapter and subtopic titles, ignoring case and accents', () => {
  assert.ok(labels('jardin').includes('8-9 El jardín (The garden)'));
  assert.deepEqual(labels('FAMILY'), labels('family'));
  assert.ok(labels('familia').length > 0);
  assert.ok(labels('family').some(l => l.includes('›')));
  assert.deepEqual(searchTopics('  '), []);
});

test('topic keys round-trip and stale keys are dropped', () => {
  for (const t of searchTopics('a')) assert.deepEqual(topicFromKey(topicKey(t)), t);
  assert.equal(topicFromKey('usborne-ftw-es/999'), undefined);
  assert.equal(topicFromKey('usborne-ftw-es/1/5'), undefined);
  assert.equal(topicFromKey('gone/0'), undefined);
});
