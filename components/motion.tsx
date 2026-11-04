'use client';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={false} whileInView={reduced ? undefined : { opacity: [0.65, 1], y: [18, 0] }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.6, delay }}>{children}</motion.div>;
}
export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return <motion.div initial={false} animate={reduced ? undefined : { opacity: [0.8, 1], y: [7, 0] }} transition={{ duration: 0.28 }}>{children}</motion.div>;
}
