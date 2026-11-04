// Browser wallet adapter. No private keys, token approvals, or transaction submission.
import { formatEther, isAddress, type Address } from 'viem';
import { CHAIN_ID, EXPLORER } from './model';

export type InjectedProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: 'accountsChanged' | 'chainChanged' | 'disconnect', listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};
export type WalletSnapshot = { address: Address | null; chainId: number; correctNetwork: boolean; balance: string | null };

export async function walletSnapshot(provider: InjectedProvider): Promise<WalletSnapshot> {
  const [accounts, hexChain] = await Promise.all([
    provider.request({ method: 'eth_accounts' }), provider.request({ method: 'eth_chainId' }),
  ]);
  if (!Array.isArray(accounts) || typeof hexChain !== 'string' || !/^0x[\da-f]+$/i.test(hexChain)) {
    throw new Error('Wallet returned an invalid account or network response.');
  }
  const address = typeof accounts[0] === 'string' && isAddress(accounts[0]) ? accounts[0] as Address : null;
  const chainId = Number.parseInt(hexChain, 16);
  if (!Number.isSafeInteger(chainId)) throw new Error('Wallet returned an invalid network.');
  const correctNetwork = chainId === CHAIN_ID;
  let balance: string | null = null;
  if (address && correctNetwork) {
    const value = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
    if (typeof value !== 'string' || !/^0x[\da-f]+$/i.test(value)) throw new Error('Wallet returned an invalid balance.');
    balance = formatEther(BigInt(value));
  }
  return { address, chainId, correctNetwork, balance };
}

export async function connectWallet(provider: InjectedProvider) {
  await provider.request({ method: 'eth_requestAccounts' });
  return walletSnapshot(provider);
}

export async function switchToRobinhood(provider: InjectedProvider) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1237' }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await provider.request({ method: 'wallet_addEthereumChain', params: [{
      chainId: '0x1237', chainName: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: [process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com'],
      blockExplorerUrls: [EXPLORER],
    }] });
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1237' }] });
  }
  const snapshot = await walletSnapshot(provider);
  if (!snapshot.correctNetwork) throw new Error('Switch your wallet to Robinhood Chain (4663).');
  return snapshot;
}

async function api(route: string, body: unknown) {
  const response = await fetch(route, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Wallet sign-in failed.');
  return data;
}

export async function signInWallet(provider: InjectedProvider) {
  const snapshot = await walletSnapshot(provider);
  if (!snapshot.address) throw new Error('Connect a wallet first.');
  if (!snapshot.correctNetwork) throw new Error('Switch your wallet to Robinhood Chain (4663).');
  const challenge = await api('/api/auth/challenge', { wallet: snapshot.address });
  // Encode the human-readable sign-in message for EIP-1193 personal_sign.
  const encoded = '0x' + Array.from(new TextEncoder().encode(challenge.message as string), b => b.toString(16).padStart(2, '0')).join('');
  const signature = await provider.request({ method: 'personal_sign', params: [encoded, snapshot.address] });
  const current = await walletSnapshot(provider);
  if (current.address?.toLowerCase() !== snapshot.address.toLowerCase() || !current.correctNetwork) {
    throw new Error('Wallet account or network changed. Sign in again.');
  }
  return api('/api/auth/verify', { nonce: challenge.nonce, signature });
}

export function watchWallet(provider: InjectedProvider, onChange: () => void) {
  const listener = () => { onChange(); };
  for (const event of ['accountsChanged', 'chainChanged', 'disconnect'] as const) provider.on?.(event, listener);
  return () => { for (const event of ['accountsChanged', 'chainChanged', 'disconnect']) provider.removeListener?.(event, listener); };
}
