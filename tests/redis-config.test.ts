import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redisSettings, redisKey } from '../lib/redis-config';
test('custom Redis REST credentials are supported', () => {
  assert.deepEqual(redisSettings({ REDIS_REST_URL: 'https://custom.example', REDIS_REST_TOKEN: 'custom' }), { url: 'https://custom.example', token: 'custom' });
});
test('Vercel-managed Upstash credentials are supported', () => {
  assert.deepEqual(redisSettings({ KV_REST_API_URL: 'https://managed.example', KV_REST_API_TOKEN: 'managed' }), { url: 'https://managed.example', token: 'managed' });
});
test('credential pairs from different Redis connections are never mixed', () => {
  assert.equal(redisSettings({ REDIS_REST_URL: 'https://custom.example', KV_REST_API_TOKEN: 'managed' }), null);
});
test('a complete explicit credential pair takes precedence', () => {
  assert.deepEqual(redisSettings({ REDIS_REST_URL: 'https://custom.example', REDIS_REST_TOKEN: 'custom', KV_REST_API_URL: 'https://managed.example', KV_REST_API_TOKEN: 'managed' }), { url: 'https://custom.example', token: 'custom' });
});
test('all SENTRI Redis keys are isolated from other apps sharing the store', () => {
  for (const key of ['wallet:0x123', 'challenge:nonce', 'session:hash', 'rate:wallet']) {
    assert.equal(redisKey(key), `sentri:v1:${key}`);
    assert.notEqual(redisKey(key), key);
  }
});
