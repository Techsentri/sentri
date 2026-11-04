import type { Metadata } from 'next';
import { TerminalScreen } from './screen';
export const metadata: Metadata = { title: 'Execution Terminal' };
export default function Page() { return <TerminalScreen />; }
