# Use PartyLayer with an AI coding assistant

Give your coding assistant the [quick start](./quick-start.md), the [plain-text reference](https://partylayer.xyz/llms-full.txt) and, for existing projects, the [migration guide](./migration.md). These describe the same public APIs developers use. AI assistance does not require a new runtime package, an API key, or wallet access.

## Start with a precise task

Copy and adapt this prompt:

```text
Add PartyLayer wallet connection to this existing app. First inspect its framework,
package manager, installed versions and existing providers. Follow
https://partylayer.xyz/llms-full.txt and https://partylayer.xyz/docs/quick-start.
Use the default branded ConnectButton, one PartyLayerKit, Devnet, and the existing
package manager. Preserve working application behavior and avoid a second client.
Install @partylayer/react and @tanstack/react-query together for a React app.
Keep Next.js layout server-side and put wallet providers in a client component.
Run this application's build/typecheck and explain any wallet configuration still
needed. Do not create a wallet-specific package or submit ledger transactions.
```

Replace Devnet with the intended supported network. Tell the assistant if you already have an application-owned PartyLayer client, custom UI or authentication. It should preserve those choices rather than blindly wrapping the app again.

## Optional repository skill

The repository includes [skills/partylayer-integration/SKILL.md](../skills/partylayer-integration/SKILL.md), a short integration playbook. A skill is instructions for the coding assistant, not JavaScript shipped to your users. Use your assistant's supported skill setup, or provide the file as project context. Merely installing the npm package does not install or activate an assistant skill. Tool support and installation locations vary by assistant; the plain-text references work without a skill system.

The skill points to maintained installation, migration, authentication and transaction guides. It preserves the user's scope and treats wallet login, approval and funding as separate steps. It does not authorize publishing, credential access, signing or ledger writes.

## What the assistant should generate

For a React app, one installation command:

```bash
npm install @partylayer/react @tanstack/react-query
```

A single kit at the application boundary, plus a client-side connection component:

```tsx
'use client';

import { ConnectButton, useAccount } from '@partylayer/react';

export function WalletConnection() {
  const { isConnected, party, networkId } = useAccount();
  return (
    <section>
      <ConnectButton />
      {isConnected && <p>{party} · {networkId}</p>}
    </section>
  );
}
```

Use the [quick start](./quick-start.md) for the complete Vite or Next.js provider/root setup. No additional wallet-specific package is needed. The optional `/query` hooks need your own stable `QueryClientProvider`; their mutation API differs from the main-entry imperative hooks.

## Review generated code

- Use the intended network/channel. Send is Mainnet-only; Vala is Devnet beta. Do not bypass the wallet catalog filter to make an unavailable wallet appear.
- Configure WalletConnect with your project ID and Bron with your own OAuth/API settings when needed. Do not copy credentials from examples.
- Keep one native discovery owner and the full CIP-0103 request/result shapes. Do not create a second session from cached UI data.
- Do not treat a connected party or a message signature as verified application login, a successful transfer or a settled swap. Those have separate backend/ledger requirements.
- Run the generated app's build, typecheck and relevant tests. The repository compiles the code examples in these guides against public package declarations; that does not guarantee every future AI response is correct.

CLI 0.7.0 introduces read-only installation diagnostics with `npx create-partylayer-app@latest --doctor .`. Check the [CLI release/usage notes](../packages/create-partylayer-app/README.md) before relying on the command. It checks local metadata, not npm freshness, wallet credentials or ledger execution.

## Maintained references

[llms.txt](https://partylayer.xyz/llms.txt) is the documentation index. [llms-full.txt](https://partylayer.xyz/llms-full.txt) combines the maintained quick start, SDK reference and network constraints. The repository generator and drift gate keep them aligned with their source guides. These files help assistants obtain useful context; they do not guarantee Google indexing, ranking or AI citations.
