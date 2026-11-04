'use client';
import { useState, type FormEvent } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Gate } from '@/components/chrome';
import { useSentri } from '@/components/provider';
import { Feedback, ProductHeading, Submit, percentToBps } from '@/components/product';
import { policyInput, type Policy } from '@/lib/model';

function PolicyForm({ policy, onError }: { policy: Policy; onError: (message: string) => void }) {
  const { mutate } = useSentri();
  const [amount, setAmount] = useState(policy.maxAmount); const [slippage, setSlippage] = useState(String(policy.maxSlippageBps / 100));
  const [tokens, setTokens] = useState(policy.tokens.map(t => t.address).join('\n')); const [contracts, setContracts] = useState(policy.contracts.join('\n'));
  const [authorized, setAuthorized] = useState(policy.authorization); const [pending, setPending] = useState(false);
  const split = (value: string) => value.split(/[\n,]+/).map(v => v.trim()).filter(Boolean);
  async function save(event: FormEvent) {
    event.preventDefault(); setPending(true); onError('');
    try {
      const data = policyInput.safeParse({ expectedVersion: policy.version, maxAmount: amount, maxSlippageBps: percentToBps(slippage), tokenAddresses: split(tokens), contracts: split(contracts), authorization: authorized });
      if (!data.success) throw new Error(data.error.issues.map(i => i.message).join(' '));
      await mutate('policy', data.data);
    } catch (e) { onError((e as Error).message); } finally { setPending(false); }
  }
  return <form className="policy-form" onSubmit={save}><div className="section-label"><span>EDIT ENFORCEMENT RULES</span><span>BASED ON v{policy.version}</span></div><div className="two-fields"><label>Maximum transaction amount<div className="input-with-unit"><input inputMode="decimal" required value={amount} onChange={e => setAmount(e.target.value)} /><span>TOKEN UNITS</span></div><small>The same limit applies per token, in its native units.</small></label><label>Maximum expected slippage<div className="input-with-unit"><input inputMode="decimal" required value={slippage} onChange={e => setSlippage(e.target.value)} /><span>%</span></div><small>0–100%. Up to two decimal places.</small></label></div><label>Allowed tokens<textarea className="code-input" value={tokens} onChange={e => setTokens(e.target.value)} rows={4} required spellCheck={false} /><small>One address per line. Use <code>native</code> for ETH. ERC-20 decimals are verified on Robinhood Chain when saved.</small></label><label>Allowed destination contracts<textarea className="code-input" value={contracts} onChange={e => setContracts(e.target.value)} rows={4} spellCheck={false} placeholder="0x… (one address per line)" /><small>An empty destination allowlist rejects every intent. Only explicitly listed addresses pass.</small></label><label className="check-field authorization-toggle"><input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)} /><span>Enable policy authorization<small>{authorized ? 'Intents can receive ALLOW when every rule passes.' : 'All intents receive REJECT while authorization is paused.'}</small></span><ShieldCheck size={21} /></label><div className="form-actions"><Submit pending={pending}>Save policy v{policy.version + 1}<ArrowUpRight size={17} /></Submit><span className="fine-print">Updates apply to future evaluations.</span></div></form>;
}
function Policies() {
  const { workspace } = useSentri(); const policy = workspace!.policy; const [error, setError] = useState('');
  return <div className="split-workspace policy-layout"><div><Feedback error={error} /><PolicyForm key={policy.version} policy={policy} onError={setError} /></div><aside className="policy-aside"><span className="eyebrow">CURRENT POLICY</span><div className="version-number">v{policy.version}<span>↗</span></div><span className={`status-tag ${policy.authorization ? 'green' : 'orange'}`}>{policy.authorization ? 'AUTHORIZATION ENABLED' : 'AUTHORIZATION PAUSED'}</span><dl className="policy-summary"><div><dt>Amount ceiling</dt><dd>{policy.maxAmount}<small> per token</small></dd></div><div><dt>Slippage ceiling</dt><dd>{policy.maxSlippageBps / 100}%</dd></div><div><dt>Approved tokens</dt><dd>{policy.tokens.length}</dd></div><div><dt>Approved destinations</dt><dd>{policy.contracts.length}</dd></div></dl><div className="verified-tokens">{policy.tokens.map(token => <div key={token.address}><strong>{token.symbol}</strong><span>{token.decimals} decimals</span></div>)}</div>{policy.version > 1 && <p className="fine-print" role="status">Policy v{policy.version} saved · {new Date(policy.updatedAt).toLocaleString('en-US')}</p>}<p className="boundary-note">An ALLOW decision validates intent fields. It does not authorize your wallet to sign or broadcast a transaction.</p><Link href="/terminal" className="text-link">Evaluate an intent <ArrowUpRight size={16} /></Link></aside></div>;
}
export function PoliciesScreen() { return <main id="main" className="product-page"><ProductHeading index="02" label="POLICY ENGINE" title="Set the boundaries." description="Explicit limits. Approved destinations. Versioned decisions. Your wallet sets the rules." /><Gate><Policies /></Gate></main>; }
