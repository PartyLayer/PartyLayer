'use client';

import { useEffect, useRef, useState } from 'react';
import { PartyLayerLocaleProvider, PartyLayerProvider, ThemeProvider, lightTheme } from '@partylayer/react';
import { TransferForm, type OperationPreparationContext } from '@partylayer/react/operations';
import { createProviderBridge } from '@partylayer/provider';
import type { PartyLayerClient } from '@partylayer/sdk';
import { createMemoryStorage } from '@partylayer/session';
import { createMockWalletClient } from '@partylayer/testing';
import styles from './transfer-preview.module.css';

const instrumentId = { admin: 'issuer::demo', id: 'DEMO' };
const networkId = 'canton:da-devnet';

async function preparePreview(_input: unknown, { commandId }: OperationPreparationContext) {
  return {
    // The review hook binds this local placeholder to the demo session. It is
    // never passed to a wallet provider or converted into a ledger command.
    parameters: { signedTx: { commandId } },
    expiresAt: Date.now() + 300_000,
  };
}

function createPreviewClient(onHandoff: () => void): PartyLayerClient {
  const mock = createMockWalletClient({ connected: true, partyId: 'party::demo-sender', network: 'devnet' });
  const provider = createProviderBridge(mock);
  return {
    ...mock,
    asProvider: () => provider,
    listWallets: async () => [],
    async submitTransaction() {
      onHandoff();
      return { submittedAt: Date.now() };
    },
  } as unknown as PartyLayerClient;
}

export function TransferPreview() {
  const [handoff, setHandoff] = useState(false);
  const [client] = useState(() => createPreviewClient(() => setHandoff(true)));
  const [sessionOptions] = useState(() => ({ storage: createMemoryStorage() }));
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const reviewPanel = useRef<HTMLDivElement>(null);
  const focusOnReset = useRef(false);

  useEffect(() => {
    if (handoff) {
      resultHeading.current?.focus();
    } else if (focusOnReset.current) {
      reviewPanel.current?.focus();
      focusOnReset.current = false;
    }
  }, [handoff]);

  return (
    <div className={styles.grid}>
      <aside className={styles.guide} aria-labelledby="sample-heading">
        <h2 id="sample-heading">Try a sample transfer</h2>
        <p>Enter these values and select <strong>Review transfer</strong>.</p>
        <dl className={styles.sample}>
          <div><dt>Recipient</dt><dd><code>party::demo-recipient</code></dd></div>
          <div><dt>Amount</dt><dd><code>25.125</code></dd></div>
        </dl>
        <div className={styles.boundary}>
          <h2>Where the wallet takes over</h2>
          <p>
            This preview shows the transfer details entered in the app. In a live
            integration, the wallet handles final approval and signing. Clear
            Signing is about how the wallet explains the transaction it will sign.
          </p>
        </div>
      </aside>
      <div className={styles.panel} ref={reviewPanel} tabIndex={-1} aria-label="Transfer demo">
        <PartyLayerProvider client={client} sessionOptions={sessionOptions}>
          <ThemeProvider theme={lightTheme}>
            <PartyLayerLocaleProvider locale="en">
              {handoff ? (
                <section className={styles.result} aria-labelledby="handoff-heading">
                  <h2 id="handoff-heading" ref={resultHeading} tabIndex={-1}>Simulated wallet handoff</h2>
                  <p>This is where the wallet would open for final approval. Nothing was signed or sent.</p>
                  <button type="button" onClick={() => {
                    focusOnReset.current = true;
                    setHandoff(false);
                  }}>Try another transfer</button>
                </section>
              ) : (
                <TransferForm
                  networkId={networkId}
                  instrumentId={instrumentId}
                  tokenName="Demo token"
                  prepare={preparePreview}
                />
              )}
            </PartyLayerLocaleProvider>
          </ThemeProvider>
        </PartyLayerProvider>
      </div>
    </div>
  );
}
