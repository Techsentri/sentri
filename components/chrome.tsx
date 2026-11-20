'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, ArrowRight, X, Menu, Wallet, Check, LoaderCircle, Shield } from 'lucide-react';
import { shortAddress, useSentri } from './provider';

const links = [['/terminal', 'Terminal'], ['/agents', 'Agents'], ['/policies', 'Policies'], ['/activity', 'Activity'], ['/docs', 'Docs']] as const;
function HeaderSocialLinks() {
  const reduced = useReducedMotion();
  const interaction = { whileHover: reduced ? undefined : { y: -2 }, transition: { duration: 0.18 } };
  return <div className="header-social-links" role="group" aria-label="SENTRI social links">
    <motion.a {...interaction} className="header-social-link" href="https://github.com/Techsentri" aria-label="SENTRI on GitHub (opens in a new tab)" target="_blank" rel="noopener noreferrer">
      {/* Official GitHub mark: Primer Octicons mark-github-24. */}
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false"><path d="M10.226 17.284c-2.965-.36-5.054-2.493-5.054-5.256 0-1.123.404-2.336 1.078-3.144-.292-.741-.247-2.314.09-2.965.898-.112 2.111.36 2.83 1.01.853-.269 1.752-.404 2.853-.404 1.1 0 1.999.135 2.807.382.696-.629 1.932-1.1 2.83-.988.315.606.36 2.179.067 2.942.72.854 1.101 2 1.101 3.167 0 2.763-2.089 4.852-5.098 5.234.763.494 1.28 1.572 1.28 2.807v2.336c0 .674.561 1.056 1.235.786 4.066-1.55 7.255-5.615 7.255-10.646C23.5 6.188 18.334 1 11.978 1 5.62 1 .5 6.188.5 12.545c0 4.986 3.167 9.12 7.435 10.669.606.225 1.19-.18 1.19-.786V20.63a2.9 2.9 0 0 1-1.078.224c-1.483 0-2.359-.808-2.987-2.313-.247-.607-.517-.966-1.034-1.033-.27-.023-.359-.135-.359-.27 0-.27.45-.471.898-.471.652 0 1.213.404 1.797 1.235.45.651.921.943 1.483.943.561 0 .92-.202 1.437-.719.382-.381.674-.718.944-.943" /></svg>
    </motion.a>
    <motion.a {...interaction} className="header-social-link" href="https://x.com/_SENTRIapp" aria-label="SENTRI on X (opens in a new tab)" target="_blank" rel="noopener noreferrer">
      {/* Official X brand-toolkit logo; currentColor preserves its silhouette. */}
      <svg viewBox="0 0 1200 1227" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false"><path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" /></svg>
    </motion.a>
  </div>;
}
export function Header() {
  const path = usePathname(); const [open, setOpen] = useState(false);
  const { sessionWallet, snapshot, setWalletOpen } = useSentri();
  useEffect(() => setOpen(false), [path]);
  return <><a className="skip-link" href="#main">Skip to content</a><header className="site-header">
    <Link href="/" className="wordmark" aria-label="SENTRI home">SENTRI<span>_</span></Link>
    <span className="beta-label"><i /> PRIVATE BETA</span>
    <nav className={open ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">{links.map(([href, text]) => <Link key={href} href={href} className={path === href ? 'active' : ''} aria-current={path === href ? 'page' : undefined}>{text}<span>↗</span></Link>)}<HeaderSocialLinks /></nav>
    <button className="wallet-button" onClick={() => setWalletOpen(true)}><span className={sessionWallet ? 'live-dot' : 'offline-dot'} /><span>{sessionWallet ? shortAddress(sessionWallet) : snapshot?.address ? 'Sign in' : 'Connect wallet'}</span><Wallet size={15} /></button>
    <button className="menu-button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
  </header></>;
}
export function Footer() {
  return <footer className="site-footer"><Link href="/" className="wordmark">SENTRI<span>_</span></Link><p>AI agents make decisions.<br />SENTRI enforces the rules.</p><div className="footer-right"><span className="mono">ROBINHOOD CHAIN · 4663</span><Link href="/docs">Read the documentation <ArrowUpRight size={14} /></Link></div></footer>;
}
export function WalletDialog() {
  const s = useSentri(); const dialog = useRef<HTMLDialogElement>(null); const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (s.walletOpen) { opener.current = document.activeElement as HTMLElement; dialog.current?.showModal(); }
    else if (dialog.current?.open) { dialog.current.close(); opener.current?.focus(); }
  }, [s.walletOpen]);
  return <dialog ref={dialog} className="wallet-dialog" aria-labelledby="wallet-title" onCancel={() => s.setWalletOpen(false)} onClick={e => { if (e.target === dialog.current) s.setWalletOpen(false); }}><div className="dialog-inner">
    <button className="close-button" aria-label="Close wallet dialog" onClick={() => s.setWalletOpen(false)}><X size={21} /></button>
    <span className="eyebrow">YOUR WALLET. YOUR RULES.</span><h2 id="wallet-title">Establish<br /><em>connection.</em></h2>
    <p className="muted">Connect an EVM wallet, verify Robinhood Chain, then sign a message to access your workspace.</p>
    <ol className="wallet-steps"><li className={s.snapshot?.address ? 'done' : ''}><span>{s.snapshot?.address ? <Check size={14} /> : '01'}</span>Connect wallet {s.snapshot?.address && <code>{shortAddress(s.snapshot.address)}</code>}</li><li className={s.snapshot?.correctNetwork ? 'done' : ''}><span>{s.snapshot?.correctNetwork ? <Check size={14} /> : '02'}</span>Robinhood Chain <code>4663</code></li><li className={s.sessionWallet ? 'done' : ''}><span>{s.sessionWallet ? <Check size={14} /> : '03'}</span>Sign in to SENTRI</li></ol>
    {s.error && <div className="feedback error" role="alert">{s.error}</div>}
    {!s.snapshot?.address ? <div className="provider-list">{s.options.length ? s.options.map(option => <button className="button primary full" key={option.id} disabled={s.busy} onClick={() => s.connect(option)}>{s.busy ? <LoaderCircle className="spin" size={17} /> : <Wallet size={17} />} {option.name}<ArrowRight size={17} /></button>) : <div className="feedback">No compatible wallet detected. Open this site in a wallet-enabled browser with MetaMask or another EVM wallet installed.</div>}</div> : !s.snapshot.correctNetwork ? <button className="button primary full" disabled={s.busy} onClick={s.switchNetwork}>Switch to Robinhood Chain <ArrowRight size={17} /></button> : !s.sessionWallet ? <button className="button primary full" disabled={s.busy} onClick={s.authorize}>{s.busy ? 'Waiting for wallet…' : 'Sign in with wallet'}<ArrowRight size={17} /></button> : <><div className="balance-line"><span>Native balance</span><strong>{s.snapshot.balance ?? 'Unavailable'} ETH</strong></div><button className="button outline full" disabled={s.busy} onClick={s.disconnect}>Sign out</button></>}
    <p className="fine-print"><Shield size={13} /> Sign-in grants no token approvals or transaction permissions. SENTRI never holds your private keys.</p>
  </div></dialog>;
}
export function Gate({ children }: { children: React.ReactNode }) {
  const { workspace, loading, setWalletOpen, snapshot, error } = useSentri();
  if (workspace) return children;
  return <section className="access-gate"><div className="gate-symbol" aria-hidden="true">↗</div><div><span className="eyebrow">WALLET-SCOPED WORKSPACE</span><h2>{loading ? 'Checking your connection.' : 'Your control starts here.'}</h2><p>{loading ? 'Retrieving your wallet session…' : snapshot?.address ? 'Verify your network and sign in to access your agents, policies, and evaluation history.' : 'Connect and sign in to create agents, set rules, and evaluate transaction intents.'}</p>{error && <p className="error-text" role="alert">{error}</p>}<button className="button primary" disabled={loading} onClick={() => setWalletOpen(true)}>{loading ? <LoaderCircle size={17} className="spin" /> : <Wallet size={17} />} {snapshot?.address ? 'Open wallet connection' : 'Connect wallet'}<ArrowUpRight size={18} /></button><p className="fine-print">Your signature proves wallet ownership. It does not authorize transactions.</p></div></section>;
}
