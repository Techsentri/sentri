import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Workspace } from '../lib/model';

async function freePort() {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  return port;
}

test('authenticated workspace HTTP integration', { timeout: 120000 }, async t => {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const dataDir = await mkdtemp(path.join(process.cwd(), '.test-build', 'data-'));
  const child = spawn(process.execPath, ['.test-build/tests/server.js'], {
    cwd: process.cwd(), windowsHide: true,
    env: { ...process.env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', TEST_PORT: String(port), APP_ORIGIN: origin, SENTRI_DATA_DIR: dataDir, REDIS_REST_URL: '', REDIS_REST_TOKEN: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { child.kill(); });
  let output = '';
  child.stdout.on('data', b => { output += b.toString(); });
  child.stderr.on('data', b => { output += b.toString(); });
  const deadline = Date.now() + 60000;
  while (!output.includes('TEST_SERVER_READY')) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error('Integration server did not start: ' + output.slice(-3000));
    await new Promise(r => setTimeout(r, 200));
  }
  const a = privateKeyToAccount(generatePrivateKey());
  const b = privateKeyToAccount(generatePrivateKey());
  async function post(route: string, body: unknown, cookie = '', suppliedOrigin = origin) {
    return fetch(origin + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: suppliedOrigin, Cookie: cookie }, body: JSON.stringify(body) });
  }
  async function login(account: typeof a) {
    const challenge = await post('/api/auth/challenge', { wallet: account.address });
    assert.equal(challenge.status, 200);
    const { nonce, message } = await challenge.json();
    const signature = await account.signMessage({ message });
    const verified = await post('/api/auth/verify', { nonce, signature });
    assert.equal(verified.status, 200);
    const cookie = verified.headers.get('set-cookie')!;
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=strict/i);
    return { cookie: cookie.split(';')[0], nonce, signature };
  }
  let sessionA: Awaited<ReturnType<typeof login>>;
  let sessionB: Awaited<ReturnType<typeof login>>;
  let state: Workspace;
  await t.test('unauthenticated workspace reads and writes return 401', async () => {
    assert.equal((await fetch(origin + '/api/workspace')).status, 401);
    assert.equal((await post('/api/workspace', { action: 'register', data: {} })).status, 401);
  });
  await t.test('foreign origins are rejected before mutations', async () => {
    assert.equal((await post('/api/auth/challenge', { wallet: a.address }, '', 'https://foreign.example')).status, 403);
  });
  await t.test('two real wallet signatures create separate authenticated sessions', async () => {
    sessionA = await login(a); sessionB = await login(b);
    const me = await fetch(origin + '/api/auth/me', { headers: { Cookie: sessionA.cookie } });
    assert.equal((await me.json()).wallet, a.address.toLowerCase());
  });
  await t.test('signed challenges cannot be replayed', async () => {
    assert.equal((await post('/api/auth/verify', { nonce: sessionA.nonce, signature: sessionA.signature })).status, 401);
  });
  await t.test('a signature from the wrong wallet is rejected', async () => {
    const { nonce, message } = await (await post('/api/auth/challenge', { wallet: a.address })).json();
    const signature = await b.signMessage({ message });
    assert.equal((await post('/api/auth/verify', { nonce, signature })).status, 401);
  });
  await t.test('agent registration persists and uses the authenticated owner', async () => {
    const res = await post('/api/workspace', { action: 'register', data: { name: 'Treasury', description: 'Rebalance requests', canEvaluate: true } }, sessionA.cookie);
    assert.equal(res.status, 200);
    state = await res.json();
    assert.equal(state.agents[0].wallet, a.address.toLowerCase());
    const stored = await (await fetch(origin + '/api/workspace', { headers: { Cookie: sessionA.cookie } })).json();
    assert.equal(stored.agents[0].id, state.agents[0].id);
  });
  await t.test('a wallet cannot read or toggle another wallet agent', async () => {
    const own = await (await fetch(origin + '/api/workspace', { headers: { Cookie: sessionB.cookie } })).json();
    assert.equal(own.agents.length, 0);
    const res = await post('/api/workspace', { action: 'toggle', data: { id: state.agents[0].id } }, sessionB.cookie);
    assert.equal(res.status, 404);
    const unchanged = await (await fetch(origin + '/api/workspace', { headers: { Cookie: sessionA.cookie } })).json();
    assert.equal(unchanged.agents[0].active, true);
  });
  await t.test('owner fields supplied by callers are rejected', async () => {
    const res = await post('/api/workspace', { action: 'register', data: { name: 'Intruder', description: '', canEvaluate: true, wallet: b.address } }, sessionA.cookie);
    assert.equal(res.status, 400);
  });
  await t.test('policy update increments version and rejects stale writes', async () => {
    const data = { expectedVersion: state.policy.version, maxAmount: '1', maxSlippageBps: 50, tokenAddresses: ['native'], contracts: [b.address], authorization: true };
    const res = await post('/api/workspace', { action: 'policy', data }, sessionA.cookie);
    assert.equal(res.status, 200); state = await res.json();
    assert.equal(state.policy.version, 2);
    assert.equal((await post('/api/workspace', { action: 'policy', data }, sessionA.cookie)).status, 409);
    const otherState = await (await fetch(origin + '/api/workspace', { headers: { Cookie: sessionB.cookie } })).json();
    assert.equal(otherState.policy.version, 1);
    assert.equal(otherState.policy.authorization, false);
  });
  const intent = () => ({ agentId: state.agents[0].id, token: 'native', destination: b.address, amount: '0.25', slippageBps: 25, chainId: 4663 });
  await t.test('ALLOW and REJECT evaluations persist with policy snapshots and no hashes', async () => {
    const allow = await post('/api/workspace', { action: 'evaluate', data: intent() }, sessionA.cookie);
    assert.equal(allow.status, 200); state = await allow.json();
    assert.equal(state.history[0].decision, 'ALLOW');
    const reject = await post('/api/workspace', { action: 'evaluate', data: { ...intent(), amount: '2' } }, sessionA.cookie);
    assert.equal(reject.status, 200); state = await reject.json();
    assert.equal(state.history[0].decision, 'REJECT');
    assert.equal(state.history[0].policySnapshot.version, 2);
    assert.equal('transactionHash' in state.history[0], false);
    const stored = await (await fetch(origin + '/api/workspace', { headers: { Cookie: sessionA.cookie } })).json();
    assert.equal(stored.history.length, 2);
    assert.ok(stored.history[0].id);
    assert.ok(stored.history[0].timestamp);
  });
  await t.test('agent permission updates take effect on the server', async () => {
    const agent = state.agents[0];
    assert.equal((await post('/api/workspace', { action: 'updateAgent', data: { id: agent.id, name: agent.name, description: agent.description, canEvaluate: false } }, sessionA.cookie)).status, 200);
    const res = await post('/api/workspace', { action: 'evaluate', data: intent() }, sessionA.cookie);
    const result = await res.json();
    assert.equal(result.history[0].decision, 'REJECT');
    assert.equal(result.history[0].rules.find((r: {name:string}) => r.name === 'Agent permission').pass, false);
  });
  await t.test('malformed JSON and oversized bodies are rejected', async () => {
    const malformed = await fetch(origin + '/api/workspace', { method: 'POST', headers: { Origin: origin, Cookie: sessionA.cookie }, body: '{' });
    assert.equal(malformed.status, 400);
    const large = await post('/api/workspace', { padding: 'x'.repeat(40000) }, sessionA.cookie);
    assert.equal(large.status, 413);
  });
  await t.test('concurrent writes never silently overwrite another successful mutation', async () => {
    const before = await (await fetch(origin + '/api/workspace', { headers: { Cookie: sessionA.cookie } })).json();
    const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => post('/api/workspace', { action: 'register', data: { name: `Concurrent ${i}`, description: '', canEvaluate: true } }, sessionA.cookie)));
    assert.ok(responses.every(r => r.status === 200 || r.status === 409));
    const successful = responses.filter(r => r.status === 200).length;
    assert.ok(successful > 0);
    const after = await (await fetch(origin + '/api/workspace', { headers: { Cookie: sessionA.cookie } })).json();
    assert.equal(after.agents.length, before.agents.length + successful);
    assert.equal(after.revision, before.revision + successful);
  });
  await t.test('logout invalidates the server session', async () => {
    assert.equal((await post('/api/auth/logout', {}, sessionA.cookie)).status, 200);
    assert.equal((await fetch(origin + '/api/workspace', { headers: { Cookie: sessionA.cookie } })).status, 401);
  });
});
