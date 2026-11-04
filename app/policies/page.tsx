import type { Metadata } from 'next';
import { PoliciesScreen } from './screen';
export const metadata: Metadata = { title: 'Policy Engine' };
export default function Page() { return <PoliciesScreen />; }
