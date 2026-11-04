import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walletSnapshot, switchToRobinhood, type InjectedProvider } from '../lib/wallet';

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
