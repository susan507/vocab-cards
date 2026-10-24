import assert from 'node:assert/strict';
import { test } from 'node:test';
import { credentials } from '../src/lib/credentials.ts';

test('name maps to a normalized synthetic email and the PIN to a 6+ char password', () => {
  assert.deepEqual(credentials('  Ana.M_1 ', '1234'), {
    email: 'ana.m_1@vocab-cards.local',
    password: 'vc-pin-1234',
  });
});

test('rejects bad names and PINs', () => {
  assert.equal(credentials('', '1234'), null);
  assert.equal(credentials('ana maría', '1234'), null);
  assert.equal(credentials('a'.repeat(31), '1234'), null);
  assert.equal(credentials('ana', '123'), null);
  assert.equal(credentials('ana', '1234567'), null);
  assert.equal(credentials('ana', '12a4'), null);
});
