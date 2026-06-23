'use client';

import { useDocs } from '../layout';

export default function TypeScriptPage() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext, A } = useDocs();

  return (
    <>
      <H1>TypeScript Types</H1>
      <P>
        PartyLayer is built with TypeScript strict mode and exports comprehensive types for all
        APIs. This page documents the core types you{"'"}ll work with most frequently.
      </P>

      <Callout type="tip">
        All types are exported from <Code>{'@partylayer/core'}</Code> and re-exported from
        {' '}<Code>{'@partylayer/sdk'}</Code>. You can import from either package.
      </Callout>

      <H2 id="branded-types">Branded Types</H2>
      <P>
        PartyLayer uses branded types to prevent accidental mixing of string identifiers:
      </P>
      <CodeBlock language="typescript">{`// These are all strings at runtime, but TypeScript treats them as distinct types
type WalletId = string & { __brand: 'WalletId' };
type PartyId = string & { __brand: 'PartyId' };
type SessionId = string & { __brand: 'SessionId' };
type TransactionHash = string & { __brand: 'TransactionHash' };
type Signature = string & { __brand: 'Signature' };

// NetworkId is a union + string for custom networks
type NetworkId = 'devnet' | 'testnet' | 'mainnet' | (string & {});`}</CodeBlock>

      <P>
        In practice, you can cast regular strings to these types:
      </P>
      <CodeBlock language="typescript">{`import type { WalletId, PartyId } from '@partylayer/core';

const walletId = 'console' as WalletId;
const partyId = 'party::abc123' as PartyId;`}</CodeBlock>

      <H2 id="session">Session</H2>
      <CodeBlock language="typescript">{`interface Session {
  sessionId: SessionId;
  walletId: WalletId;
  partyId: PartyId;
  network: NetworkId;
  createdAt: number;          // Unix timestamp (ms)
  expiresAt?: number;         // Optional expiration timestamp
  origin: string;             // dApp origin URL
  capabilitiesSnapshot: CapabilityKey[];  // Wallet capabilities at connect time
  metadata?: Record<string, string>;      // Optional key-value metadata
}`}</CodeBlock>

      <H2 id="wallet-info">WalletInfo</H2>
      <P>
        Wallet metadata from the registry or adapter:
      </P>
      <CodeBlock language="typescript">{`interface WalletInfo {
  walletId: WalletId;
  name: string;
  website: string;
  icons: {
    sm?: string;    // Small icon URL (32px)
    md?: string;    // Medium icon URL (64px)
    lg?: string;    // Large icon URL (128px)
  };
  category?: string;          // e.g., 'browser', 'mobile', 'enterprise'
  capabilities: CapabilityKey[];
  installHints?: InstallHints;
  adapter: {
    packageName: string;
    versionRange: string;
  };
  docs: string[];             // Documentation URLs
  minSdkVersion?: string;     // Minimum SDK version required
  networks: NetworkId[];      // Supported networks
  channel: 'stable' | 'beta';
  metadata?: Record<string, string>;
}`}</CodeBlock>

      <H2 id="signing-types">Signing Types</H2>

      <H3>SignedMessage</H3>
      <CodeBlock language="typescript">{`interface SignedMessage {
  signature: Signature;
  partyId: PartyId;
  message: string;
  nonce?: string;
  domain?: string;
}`}</CodeBlock>

      <H3>SignedTransaction</H3>
      <CodeBlock language="typescript">{`interface SignedTransaction {
  signedTx: unknown;                 // Wallet-specific signed payload
  transactionHash: TransactionHash;
  partyId: PartyId;
}`}</CodeBlock>

      <H3>TxReceipt</H3>
      <CodeBlock language="typescript">{`interface TxReceipt {
  transactionHash: TransactionHash;
  submittedAt: number;       // Unix timestamp (ms)
  commandId?: string;        // Daml command ID
  updateId?: string;         // Daml update ID
}`}</CodeBlock>

      <H2 id="registry-status">RegistryStatus</H2>
      <CodeBlock language="typescript">{`interface RegistryStatus {
  source: 'network' | 'cache';  // Where the data came from
  verified: boolean;             // Signature verification passed
  channel: 'stable' | 'beta';
  sequence: number;              // Registry version sequence
  stale: boolean;                // Whether data may be outdated
  fetchedAt: number;             // Timestamp of last fetch
  etag?: string;                 // HTTP ETag for caching
  error?: PartyLayerError;       // Error if fetch failed
}`}</CodeBlock>

      <H2 id="capabilities">Capability Keys</H2>
      <P>
        Capabilities describe what a wallet adapter can do:
      </P>
      <CodeBlock language="typescript">{`type CapabilityKey =
  | 'connect'           // Can establish connection
  | 'disconnect'        // Can cleanly disconnect
  | 'restore'           // Can restore persisted sessions
  | 'signMessage'       // Can sign arbitrary messages
  | 'signTransaction'   // Can sign transactions
  | 'submitTransaction' // Can sign and submit transactions
  | 'ledgerApi'         // Can proxy ledger API requests
  | 'events'            // Supports event subscriptions
  | 'deeplink'          // Supports deep link transport
  | 'popup'             // Supports popup/QR code transport
  | 'injected'          // Supports injected provider transport
  | 'remoteSigner';     // Supports remote signing`}</CodeBlock>

      <H2 id="transaction-status">TransactionStatus</H2>
      <CodeBlock language="typescript">{`type TransactionStatus =
  | 'pending'     // Transaction submitted, waiting for confirmation
  | 'submitted'   // Transaction accepted by the ledger
  | 'committed'   // Transaction committed to the ledger
  | 'rejected'    // Transaction rejected by the ledger
  | 'failed';     // Transaction failed (error)`}</CodeBlock>

      <H2 id="error-code">ErrorCode</H2>
      <CodeBlock language="typescript">{`type ErrorCode =
  | 'WALLET_NOT_FOUND'
  | 'ADAPTER_NOT_REGISTERED'
  | 'WALLET_NOT_INSTALLED'
  | 'USER_REJECTED'
  | 'ORIGIN_NOT_ALLOWED'
  | 'SESSION_EXPIRED'
  | 'CAPABILITY_NOT_SUPPORTED'
  | 'TRANSPORT_ERROR'
  | 'REGISTRY_FETCH_FAILED'
  | 'REGISTRY_VERIFICATION_FAILED'
  | 'REGISTRY_SCHEMA_INVALID'
  | 'INTERNAL_ERROR'
  | 'NETWORK_MISMATCH'
  | 'TIMEOUT';`}</CodeBlock>

      <H2 id="event-types">Event Types</H2>
      <CodeBlock language="typescript">{`// Session events
interface SessionConnectedEvent {
  type: 'session:connected';
  session: Session;
}

interface SessionDisconnectedEvent {
  type: 'session:disconnected';
  sessionId: SessionId;
  reason?: string;
}

interface SessionExpiredEvent {
  type: 'session:expired';
  sessionId: SessionId;
}

// Transaction events
interface TxStatusEvent {
  type: 'tx:status';
  sessionId: SessionId;
  txId: TransactionHash;
  status: TransactionStatus;
  raw?: unknown;
}

// Registry events
interface RegistryStatusEvent {
  type: 'registry:status';
  status: RegistryStatus;
}

// Error events
interface ErrorEvent {
  type: 'error';
  error: Error;
}`}</CodeBlock>

      <H2 id="cip0103-types">CIP-0103 Types</H2>
      <P>
        For the full CIP-0103 type definitions (23 types including <Code>{'CIP0103Provider'}</Code>,
        {' '}<Code>{'CIP0103Account'}</Code>, <Code>{'CIP0103StatusEvent'}</Code>, <Code>{'CIP0103TxChangedEvent'}</Code>,
        etc.), see the <A href="/docs/cip-0103">CIP-0103 Provider</A> documentation.
      </P>
      <P>
        All CIP-0103 types are exported from <Code>{'@partylayer/core'}</Code>:
      </P>
      <CodeBlock language="typescript">{`import type {
  CIP0103Provider,
  CIP0103ConnectResult,
  CIP0103Account,
  CIP0103Network,
  CIP0103StatusEvent,
  CIP0103TxChangedEvent,
  CIP0103LedgerApiResponse,
  CIP0103ProviderRpcError,
} from '@partylayer/core';`}</CodeBlock>

      <PrevNext />
    </>
  );
}
