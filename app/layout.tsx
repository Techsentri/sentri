import type { Metadata } from 'next';
import { Provider } from '@/components/provider';
import { Header, Footer, WalletDialog } from '@/components/chrome';
import './globals.css';
export const metadata: Metadata = { title: { default: 'SENTRI_ — The execution firewall for autonomous finance.', template: '%s — SENTRI_' }, description: 'AI agents make decisions. SENTRI enforces the rules. A private beta for wallet-scoped policies and transaction-intent evaluation on Robinhood Chain.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en" data-scroll-behavior="smooth"><body><Provider><Header />{children}<Footer /><WalletDialog /></Provider></body></html>; }
