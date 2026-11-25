import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { TransferPreview } from './transfer-preview';
import styles from './transfer-preview.module.css';

const title = 'Transfer Review Demo';
const description = 'Try the PartyLayer transfer review screen with sample data before a simulated wallet handoff.';
const url = 'https://partylayer.xyz/transfer-preview';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  robots: { index: false, follow: true },
  openGraph: { title, description, url },
  twitter: { title, description },
};

export default function TransferPreviewPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.nav} aria-label="Demo navigation">
          <Link className={styles.brand} href="/">
            <Image src="/favicon-new.svg" alt="" width={28} height={28} unoptimized />
            PartyLayer
          </Link>
          <Link href="/docs/token-transfers">Transfer docs <span aria-hidden="true">↗</span></Link>
        </nav>
        <header className={styles.header}>
          <h1>Review a transfer</h1>
          <p>See what the user reviews in the app before continuing to their wallet.</p>
        </header>
        <p className={styles.notice}>
          <strong>Simulation</strong>
          Uses sample data. No wallet connects, and nothing is signed or sent.
        </p>
        <TransferPreview />
      </div>
    </main>
  );
}
