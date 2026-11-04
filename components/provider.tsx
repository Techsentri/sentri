'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { connectWallet, signInWallet, switchToRobinhood, walletSnapshot, watchWallet, type InjectedProvider, type WalletSnapshot } from '@/lib/wallet';
import type { Workspace } from '@/lib/model';

type WalletOption = { id: string; name: string; provider: InjectedProvider };
type Context = {
  snapshot: WalletSnapshot | null; sessionWallet: string | null; workspace: Workspace | null;
  options: WalletOption[]; busy: boolean; loading: boolean; error: string | null;
  walletOpen: boolean; setWalletOpen: (v: boolean) => void;
  connect: (option: WalletOption) => Promise<void>; authorize: () => Promise<void>;
  switchNetwork: () => Promise<void>; disconnect: () => Promise<void>; refresh: () => Promise<void>;
  mutate: (action: string, data: unknown) => Promise<Workspace>;
};
const State = createContext<Context | null>(null);
export const shortAddress = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
export function useSentri() { const context = useContext(State); if (!context) throw new Error('SENTRI context missing.'); return context; }
export async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'Request failed. Please try again.'), { status: response.status });
  return result;
}
function readable(error: unknown) {
  if ((error as { code?: number })?.code === 4001) return 'Wallet request declined. You can try again when ready.';
  return error instanceof Error ? error.message : 'Wallet request failed. Please try again.';
}

export function Provider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const provider = useRef<InjectedProvider | null>(null);
  const stopWatching = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const actionLock = useRef(false);

  const loadWorkspace = useCallback(async (active: WalletSnapshot, expectedGeneration: number) => {
    const session = await request<{ wallet: string | null }>('/api/auth/me');
    if (generation.current !== expectedGeneration) return;
    if (!active.correctNetwork || !active.address || session.wallet !== active.address.toLowerCase()) {
      setSessionWallet(null); setWorkspace(null); return;
    }
    const data = await request<Workspace>('/api/workspace');
    if (generation.current === expectedGeneration) { setSessionWallet(session.wallet); setWorkspace(data); }
  }, []);

  const refresh = useCallback(async () => {
    if (!provider.current) return;
    const stamp = generation.current;
    const active = await walletSnapshot(provider.current);
    if (stamp !== generation.current) return;
    setSnapshot(active);
    await loadWorkspace(active, stamp);
  }, [loadWorkspace]);

  const selectProvider = useCallback((selected: InjectedProvider) => {
    stopWatching.current?.(); provider.current = selected;
    stopWatching.current = watchWallet(selected, () => {
      const stamp = ++generation.current;
      setSessionWallet(null); setWorkspace(null); setError(null);
      void walletSnapshot(selected).then(active => {
        if (stamp === generation.current) setSnapshot(active);
      }).catch(e => { if (stamp === generation.current) setError(readable(e)); });
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const injected = (window as Window & { ethereum?: InjectedProvider }).ethereum;
    const announce = (event: Event) => {
      const { info, provider: announced } = (event as CustomEvent<{ info: { uuid: string; name: string }; provider: InjectedProvider }>).detail || {};
      if (!info?.uuid || !info.name || !announced?.request) return;
      setOptions(old => old.some(p => p.id === info.uuid) ? old : [...old.filter(p => p.provider !== announced), { id: info.uuid, name: info.name, provider: announced }]);
    };
    window.addEventListener('eip6963:announceProvider', announce);
    if (injected) {
      setOptions([{ id: 'injected', name: 'Browser wallet', provider: injected }]);
      selectProvider(injected);
      void refresh().catch(e => { if (mounted) setError(readable(e)); }).finally(() => { if (mounted) setLoading(false); });
    } else setLoading(false);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => { mounted = false; ++generation.current; stopWatching.current?.(); window.removeEventListener('eip6963:announceProvider', announce); };
  }, [refresh, selectProvider]);

  const run = async (fn: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(readable(e)); }
    finally { actionLock.current = false; setBusy(false); }
  };
  const connect = (option: WalletOption) => run(async () => {
    const stamp = ++generation.current;
    setSessionWallet(null); setWorkspace(null); selectProvider(option.provider);
    const active = await connectWallet(option.provider);
    // Some wallets emit accountsChanged while handling the connection request.
    const current = generation.current;
    if (current >= stamp) { setSnapshot(active); await loadWorkspace(active, current); }
  });
  const switchNetwork = () => run(async () => {
    if (!provider.current) throw new Error('Connect a wallet first.');
    const active = await switchToRobinhood(provider.current); setSnapshot(active);
    await loadWorkspace(active, generation.current);
  });
  const authorize = () => run(async () => {
    if (!provider.current) throw new Error('Connect a wallet first.');
    const stamp = generation.current;
    await signInWallet(provider.current);
    if (stamp !== generation.current) throw new Error('Wallet changed. Please sign in again.');
    await refresh(); setWalletOpen(false);
  });
  const disconnect = () => run(async () => {
    await request('/api/auth/logout', {}); ++generation.current;
    stopWatching.current?.(); stopWatching.current = null; provider.current = null;
    setSnapshot(null); setSessionWallet(null); setWorkspace(null); setWalletOpen(false);
  });
  const mutate = async (action: string, data: unknown) => {
    if (!sessionWallet || !snapshot?.correctNetwork || snapshot.address?.toLowerCase() !== sessionWallet) throw new Error('Connect and sign in with your wallet first.');
    const stamp = generation.current;
    try {
      const result = await request<Workspace>('/api/workspace', { action, data });
      if (stamp !== generation.current) throw new Error('Wallet changed during the request. Reconnect to view its result.');
      setWorkspace(result); return result;
    } catch (e) {
      if ((e as { status?: number }).status === 401) { setError(readable(e)); setSessionWallet(null); setWorkspace(null); setWalletOpen(true); }
      if ((e as { status?: number }).status === 409) await refresh().catch(() => {});
      throw e;
    }
  };

  return <MotionConfig reducedMotion="user"><State.Provider value={{ snapshot, sessionWallet, workspace, options, busy, loading, error, walletOpen, setWalletOpen, connect, authorize, switchNetwork, disconnect, refresh, mutate }}>{children}</State.Provider></MotionConfig>;
}
