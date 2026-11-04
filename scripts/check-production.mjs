// Verifies configuration without printing secrets or touching wallet records.
import { randomUUID } from 'node:crypto';

const url = process.env.REDIS_REST_URL && process.env.REDIS_REST_TOKEN ? process.env.REDIS_REST_URL : process.env.KV_REST_API_URL;
const token = process.env.REDIS_REST_URL && process.env.REDIS_REST_TOKEN ? process.env.REDIS_REST_TOKEN : process.env.KV_REST_API_TOKEN;
const required = ['APP_ORIGIN'];
const missing = required.filter(key => !process.env[key]);
if (!url || !token) missing.push('REDIS_REST_URL + REDIS_REST_TOKEN (or KV_REST_API_URL + KV_REST_API_TOKEN)');
if (missing.length) {
  console.error(`Production configuration is incomplete: ${missing.join(', ')}.`);
  process.exit(1);
}
try {
  const origin = new URL(process.env.APP_ORIGIN);
  const redisUrl = new URL(url);
  if (origin.protocol !== 'https:' || origin.origin !== process.env.APP_ORIGIN) throw new Error('APP_ORIGIN must be an exact HTTPS origin with no path or trailing slash.');
  if (redisUrl.protocol !== 'https:') throw new Error('REDIS_REST_URL must use HTTPS.');
  const command = async args => {
    const response = await fetch(redisUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Redis REST connection failed. Check its URL and access token.');
    const data = await response.json();
    if (data.error) throw new Error('Redis command failed. Confirm SET, GET, GETDEL, and EVAL are permitted.');
    return data.result;
  };
  // This key contains no wallet data and expires automatically if a later step fails.
  const key = `sentri:deployment-check:${randomUUID()}`;
  await command(['SET', key, 'ready', 'EX', 30, 'NX']);
  if (await command(['GET', key]) !== 'ready') throw new Error('Redis read-after-write verification failed.');
  if (await command(['EVAL', 'return redis.call("GET", KEYS[1])', 1, key]) !== 'ready') throw new Error('Redis atomic command verification failed.');
  if (await command(['GETDEL', key]) !== 'ready') throw new Error('Redis single-use read verification failed.');
  const rpc = process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
  if (new URL(rpc).protocol !== 'https:') throw new Error('ROBINHOOD_RPC_URL must use HTTPS.');
  const response = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(10000) });
  const result = await response.json();
  if (!response.ok || Number.parseInt(result.result, 16) !== 4663) throw new Error('RPC verification failed: Robinhood Chain 4663 is required.');
  console.log('Production configuration verified: HTTPS origin, Redis read/write and atomic commands, Robinhood Chain 4663.');
} catch (error) {
  // Native fetch errors can contain credential-bearing URLs; never print them.
  const message = error instanceof Error && !error.cause && error.message !== 'fetch failed' ? error.message : 'Connection verification failed. Check network access and the configured endpoints.';
  console.error(message);
  process.exit(1);
}
