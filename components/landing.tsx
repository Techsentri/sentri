'use client';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowRight, ArrowUpRight, Asterisk, MoveUpRight } from 'lucide-react';
import { Reveal } from './motion';

function HeroArt() {
  const reduced = useReducedMotion();
  const x = useMotionValue(0), y = useMotionValue(0);
  const px = useSpring(x, { stiffness: 70, damping: 22 }), py = useSpring(y, { stiffness: 70, damping: 22 });
  return <div className="hero-art" onPointerMove={e => { if (reduced || e.pointerType !== 'mouse') return; const box = e.currentTarget.getBoundingClientRect(); x.set(((e.clientX - box.left) / box.width - 0.5) * 22); y.set(((e.clientY - box.top) / box.height - 0.5) * 22); }} onPointerLeave={() => { x.set(0); y.set(0); }}>
    <motion.div className="art-parallax" style={{ x: reduced ? 0 : px, y: reduced ? 0 : py }}>
      <div className="art-crosshair" aria-hidden="true"><span /><span /></div>
      <svg className="orange-star float-one" viewBox="0 0 240 240" aria-hidden="true"><path d="M120 0 140 65 190 20 174 86 240 80 187 122 235 169 170 164 181 231 132 185 111 240 97 174 36 207 62 146 0 123 65 102 22 49 91 69Z" fill="currentColor" /><path d="m86 135 52-52m-43 0h43v43" fill="none" stroke="#090909" strokeWidth="10" /></svg>
      <div className="cyan-orbit float-two" aria-hidden="true"><i /><i /><i /><span /></div>
      <svg className="purple-ribbon float-three" viewBox="0 0 190 170" aria-hidden="true"><path d="M18 30c110-45 160 12 103 48S-9 79 34 124s141 10 134-32" fill="none" stroke="currentColor" strokeWidth="27" strokeLinecap="round" /></svg>
      <Link href="/policies" className="rule-sticker float-four">YOUR RULES.<br />NO EXCEPTIONS.<ArrowUpRight size={21} /></Link>
      <Link href="/terminal" className="floating-label intent-label"><span>↗</span> INTENT → POLICY → DECISION</Link>
      <Link href="/docs#network" className="floating-label chain-label">[ 4663 ]<span>ROBINHOOD CHAIN</span></Link>
      <span className="art-coordinate top-coordinate">SENTRI / CONTROL LAYER</span><span className="art-coordinate bottom-coordinate">AUTONOMOUS ≠ UNRESTRICTED</span>
    </motion.div>
  </div>;
}
const modules = [
  { number: '01', title: 'Know the actor.', label: 'AGENT REGISTRY', detail: 'A wallet-scoped identity for every agent. Explicit activation and evaluation permissions.', href: '/agents', color: 'cyan' },
  { number: '02', title: 'Define the limits.', label: 'POLICY ENGINE', detail: 'Amount ceilings, slippage limits, token allowlists, and approved destinations. Every change versioned.', href: '/policies', color: 'purple' },
  { number: '03', title: 'Interrogate the intent.', label: 'EXECUTION TERMINAL', detail: 'Deterministic ALLOW or REJECT decisions. Eight checks. A reason behind every result.', href: '/terminal', color: 'orange' },
  { number: '04', title: 'Keep the receipts.', label: 'AUDIT TRAIL', detail: 'Every policy evaluation preserved with its agent, wallet, network, and exact policy snapshot.', href: '/activity', color: 'green' },
];
export function Landing() {
  const reduced = useReducedMotion();
  return <main id="main"><section className="hero"><div className="hero-topline"><span className="eyebrow">AUTONOMOUS FINANCE NEEDS BOUNDARIES.</span><span className="mono">PRIVATE BETA</span></div><div className="hero-composition"><div className="hero-copy"><h1 aria-label="Autonomy, under control.">{['AUTONOMY,', 'UNDER', 'CONTROL.'].map((line, i) => <motion.span key={line} className={i === 1 ? 'hero-line middle-line' : 'hero-line'} initial={false} animate={reduced ? undefined : { y: [20 + i * 5, 0], opacity: [0.72, 1] }} transition={{ duration: 0.75, delay: i * 0.09, ease: [0.16, 1, 0.3, 1] }}>{line}{i === 1 && <span className="headline-asterisk" aria-hidden="true">✳</span>}</motion.span>)}</h1><div className="hero-description"><span className="hero-marker" aria-hidden="true">↳</span><div><p className="tagline">The execution firewall<br />for autonomous finance.</p><p className="supporting">AI agents make decisions.<br />SENTRI enforces the rules.</p></div></div><div className="hero-actions"><Link href="/terminal" className="button primary hero-cta">Enter terminal<ArrowUpRight size={21} /></Link><Link href="/docs" className="text-link">Explore the system<ArrowRight size={17} /></Link></div></div><HeroArt /></div><div className="hero-baseline"><a href="#system" className="scroll-cue"><ArrowDown size={15} /> SCROLL TO EXPLORE</a><span>BUILT FOR ROBINHOOD CHAIN <span className="green-text">[4663]</span></span><span className="mono">HUMAN-DEFINED. AGENT-APPLIED.</span></div></section>
    <div className="manifesto-ticker" aria-label="Define. Evaluate. Explain."><div aria-hidden="true">{[0, 1, 2, 3].map(n => <span key={n}>DEFINE THE RULES <Asterisk /> EVALUATE THE INTENT <Asterisk /> EXPLAIN THE DECISION <Asterisk /></span>)}</div></div>
    <section id="system" className="system-section"><Reveal className="section-intro"><span className="eyebrow">THE SYSTEM / FOUR CONNECTED LAYERS</span><h2>Let intelligence move.<br /><em>Keep control.</em></h2><p>A decision is only as useful as the boundaries around it. SENTRI gives you a place to define those boundaries and evaluate what happens next.</p></Reveal><div className="module-list">{modules.map(module => <Reveal key={module.number}><Link href={module.href} className={`module-row ${module.color}`}><span className="module-number">/{module.number}</span><div className="module-title"><span className="eyebrow">{module.label}</span><h3>{module.title}</h3></div><p>{module.detail}</p><span className="module-arrow"><MoveUpRight size={28} /></span></Link></Reveal>)}</div></section>
    <section className="logic-section"><Reveal className="logic-heading"><span className="eyebrow">FROM INTENTION TO EXPLANATION</span><h2>Nothing passes<br /><span>without a check.</span></h2><p>Evaluations use your saved policy. The result is deterministic, recorded, and explainable.</p><Link href="/terminal" className="text-link">Evaluate an intent<ArrowUpRight size={17} /></Link></Reveal><Reveal className="logic-diagram"><div className="diagram-label">SENTRI_ / POLICY EVALUATION</div><div className="diagram-input"><span>01 / INPUT</span><strong>Agent intent</strong><small>Agent · token · destination<br />amount · slippage · network</small></div><div className="diagram-connector">↓</div><div className="diagram-policy"><span>02 / CHECK</span><strong>Your policy.<br />Every rule.</strong><Asterisk size={54} /></div><div className="diagram-connector">↓</div><div className="diagram-decisions"><span>ALLOW ↗</span><span>REJECT ↙</span></div><p>03 / OUTPUT · DECISION + EXPLANATION + AUDIT RECORD</p></Reveal></section>
    <Reveal className="closing-section"><span className="eyebrow">PRIVATE BETA / YOUR WALLET. YOUR BOUNDARIES.</span><h2>GIVE AUTONOMY<br /><em>A RULEBOOK.</em><span aria-hidden="true">↗</span></h2><div><p>Start with an agent.<br />Put a policy between intent and action.</p><Link href="/terminal" className="button primary">Open SENTRI<ArrowUpRight size={21} /></Link></div><p className="landing-boundary">Available now: wallet connection and policy evaluation. Onchain transaction submission is not connected.</p></Reveal>
  </main>;
}
