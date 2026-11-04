import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, initialWorkspace, intentInput, policyInput, type Intent } from '../lib/model';

const wallet = '0x1111111111111111111111111111111111111111';
const other = '0x2222222222222222222222222222222222222222';
const id = 'e6b87d8a-4aa0-4cd6-a70d-6e8294326f03';
function fixture() {
  const state = initialWorkspace();
  state.agents.push({ id, name: 'Treasury', description: '', wallet, canEvaluate: true, active: true, createdAt: new Date().toISOString() });
  state.policy.authorization = true;
  state.policy.contracts = [other];
  const intent: Intent = { agentId: id, token: 'native', destination: other, amount: '0.5', slippageBps: 25, chainId: 4663 };
  return { state, intent };
}
test('allows an intent only when all eight rules pass', () => {
  const { state, intent } = fixture();
  const result = evaluate(intent, state, wallet);
  assert.equal(result.decision, 'ALLOW');
  assert.equal(result.rules.length, 8);
  assert.ok(result.rules.every(r => r.pass));
  assert.equal(result.kind, 'policy-evaluation');
  assert.equal('transactionHash' in result, false);
});
test('results are deterministic for fixed intent and policy', () => {
  const { state, intent } = fixture();
  assert.deepEqual(evaluate(intent, state, wallet, id, '2026-11-04T00:00:00Z'), evaluate(intent, state, wallet, id, '2026-11-04T00:00:00Z'));
});
for (const [label, change] of [
  ['amount', (x: ReturnType<typeof fixture>) => { x.intent.amount = '1.000000000000000001'; }],
  ['slippage', (x: ReturnType<typeof fixture>) => { x.intent.slippageBps = 51; }],
  ['network', (x: ReturnType<typeof fixture>) => { x.intent.chainId = 1; }],
  ['token', (x: ReturnType<typeof fixture>) => { x.intent.token = other; }],
  ['destination', (x: ReturnType<typeof fixture>) => { x.intent.destination = wallet; }],
  ['paused agent', (x: ReturnType<typeof fixture>) => { x.state.agents[0].active = false; }],
  ['agent permission', (x: ReturnType<typeof fixture>) => { x.state.agents[0].canEvaluate = false; }],
  ['paused authorization', (x: ReturnType<typeof fixture>) => { x.state.policy.authorization = false; }],
] as const) test(`rejects a failing ${label} rule`, () => {
  const f = fixture(); change(f);
  assert.equal(evaluate(f.intent, f.state, wallet).decision, 'REJECT');
});
test('an agent owned by another wallet is rejected', () => {
  const { state, intent } = fixture();
  const result = evaluate(intent, state, other);
  assert.equal(result.decision, 'REJECT');
  assert.equal(result.rules.find(r => r.name === 'Agent status')?.pass, false);
});
test('integer unit comparison preserves exact boundary', () => {
  const { state, intent } = fixture();
  intent.amount = '1.000000000000000000';
  assert.equal(evaluate(intent, state, wallet).decision, 'ALLOW');
  intent.amount = '1.000000000000000001';
  assert.equal(evaluate(intent, state, wallet).decision, 'REJECT');
});
test('token precision is enforced without silent rounding', () => {
  const { state, intent } = fixture();
  state.policy.tokens = [{ address: other, symbol: 'USDC', decimals: 6 }];
  intent.token = other;
  intent.amount = '0.0000001';
  assert.equal(evaluate(intent, state, wallet).decision, 'REJECT');
  intent.amount = '0.000001';
  assert.equal(evaluate(intent, state, wallet).decision, 'ALLOW');
});
test('each evaluation retains an immutable policy snapshot', () => {
  const { state, intent } = fixture();
  const result = evaluate(intent, state, wallet);
  state.policy.maxAmount = '9';
  state.policy.contracts.length = 0;
  assert.equal(result.policySnapshot.maxAmount, '1');
  assert.deepEqual(result.policySnapshot.contracts, [other]);
  assert.equal(result.policyVersion, 1);
});
test('new workspaces deny authorization and have no destinations or agents', () => {
  const state = initialWorkspace();
  const { intent } = fixture();
  assert.equal(evaluate(intent, state, wallet).decision, 'REJECT');
  assert.equal(state.agents.length, 0);
  assert.equal(state.policy.authorization, false);
  assert.deepEqual(state.policy.contracts, []);
});
test('server schemas reject malformed addresses and unsafe numbers', () => {
  const { intent } = fixture();
  for (const amount of ['-1', '0', 'NaN', '1e8', 'Infinity', '0.0000000000000000001', '01', '']) {
    assert.equal(intentInput.safeParse({ ...intent, amount }).success, false, amount);
  }
  assert.equal(intentInput.safeParse({ ...intent, destination: '0x123' }).success, false);
  assert.equal(intentInput.safeParse({ ...intent, slippageBps: 1.5 }).success, false);
  assert.equal(intentInput.safeParse({ ...intent, slippageBps: 10001 }).success, false);
  assert.equal(policyInput.safeParse({ expectedVersion: 1, maxAmount: '1', maxSlippageBps: 0, tokenAddresses: [], contracts: [], authorization: true }).success, false);
});
