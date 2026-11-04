import type { Metadata } from 'next';
import { ActivityScreen } from './screen';
export const metadata: Metadata = { title: 'Audit Trail' };
export default function Page() { return <ActivityScreen />; }
