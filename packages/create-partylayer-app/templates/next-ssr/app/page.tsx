import { getServerSession, truncateParty } from '@/lib/session';
import { ConnectButton } from '@/components/ConnectButton';

// Reading cookies() opts this route into dynamic (per-request) rendering — which
// is exactly what SSR session needs: the server reads the session cookie on
// every request and renders the connected state into the initial HTML.
export default function Home() {
  const session = getServerSession();
  const party = session?.account?.partyId ?? null;

  return (
    <main className="app">
      <h1>{{PROJECT_NAME}}</h1>
      <p className="subtitle">A PartyLayer dApp on Canton — connect any verified wallet.</p>

      {/* SERVER-RENDERED connected state (Option A: server owns the display). This
          appears in the initial HTML from the cookie, before any client JS, so
          there is no disconnected→connected flash. */}
      {party ? (
        <p className="session">
          Connected as <code data-testid="server-party">{truncateParty(party)}</code>
        </p>
      ) : (
        <p className="session" data-testid="server-cta">
          Not connected — connect a wallet to continue.
        </p>
      )}

      {/* Interactive client island — reconciles silently with the live provider. */}
      <ConnectButton />
    </main>
  );
}
