import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walletSnapshot, switchToRobinhood, signInWallet, watchWallet, type InjectedProvider } from '../lib/wallet';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { hexToString, verifyMessage } from 'viem';

const address = '0x1111111111111111111111111111111111111111';
test('wallet adapter reads real provider values and formats native wei', async () => {
  const provider: InjectedProvider = { async request({ method }) {
    if (method === 'eth_accounts') return [address];
    if (method === 'eth_chainId') return '0x1237';
    if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
    throw new Error('Unexpected method');
  } };
  assert.deepEqual(await walletSnapshot(provider), { address, chainId: 4663, correctNetwork: true, balance: '1' });
});
test('wrong-chain balances are never shown as Robinhood Chain balances', async () => {
  const provider: InjectedProvider = { async request({ method }) {
    if (method === 'eth_accounts') return [address];
    if (method === 'eth_chainId') return '0x1';
    throw new Error('Balance must not be requested on the wrong chain');
  } };
  const snapshot = await walletSnapshot(provider);
  assert.equal(snapshot.correctNetwork, false);
  assert.equal(snapshot.balance, null);
});
test('unknown-chain handling adds 4663 and verifies the resulting network', async () => {
  let chain = '0x1'; let added = false;
  const provider: InjectedProvider = { async request({ method, params }) {
    if (method === 'eth_accounts') return [address];
    if (method === 'eth_chainId') return chain;
    if (method === 'eth_getBalance') return '0x0';
    if (method === 'wallet_switchEthereumChain') {
      if (!added) throw Object.assign(new Error('Unknown chain'), { code: 4902 });
      chain = (params![0] as { chainId: string }).chainId; return null;
    }
    if (method === 'wallet_addEthereumChain') {
      assert.equal((params![0] as { chainId: string }).chainId, '0x1237'); added = true; return null;
    }
    throw new Error('Unexpected method');
  } };
  assert.equal((await switchToRobinhood(provider)).correctNetwork, true);
  assert.equal(added, true);
});
test('network switch rejection is propagated without adding a network', async () => {
  const provider: InjectedProvider = { async request() { throw Object.assign(new Error('User rejected'), { code: 4001 }); } };
  await assert.rejects(switchToRobinhood(provider), /User rejected/);
});
test('browser wallet sign-in sends a real EOA signature to the verification endpoint', async t => {
  const account = privateKeyToAccount(generatePrivateKey());
  const message = 'SENTRI sign-in integration assertion';
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let verified = false;
  globalThis.fetch = (async (url, options) => {
    const body = JSON.parse(String(options?.body));
    if (url === '/api/auth/challenge') {
      assert.equal(body.wallet, account.address);
      return Response.json({ nonce: 'fixture-nonce', message });
    }
    assert.equal(url, '/api/auth/verify');
    assert.equal(body.nonce, 'fixture-nonce');
    assert.ok(await verifyMessage({ address: account.address, message, signature: body.signature }));
    verified = true;
    return Response.json({ wallet: account.address.toLowerCase() });
  }) as typeof fetch;
  const provider: InjectedProvider = { async request({ method, params }) {
    if (method === 'eth_accounts') return [account.address];
    if (method === 'eth_chainId') return '0x1237';
    if (method === 'eth_getBalance') return '0x0';
    if (method === 'personal_sign') return account.signMessage({ message: hexToString(params![0] as `0x${string}`) });
    throw new Error('Unexpected method');
  } };
  assert.equal((await signInWallet(provider)).wallet, account.address.toLowerCase());
  assert.equal(verified, true);
});
test('account changes during signing prevent session verification', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  let changed = false; let calls = 0;
  globalThis.fetch = (async () => { calls++; return Response.json({ nonce: 'fixture', message: 'Sign in' }); }) as typeof fetch;
  const provider: InjectedProvider = { async request({ method }) {
    if (method === 'eth_accounts') return [changed ? '0x2222222222222222222222222222222222222222' : address];
    if (method === 'eth_chainId') return '0x1237';
    if (method === 'eth_getBalance') return '0x0';
    if (method === 'personal_sign') { changed = true; return '0x00'; }
    throw new Error('Unexpected method');
  } };
  await assert.rejects(signInWallet(provider), /account or network changed/);
  assert.equal(calls, 1);
});
test('wrong-chain sign-in never requests a signature or authentication challenge', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = (async () => { throw new Error('Must not request authentication on the wrong chain'); }) as typeof fetch;
  const provider: InjectedProvider = { async request({ method }) {
    if (method === 'eth_accounts') return [address];
    if (method === 'eth_chainId') return '0x1';
    throw new Error('Must not request a signature');
  } };
  await assert.rejects(signInWallet(provider), /Switch your wallet/);
});
test('account, chain, and disconnect listeners are removed on cleanup', () => {
  const registered = new Map<string, (...args: unknown[]) => void>(); let changes = 0;
  const provider: InjectedProvider = { async request() { return null; }, on(event, handler) { registered.set(event, handler); }, removeListener(event) { registered.delete(event); } };
  const cleanup = watchWallet(provider, () => { changes++; });
  assert.equal(registered.size, 3);
  registered.get('accountsChanged')!(); registered.get('chainChanged')!();
  assert.equal(changes, 2); cleanup(); assert.equal(registered.size, 0);
});
