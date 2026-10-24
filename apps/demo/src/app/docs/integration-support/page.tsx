import type { Metadata } from 'next';
import Content from './content';
const title = 'Canton wallet integration support';
const description = 'Get help integrating PartyLayer into a Canton dApp, report a reproducible wallet issue, or contribute a CIP-0103 wallet through the shared provider path.';
const url = 'https://partylayer.xyz/docs/integration-support';
export const metadata: Metadata = { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
export default function Page() { return <Content />; }
