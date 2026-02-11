/**
 * Native CIP-0103 Adapter
 *
 * Wraps a discovered CIP-0103 Provider into the PartyLayer WalletAdapter interface.
 * This allows native CIP-0103 wallets (injected at window.canton.* etc.) to be used
 * through the standard SDK connect flow alongside registry-based adapters.
 */

import type {
  WalletId,
  PartyId,
  CapabilityKey,
  Session,
  WalletInfo,
  WalletAdapter,
  AdapterContext,
  AdapterDetectResult,
  AdapterConnectResult,
  SignedMessage,
  SignedTransaction,
  TxReceipt,
  SignMessageParams,
  SignTransactionParams,
  SubmitTransactionParams,
} from '@partylayer/sdk';
import type {
  CIP0103Provider,
  CIP0103ConnectResult,
  CIP0103StatusEvent,
  CIP0103Account,
  DiscoveredProvider,
} from '@partylayer/sdk';

// ─── Adapter ────────────────────────────────────────────────────────────────

/**
 * A WalletAdapter that delegates to a native CIP-0103 Provider.
 *
 * Created dynamically when a CIP-0103 provider is discovered at runtime.
 * Routes all SDK operations through the provider's `request()` method.
 */
export class NativeCIP0103Adapter implements WalletAdapter {
  readonly walletId: WalletId;
  readonly name: string;
  private provider: CIP0103Provider;

  constructor(id: string, name: string, provider: CIP0103Provider) {
    this.walletId = id as WalletId;
    this.name = name;
    this.provider = provider;
  }

  getCapabilities(): CapabilityKey[] {
    return [
      'connect',
      'disconnect',
      'signMessage',
      'signTransaction',
      'submitTransaction',
      'injected',
    ];
  }

  async detectInstalled(): Promise<AdapterDetectResult> {
    // Already discovered — always installed
    return { installed: true };
  }

  async connect(
    _ctx: AdapterContext,
    _opts?: { timeoutMs?: number; partyId?: PartyId },
  ): Promise<AdapterConnectResult> {
    // 1. Connect
    const connectResult = await this.provider.request<CIP0103ConnectResult>({
      method: 'connect',
    });

    if (!connectResult.isConnected) {
      throw new Error(connectResult.reason || 'Connection rejected by wallet');
    }

    // 2. Get primary account for partyId
    let partyId = 'unknown';
    try {
      const account = await this.provider.request<CIP0103Account>({
        method: 'getPrimaryAccount',
      });
      partyId = account.partyId;
    } catch {
      // Some providers may not implement getPrimaryAccount yet.
      // Try to get it from status instead.
      try {
        const status = await this.provider.request<CIP0103StatusEvent>({
          method: 'status',
        });
        if (status.session?.userId) {
          partyId = status.session.userId;
        }
      } catch {
        // Fallback — partyId stays 'unknown'
      }
    }

    return {
      partyId: partyId as PartyId,
      session: {
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h default
      },
      capabilities: this.getCapabilities(),
    };
  }

  async disconnect(_ctx: AdapterContext, _session: Session): Promise<void> {
    await this.provider.request({ method: 'disconnect' });
  }

  async signMessage(
    _ctx: AdapterContext,
    _session: Session,
    params: SignMessageParams,
  ): Promise<SignedMessage> {
    const signature = await this.provider.request<string>({
      method: 'signMessage',
      params: { message: params.message },
    });

    return {
      signature: signature as unknown as SignedMessage['signature'],
      partyId: _session.partyId,
      message: params.message,
      nonce: params.nonce,
      domain: params.domain,
    };
  }

  async signTransaction(
    _ctx: AdapterContext,
    _session: Session,
    params: SignTransactionParams,
  ): Promise<SignedTransaction> {
    // CIP-0103 doesn't have a separate "sign only" — we use prepareExecute
    // but only capture the signed stage
    const result = await this.provider.request<{
      transactionHash?: string;
      signedTx?: unknown;
      commandId?: string;
    }>({
      method: 'prepareExecute',
      params: { tx: params.tx },
    });

    return {
      signedTx: result.signedTx ?? result,
      transactionHash: (result.transactionHash ?? result.commandId ?? '') as unknown as SignedTransaction['transactionHash'],
      partyId: _session.partyId,
    };
  }

  async submitTransaction(
    _ctx: AdapterContext,
    _session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    const result = await this.provider.request<{
      transactionHash?: string;
      commandId?: string;
      updateId?: string;
    }>({
      method: 'prepareExecute',
      params: { tx: params.signedTx },
    });

    return {
      transactionHash: (result.transactionHash ?? result.commandId ?? '') as unknown as TxReceipt['transactionHash'],
      submittedAt: Date.now(),
      commandId: result.commandId,
      updateId: result.updateId,
    };
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a WalletAdapter from a discovered CIP-0103 provider.
 */
export function createNativeAdapter(
  discovered: DiscoveredProvider,
): NativeCIP0103Adapter {
  const name = discovered.name || formatProviderId(discovered.id);
  return new NativeCIP0103Adapter(
    `cip0103:${discovered.id}`,
    name,
    discovered.provider,
  );
}

/**
 * Create a synthetic WalletInfo for a discovered native CIP-0103 provider.
 */
export function createSyntheticWalletInfo(
  discovered: DiscoveredProvider,
  network: string,
): WalletInfo {
  const walletId = `cip0103:${discovered.id}` as WalletId;
  const name = discovered.name || formatProviderId(discovered.id);

  return {
    walletId,
    name,
    website: '',
    icons: {},
    capabilities: [
      'connect',
      'disconnect',
      'signMessage',
      'signTransaction',
      'submitTransaction',
      'injected',
    ],
    adapter: { packageName: 'native-cip0103', versionRange: '*' },
    docs: [],
    networks: [network],
    channel: 'stable' as const,
    metadata: { source: 'native-cip0103' },
  };
}

/**
 * Try to enrich a discovered provider with status information (name, etc.)
 */
export async function enrichProviderInfo(
  discovered: DiscoveredProvider,
): Promise<DiscoveredProvider> {
  try {
    const status = await discovered.provider.request<CIP0103StatusEvent>({
      method: 'status',
    });
    return {
      ...discovered,
      name: discovered.name || status.provider?.id || discovered.id,
    };
  } catch {
    return discovered;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format a provider id for display: "canton.console" → "Canton Console"
 */
function formatProviderId(id: string): string {
  return id
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
