/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
/**
 * Wallet Adapter Starter Template
 * 
 * This is a starter template for building PartyLayer wallet adapters.
 * 
 * Steps to customize:
 * 1. Rename this file to match your wallet name (e.g., `mywallet-adapter.ts`)
 * 2. Update `walletId` and `name` properties
 * 3. Implement `detectInstalled()` to check if wallet is available
 * 4. Implement `connect()` to establish connection
 * 5. Implement optional methods (`signMessage`, `signTransaction`, etc.) if supported
 * 6. Update `getCapabilities()` to reflect actual capabilities
 * 7. Run conformance tests: `partylayer-conformance run --adapter ./dist`
 * 
 * References:
 * - Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
 * - Adapter Contract: See @partylayer/core/src/adapters.ts
 */

import type {
  WalletAdapter,
  AdapterContext,
  AdapterDetectResult,
  AdapterConnectResult,
  SignMessageParams,
  SignTransactionParams,
  SubmitTransactionParams,
  SignedMessage,
  SignedTransaction,
  TxReceipt,
  Session,
  PersistedSession,
  CapabilityKey,
  PartyId,
} from '@partylayer/core';
import {
  toWalletId,
  toPartyId,
  toSignature,
  toTransactionHash,
  WalletNotInstalledError,
  CapabilityNotSupportedError,
  UserRejectedError,
  mapUnknownErrorToPartyLayerError,
} from '@partylayer/core';

/**
 * MyWallet Adapter
 * 
 * TODO: Rename this class to match your wallet name
 * TODO: Update walletId and name
 */
export class MyWalletAdapter implements WalletAdapter {
  readonly walletId = toWalletId('mywallet'); // TODO: Change to your wallet ID
  readonly name = 'My Wallet'; // TODO: Change to your wallet display name

  /**
   * Get supported capabilities
   * 
   * TODO: Update this list based on what your wallet actually supports
   */
  getCapabilities(): CapabilityKey[] {
    return [
      'connect',
      'disconnect',
      // 'restore', // Add if wallet supports session restoration
      // 'signMessage', // Add if wallet supports message signing
      // 'signTransaction', // Add if wallet supports transaction signing
      // 'submitTransaction', // Add if wallet supports transaction submission
      // 'events', // Add if wallet emits events
      // 'injected', // Add if browser extension
      // 'popup', // Add if uses popup flow
      // 'deeplink', // Add if uses deep link flow
    ];
  }

  /**
   * Detect if wallet is installed
   * 
   * TODO: Implement detection logic for your wallet
   * Examples:
   * - Browser extension: check window.myWallet
   * - Mobile app: check for deep link support
   * - Remote signer: check for API availability
   */
  async detectInstalled(): Promise<AdapterDetectResult> {
    if (typeof window === 'undefined') {
      return {
        installed: false,
        reason: 'Browser environment required',
      };
    }

    // TODO: Replace with actual detection logic
    // Example for browser extension:
    // const wallet = (window as any).myWallet;
    // if (!wallet) {
    //   return {
    //     installed: false,
    //     reason: 'My Wallet extension not detected',
    //   };
    // }

    return {
      installed: false,
      reason: 'Detection not implemented - please implement detectInstalled()',
    };
  }

  /**
   * Connect to wallet
   * 
   * TODO: Implement connection logic
   * - Call wallet SDK connect method
   * - Extract partyId from response
   * - Return session metadata
   */
  async connect(
    ctx: AdapterContext,
    opts?: {
      timeoutMs?: number;
      partyId?: PartyId;
    }
  ): Promise<AdapterConnectResult> {
    try {
      // Check installation
      const detect = await this.detectInstalled();
      if (!detect.installed) {
        throw new WalletNotInstalledError(this.walletId, detect.reason);
      }

      // TODO: Implement actual connection logic
      // Example:
      // const wallet = (window as any).myWallet;
      // const result = await wallet.connect({
      //   appName: ctx.appName,
      //   network: ctx.network,
      // });
      // const partyId = toPartyId(result.partyId);

      throw new Error('Connect not implemented - please implement connect()');
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: 'injected', // TODO: Update based on your transport
      });
    }
  }

  /**
   * Disconnect from wallet
   * 
   * TODO: Implement disconnect logic if wallet supports it
   */
  async disconnect(_ctx: AdapterContext, _session: Session): Promise<void> {
    // TODO: Implement disconnect logic
    // Example:
    // const wallet = (window as any).myWallet;
    // await wallet.disconnect();
  }

  /**
   * Restore session (optional)
   * 
   * TODO: Implement if wallet supports session restoration
   * Return null if restoration is not supported
   */
  async restore(
    _ctx: AdapterContext,
    persisted: PersistedSession
  ): Promise<Session | null> {
    // TODO: Implement restore logic
    // Example:
    // const sessionToken = persisted.metadata?.sessionToken;
    // if (!sessionToken) {
    //   return null;
    // }
    // // Validate token and restore session
    // return { ...persisted, walletId: this.walletId };

    return null; // Not supported by default
  }

  /**
   * Sign message (optional)
   * 
   * TODO: Implement if wallet supports message signing
   * Throw CapabilityNotSupportedError if not supported
   */
  async signMessage(
    _ctx: AdapterContext,
    _session: Session,
    _params: SignMessageParams
  ): Promise<SignedMessage> {
    throw new CapabilityNotSupportedError(this.walletId, 'signMessage');
  }

  /**
   * Sign transaction (optional)
   * 
   * TODO: Implement if wallet supports transaction signing
   * Throw CapabilityNotSupportedError if not supported
   */
  async signTransaction(
    _ctx: AdapterContext,
    _session: Session,
    _params: SignTransactionParams
  ): Promise<SignedTransaction> {
    throw new CapabilityNotSupportedError(this.walletId, 'signTransaction');
  }

  /**
   * Submit transaction (optional)
   * 
   * TODO: Implement if wallet supports transaction submission
   * Throw CapabilityNotSupportedError if not supported
   */
  async submitTransaction(
    _ctx: AdapterContext,
    _session: Session,
    _params: SubmitTransactionParams
  ): Promise<TxReceipt> {
    throw new CapabilityNotSupportedError(this.walletId, 'submitTransaction');
  }
}
