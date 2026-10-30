import type { Metadata } from 'next';
import Content from './content';

const title = 'Canton swap integration and settlement';
const description = 'Integrate Canton swaps with PartyLayer wallet approvals, protocol quotes, transaction confirmation and output or refund tracking.';
const url = 'https://partylayer.xyz/docs/swaps';
export const metadata: Metadata = { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
export default function SwapsPage() { return <Content />; }
