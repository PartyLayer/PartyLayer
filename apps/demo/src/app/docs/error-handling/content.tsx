'use client';

import { useDocs } from '../layout';

export default function ErrorHandlingPage() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext } = useDocs();

  return (
    <>
      <H1>Error Handling</H1>
      <P>
        PartyLayer provides 14 typed error classes with stable error codes, human-readable messages,
        and structured metadata. All errors extend <Code>{'PartyLayerError'}</Code>.
      </P>

      <H2 id="error-base">PartyLayerError</H2>
      <CodeBlock language="typescript">{`class PartyLayerError extends Error {
  code: ErrorCode;       // Stable string error code
  message: string;       // Human-readable error message
  cause?: unknown;       // Original error (if wrapped)
  details?: Record<string, unknown>; // Additional context
  isOperational: boolean; // true for expected errors, false for bugs

  toJSON(): {
    name: string;
    message: string;
    code: string;
    isOperational: boolean;
    details?: Record<string, unknown>;
    cause?: unknown;
  };
}`}</CodeBlock>

      <H2 id="error-codes">Error Codes</H2>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13.5,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Code', 'Class', 'Description'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { code: 'WALLET_NOT_FOUND', cls: 'WalletNotFoundError', desc: 'No wallet with the requested id is known (not in the registry and no adapter registered for it).' },
              { code: 'ADAPTER_NOT_REGISTERED', cls: 'AdapterNotRegisteredError', desc: 'A popup or remote (discovery-adapter) wallet was selected, but the app did not register a matching provider adapter.' },
              { code: 'WALLET_NOT_INSTALLED', cls: 'WalletNotInstalledError', desc: 'Wallet was found in registry but not detected on the device.' },
              { code: 'USER_REJECTED', cls: 'UserRejectedError', desc: 'User declined the connection or signing request in the wallet UI.' },
              { code: 'ORIGIN_NOT_ALLOWED', cls: 'OriginNotAllowedError', desc: 'Wallet rejected the dApp origin (domain not whitelisted).' },
              { code: 'SESSION_EXPIRED', cls: 'SessionExpiredError', desc: 'The active session has expired. User must reconnect.' },
              { code: 'CAPABILITY_NOT_SUPPORTED', cls: 'CapabilityNotSupportedError', desc: 'The wallet does not support the requested capability (e.g., signTransaction).' },
              { code: 'TRANSPORT_ERROR', cls: 'TransportError', desc: 'Communication failure with the wallet (PostMessage, deep link, etc.).' },
              { code: 'REGISTRY_FETCH_FAILED', cls: 'RegistryFetchFailedError', desc: 'Could not fetch the wallet registry. SDK falls back to adapters.' },
              { code: 'REGISTRY_VERIFICATION_FAILED', cls: 'RegistryVerificationFailedError', desc: 'Registry signature verification failed (possible tampering).' },
              { code: 'REGISTRY_SCHEMA_INVALID', cls: 'RegistrySchemaInvalidError', desc: 'Registry data did not match the expected schema.' },
              { code: 'INTERNAL_ERROR', cls: 'InternalError', desc: 'Unexpected internal SDK error. This is a bug. Please report it.' },
              { code: 'NETWORK_MISMATCH', cls: 'NetworkMismatchError', desc: 'The wallet is on a different network than the dApp requires. Switch the wallet network, then reconnect.' },
              { code: 'TIMEOUT', cls: 'TimeoutError', desc: 'Operation timed out (e.g., wallet took too long to respond).' },
            ].map(e => (
              <tr key={e.code} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#E6B800', fontWeight: 500 }}>{e.code}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#475569' }}>{e.cls}</td>
                <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>{e.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="try-catch">Try-Catch Patterns</H2>

      <H3>Catching Specific Errors</H3>
      <CodeBlock language="typescript">{`import {
  UserRejectedError,
  WalletNotInstalledError,
  TimeoutError,
  SessionExpiredError,
} from '@partylayer/core';

try {
  const session = await client.connect({ walletId: 'console' });
} catch (error) {
  if (error instanceof UserRejectedError) {
    // User clicked "Reject" in the wallet UI
    showToast('Connection cancelled');
  } else if (error instanceof WalletNotInstalledError) {
    // Wallet not detected
    showInstallPrompt(error.details?.installUrl);
  } else if (error instanceof TimeoutError) {
    // Wallet didn't respond in time
    showToast('Connection timed out. Please try again.');
  } else if (error instanceof SessionExpiredError) {
    // Session expired
    showToast('Session expired. Please reconnect.');
  } else {
    // Unexpected error
    console.error('Unexpected error:', error);
  }
}`}</CodeBlock>

      <H3>Catching by Error Code</H3>
      <P>
        You can also match on the stable <Code>{'code'}</Code> property:
      </P>
      <CodeBlock language="typescript">{`import { PartyLayerError } from '@partylayer/core';

try {
  await client.signMessage({ message: 'Hello' });
} catch (error) {
  if (error instanceof PartyLayerError) {
    switch (error.code) {
      case 'USER_REJECTED':
        console.log('User declined');
        break;
      case 'CAPABILITY_NOT_SUPPORTED':
        console.log('Wallet cannot sign messages');
        break;
      case 'SESSION_EXPIRED':
        console.log('Session expired, reconnecting...');
        break;
      default:
        console.error('SDK error:', error.code, error.message);
    }
  }
}`}</CodeBlock>

      <H2 id="error-events">Error Event Subscription</H2>
      <P>
        Subscribe to all SDK errors globally:
      </P>
      <CodeBlock language="typescript">{`client.on('error', (event) => {
  const { error } = event;
  console.error(\`[\${error.code}] \${error.message}\`);

  // Report to error tracking service
  if (!error.isOperational) {
    // This is a bug — report it
    Sentry.captureException(error);
  }
});`}</CodeBlock>

      <Callout type="tip">
        <Code>{'isOperational'}</Code> is <Code>{'true'}</Code> for expected errors like user rejection
        or timeout. It{"'"}s <Code>{'false'}</Code> for unexpected internal errors that indicate a bug.
      </Callout>

      <H2 id="react-errors">React Hook Error States</H2>
      <P>
        All action hooks expose an <Code>{'error'}</Code> state:
      </P>
      <CodeBlock language="tsx">{`import { useConnect, useSignMessage } from '@partylayer/react';

function App() {
  const { connect, error: connectError, reset: resetConnect } = useConnect();
  const { signMessage, error: signError } = useSignMessage();

  return (
    <div>
      <button onClick={() => connect()}>Connect</button>
      {connectError && (
        <div className="error">
          <p>{connectError.message}</p>
          <button onClick={resetConnect}>Try Again</button>
        </div>
      )}

      <button onClick={() => signMessage({ message: 'Hi' })}>Sign</button>
      {signError && <p className="error">{signError.message}</p>}
    </div>
  );
}`}</CodeBlock>

      <H2 id="serialization">Error Serialization</H2>
      <P>
        All errors support JSON serialization for logging and error reporting:
      </P>
      <CodeBlock language="typescript">{`try {
  await client.connect({ walletId: 'unknown' });
} catch (error) {
  if (error instanceof PartyLayerError) {
    console.log(JSON.stringify(error.toJSON(), null, 2));
    // {
    //   "name": "WalletNotFoundError",
    //   "message": "Wallet 'unknown' not found",
    //   "code": "WALLET_NOT_FOUND",
    //   "isOperational": true,
    //   "details": { "walletId": "unknown" }
    // }
  }
}`}</CodeBlock>

      <PrevNext />
    </>
  );
}
