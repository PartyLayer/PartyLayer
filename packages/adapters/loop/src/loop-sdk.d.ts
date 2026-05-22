/**
 * Type declarations for @fivenorth/loop-sdk
 *
 * The SDK does not ship its own .d.ts files, so we maintain
 * minimal ambient types here based on the published README and
 * source inspection (v0.10.0).
 */

declare module '@fivenorth/loop-sdk' {
  export interface LoopProvider {
    party_id: string;
    public_key: string;
    email?: string;
    signMessage(message: string): Promise<string>;
    submitTransaction(
      command: unknown,
      options?: {
        message?: string;
        estimateTraffic?: boolean;
        requestTimeout?: number;
      },
    ): Promise<{ command_id: string; submission_id: string }>;
    submitAndWaitForTransaction(
      command: unknown,
      options?: {
        message?: string;
        estimateTraffic?: boolean;
        requestTimeout?: number;
      },
    ): Promise<unknown>;
    getHolding(): Promise<unknown>;
    getActiveContracts(params: {
      templateId?: string;
      interfaceId?: string;
    }): Promise<unknown>;
  }

  export interface LoopInitConfig {
    appName: string;
    network: 'local' | 'devnet' | 'testnet' | 'mainnet';
    walletUrl?: string;
    apiUrl?: string;
    onAccept: (provider: LoopProvider) => void;
    onReject: () => void;
    onTransactionUpdate?: (payload: unknown) => void;
    options?: {
      openMode?: 'popup' | 'tab';
      requestSigningMode?: 'popup' | 'tab';
      redirectUrl?: string;
    };
  }

  export interface LoopWalletTransferInstrument {
    instrument_admin?: string;
    instrument_id?: string;
  }

  export interface LoopWalletTransferOptions {
    message?: string;
    memo?: string;
    executionMode?: 'async' | 'wait';
    requestedAt?: string;
    executeBefore?: string;
    requestTimeout?: number;
    estimateTraffic?: boolean;
  }

  export interface LoopWallet {
    transfer(
      recipient: string,
      amount: string | number,
      instrument?: LoopWalletTransferInstrument,
      options?: LoopWalletTransferOptions,
    ): Promise<unknown>;
    extension: {
      usdcBridge: {
        withdrawalUSDCxToEthereum(
          ethAddress: string,
          amount: string,
          options?: { reference?: string; message?: string; requestTimeout?: number },
        ): Promise<unknown>;
      };
    };
  }

  export interface LoopSDK {
    init(config: LoopInitConfig): void;
    connect(): Promise<void>;
    autoConnect(): Promise<void>;
    logout(): void;
    wallet: LoopWallet;
    provider: LoopProvider | null;
    session: unknown;
  }

  export const loop: LoopSDK;

  export enum MessageType {
    HANDSHAKE_ACCEPT = 'handshake_accept',
    HANDSHAKE_REJECT = 'handshake_reject',
    TRANSACTION_COMPLETED = 'transaction_completed',
    RUN_TRANSACTION = 'run_transaction',
    SIGN_RAW_MESSAGE = 'sign_raw_message',
    REJECT_REQUEST = 'reject_request',
  }
}
