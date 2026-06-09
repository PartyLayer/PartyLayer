import { useMemo, useState } from 'react';
import { PartyLayerKit, WalletModal } from '@partylayer/react';
import { ToastProvider } from '@/components/ui/Toast';
import { Nav } from '@/components/Nav';
import { Background } from '@/components/Background';
import {
  Hero,
  ProofBar,
  HowItWorks,
  WalletGrid,
  DeveloperQuickstart,
  FAQ,
  Footer,
} from '@/components/sections';
import { Demo } from '@/components/sections/Demo';
import {
  buildMarketingAdapters,
  MARKETING_WALLET_ORDER,
  MARKETING_WALLET_ICONS,
  MARKETING_REGISTRY_URL,
} from '@/lib/connect-kit';

function AppContent() {
  // Single shared connect-modal state — opened by the Hero CTA, the Demo
  // section, and the wallet grid. The REAL @partylayer/react modal (rendered
  // once below, inside PartyLayerKit) handles detection / order / network-safety.
  const [connectOpen, setConnectOpen] = useState(false);
  const openConnect = () => setConnectOpen(true);

  return (
    <Background>
      <Nav />
      <main>
        <Hero onConnect={openConnect} />
        <ProofBar />
        <HowItWorks />
        <WalletGrid onConnect={openConnect} />
        <DeveloperQuickstart />
        <section id="demo">
          <Demo onConnect={openConnect} />
        </section>
        <FAQ />
      </main>
      <Footer />
      <WalletModal isOpen={connectOpen} onClose={() => setConnectOpen(false)} />
    </Background>
  );
}

export function App() {
  // Build the adapter set once (same set the demo registers). walletOrder +
  // walletIcons are derived from the canonical tokens `wallets` source.
  const adapters = useMemo(() => buildMarketingAdapters(), []);
  return (
    <ToastProvider>
      <PartyLayerKit
        network="devnet"
        appName="PartyLayer"
        adapters={adapters}
        walletOrder={MARKETING_WALLET_ORDER}
        walletIcons={MARKETING_WALLET_ICONS}
        registryUrl={MARKETING_REGISTRY_URL}
      >
        <AppContent />
      </PartyLayerKit>
    </ToastProvider>
  );
}
