import type { Metadata } from 'next';
import Content from './content';
const title = 'Integrate PartyLayer with an AI coding assistant';
const description = 'Use maintained PartyLayer setup instructions, a repository integration skill and compiled code examples with your AI coding assistant.';
const url = 'https://partylayer.xyz/docs/ai-integration';
export const metadata: Metadata = { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
export default function Page() { return <Content />; }
