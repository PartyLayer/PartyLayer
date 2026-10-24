import type { Metadata } from 'next';
import TransactionLifecycleContent from './content';

const title = 'Transaction Lifecycle and Recent Activity';
const description = 'Submit Canton wallet transactions once, reconcile real ledger outcomes and show recent activity in the PartyLayer account panel.';
const url = 'https://partylayer.xyz/docs/transaction-lifecycle';
export const metadata: Metadata = { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
export default function TransactionLifecyclePage() { return <TransactionLifecycleContent />; }
