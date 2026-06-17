// Curated, module-wrapped .d.ts fed to Monaco as an extraLib so typing in the
// studio editor shows real PartyLayer IntelliSense (autocomplete + hover, with
// JSDoc). Covers EXACTLY what the connect scenario's App.tsx imports; the shapes
// match the real @partylayer/sdk + @partylayer/react source (lean, not the full
// surface — accurate, not invented).
export const PARTYLAYER_DTS = `
declare module '@partylayer/sdk' {
  /** Options for {@link createPartyLayer}. */
  export interface PartyLayerClientOptions {
    /** Canton network — e.g. 'devnet' | 'testnet' | 'mainnet'. */
    network: string;
    /** App metadata surfaced to wallets. */
    app?: { name: string; origin?: string };
    /** Wallet adapters to register (the built-ins are used when omitted). */
    adapters?: unknown[];
    /** Registry base URL (defaults to the public PartyLayer registry). */
    registryUrl?: string;
    /** Registry channel. */
    channel?: 'stable' | 'beta';
    /** Storage adapter for the session + registry cache. */
    storage?: unknown;
    /** Discovery toggles (CIP-0103 announce). */
    discovery?: { announce?: boolean; announceTimeoutMs?: number };
  }

  /** An opaque PartyLayer client — pass it to <PartyLayerProvider client={...}>. */
  export interface PartyLayerClient {}

  /** Create a PartyLayer client. (A normal app uses <PartyLayerKit> instead.) */
  export function createPartyLayer(options: PartyLayerClientOptions): PartyLayerClient;
}

declare module '@partylayer/react' {
  /** A wallet surfaced by the registry/adapters. */
  export interface WalletInfo {
    /** Stable wallet id — pass it to connect(). */
    walletId: string;
    /** Display name. */
    name: string;
    /** Icon URLs by size. */
    icons?: { sm?: string; md?: string; lg?: string };
    /** Supported capability keys. */
    capabilities?: string[];
  }

  /** An active wallet session. */
  export interface Session {
    sessionId: string;
    walletId: string;
    /** Connected Canton party id. */
    partyId: string;
    network: string;
    createdAt: number;
  }

  /** Options for the connect() returned by {@link useConnect}. */
  export interface ConnectOptions {
    /** Which wallet to connect. */
    walletId?: string;
  }

  /** Provides the PartyLayer client to descendant hooks. */
  export function PartyLayerProvider(props: { client: unknown; children?: unknown }): unknown;

  /** The discovered wallet list (reactive). */
  export function useWallets(): { wallets: WalletInfo[]; isLoading: boolean; error: Error | null };

  /** Connect to a wallet. */
  export function useConnect(): {
    /** Resolves the Session on success, or null on failure (see error). */
    connect: (options?: ConnectOptions) => Promise<Session | null>;
    /** True while a connect is in flight. */
    isConnecting: boolean;
    /** The last connect error, or null. */
    error: Error | null;
    /** Reset the connecting/error state. */
    reset: () => void;
  };
}
`;
