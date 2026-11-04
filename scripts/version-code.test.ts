import assert from 'node:assert/strict';
import { test } from 'node:test';
import { versionCode } from '../app.config.ts';

test('versionCode increases with each version and rejects malformed ones', () => {
  assert.equal(versionCode('0.3.0'), 300);
  assert.ok(versionCode('0.10.0') > versionCode('0.9.99'));
  assert.ok(versionCode('1.0.0') > versionCode('0.99.99'));
  assert.throws(() => versionCode('1.0'));
  assert.throws(() => versionCode('0.100.0'));
});
