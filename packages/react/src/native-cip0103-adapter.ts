/**
 * Native CIP-0103 Adapter
 *
 * Wraps a discovered CIP-0103 Provider into the PartyLayer WalletAdapter
 * interface. Used when a provider injected at `window.canton.*` does NOT
 * match any registry entry — i.e. an unknown CIP-0103 wallet that the
 * picker should still surface (with generic branding) so the user can
 * connect.
 *
 * For *known* CIP-0103 wallets — entries in the registry whose
 * `providerDetection` matches the active provider — we DO NOT create a
 * synthetic adapter. The registry's own adapter (e.g. `SendAdapter`) is
 * already registered via `getBuiltinAdapters()` and carries wallet-
 * specific behaviour (kernel.id guard, template-id hint, error mapping).
 * The picker promotes the registry's WalletInfo into the "CIP-0103
 * Native" section instead — see `context.tsx` for the merge logic.
 */

import {
  deriveGenericWalletName,
  findMatchingWalletInfo,
  type Cip0103StatusForDetection,
} from '@partylayer/sdk';
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

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * A `DiscoveredProvider` augmented with the runtime `status` we fetched
 * during enrichment, plus an optional reference to the registry entry
 * whose `providerDetection` rules matched it.
 *
 * `matchedWallet` undefined → unknown CIP-0103 wallet (render generic).
 * `matchedWallet` set       → known wallet (registry entry handles the
 *                             rendering + connect flow; no synthetic).
 */
export interface EnrichedProvider extends DiscoveredProvider {
  status?: Cip0103StatusForDetection;
  matchedWallet?: WalletInfo;
}

// ─── Adapter ────────────────────────────────────────────────────────────────

/**
 * A WalletAdapter that delegates to a native CIP-0103 Provider.
 * Used only for unknown CIP-0103 wallets — see file header.
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

const GENERIC_CIP0103_ICON = '/wallets/canton-generic.svg';

/**
 * Create a synthetic WalletInfo for an unknown CIP-0103 provider — i.e.
 * one whose runtime status did NOT match any registry entry. The picker
 * still surfaces it (decision: "show all wallets"), with a name derived
 * from `kernel.userUrl` and a generic Canton-themed icon.
 *
 * For known wallets (registry-matched), don't call this — promote the
 * registry's WalletInfo to native instead. See `promoteRegistryToNative`.
 */
export function createSyntheticWalletInfo(
  discovered: EnrichedProvider,
  network: string,
): WalletInfo {
  const walletId = `cip0103:${discovered.id}` as WalletId;
  const status = discovered.status;
  const name =
    discovered.name && !looksLikeKernelId(discovered.name)
      ? discovered.name
      : deriveGenericWalletName(status);

  const userUrl = status?.kernel?.userUrl;
  const description = userUrl
    ? `Unrecognised CIP-0103 wallet at ${userUrl}`
    : 'Unrecognised CIP-0103 wallet';

  return {
    walletId,
    name,
    website: userUrl ?? '',
    icons: { sm: GENERIC_CIP0103_ICON, md: GENERIC_CIP0103_ICON, lg: GENERIC_CIP0103_ICON },
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
    channel: 'beta',
    metadata: {
      source: 'native-cip0103',
      generic: 'true',
      description,
      ...(status?.kernel?.id ? { kernelId: status.kernel.id } : {}),
      ...(userUrl ? { userUrl } : {}),
    },
  };
}

/**
 * Promote a registry-matched WalletInfo into the "CIP-0103 Native"
 * section of the picker. We do this by stamping `metadata.source =
 * 'native-cip0103'` so the existing modal predicate (`isNativeWallet`)
 * renders it under the native header — without losing the wallet's
 * registry branding (name, icon, description) or its real adapter.
 */
export function promoteRegistryToNative(
  wallet: WalletInfo,
  status?: Cip0103StatusForDetection,
): WalletInfo {
  return {
    ...wallet,
    metadata: {
      ...(wallet.metadata ?? {}),
      source: 'native-cip0103',
      ...(status?.kernel?.id ? { kernelId: status.kernel.id } : {}),
    },
  };
}

// ─── Discovery enrichment ───────────────────────────────────────────────────

/**
 * Try to enrich a discovered provider with status information AND
 * resolve a matching registry entry.
 *
 * Best-effort: if `status` fails the provider is returned untouched.
 * Registry matching only runs when status was successfully fetched; an
 * unmatched provider remains a candidate for synthetic generic
 * rendering.
 */
export async function enrichProviderInfo(
  discovered: DiscoveredProvider,
  registry?: readonly WalletInfo[],
): Promise<EnrichedProvider> {
  const next: EnrichedProvider = { ...discovered };
  try {
    const status = await discovered.provider.request<CIP0103StatusEvent>({
      method: 'status',
    });
    next.status = status as Cip0103StatusForDetection;
    if (!next.name && status.provider?.id) {
      next.name = status.provider.id;
    }
    if (registry && registry.length > 0) {
      const matched = findMatchingWalletInfo(next.status, registry);
      if (matched) {
        next.matchedWallet = matched;
      }
    }
  } catch {
    // Status request can fail in many normal cases (popup not yet open,
    // wallet locked, etc.). Leave the discovered provider as-is.
  }
  return next;
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

/**
 * Heuristic: a 32-character lowercase-alpha string is almost certainly a
 * Chrome extension id, not a human-facing display name. Catches the
 * pre-Prompt-6 bug where the modal showed `ldmohiccoioolen…` as the
 * wallet's name.
 */
function looksLikeKernelId(value: string): boolean {
  return /^[a-z]{30,}$/.test(value);
}
