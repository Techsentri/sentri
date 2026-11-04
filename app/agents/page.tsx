import type { Metadata } from 'next';
import { AgentsScreen } from './screen';
export const metadata: Metadata = { title: 'Agent Registry' };
export default function Page() { return <AgentsScreen />; }
