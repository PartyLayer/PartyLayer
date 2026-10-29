import type { Metadata } from 'next';
import Content from './content';
const title = 'Upgrade an existing PartyLayer app';
const description = 'Migrate PartyLayer React providers, hooks and native CIP-0103 sessions with current setup examples, offline diagnostics and a production verification checklist.';
const url = 'https://partylayer.xyz/docs/migration';
export const metadata: Metadata = { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
export default function Page() { return <Content />; }
