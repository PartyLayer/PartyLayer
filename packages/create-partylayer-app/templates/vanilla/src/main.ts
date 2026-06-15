import { createPartyLayer, type Session } from '@partylayer/sdk';
import './style.css';

// The PartyLayer client — the dApp connect API (listWallets / connect / session).
// All built-in wallet adapters are auto-registered.
const client = createPartyLayer({ network: 'devnet', app: { name: '{{PROJECT_NAME}}' } });

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="app">
    <h1>{{PROJECT_NAME}}</h1>
    <p class="subtitle">A PartyLayer dApp on Canton — vanilla TypeScript, no framework.</p>
    <div id="status" class="status"></div>
    <button id="connect" class="btn">Connect Wallet</button>
    <ul id="wallets" class="wallets" hidden></ul>
  </main>
`;

const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const connectBtn = document.querySelector<HTMLButtonElement>('#connect')!;
const walletsEl = document.querySelector<HTMLUListElement>('#wallets')!;

const truncateParty = (p: string) => (p.length <= 16 ? p : `${p.slice(0, 10)}…${p.slice(-4)}`);

function renderConnected(session: Session) {
  walletsEl.hidden = true;
  connectBtn.hidden = true;
  statusEl.innerHTML = `Connected as <code>${truncateParty(session.partyId)}</code>`;
  const disconnect = document.createElement('button');
  disconnect.className = 'btn';
  disconnect.textContent = 'Disconnect';
  disconnect.addEventListener('click', () => void client.disconnect());
  statusEl.appendChild(disconnect);
}

function renderDisconnected() {
  statusEl.textContent = 'Not connected — connect a wallet to continue.';
  connectBtn.hidden = false;
  walletsEl.hidden = true;
}

// Connect → list the verified wallets from the registry → pick one → connect.
connectBtn.addEventListener('click', async () => {
  const wallets = await client.listWallets();
  walletsEl.innerHTML = wallets
    .map(
      (w, i) => `<li>
        <button class="wallet" data-idx="${i}">
          ${w.icons?.md ? `<img src="${w.icons.md}" alt="" width="24" height="24" />` : ''}
          <span>${w.name}</span>
        </button>
      </li>`,
    )
    .join('');
  walletsEl.hidden = false;
  walletsEl.querySelectorAll<HTMLButtonElement>('.wallet').forEach((btn) => {
    btn.addEventListener('click', async () => {
      // Pass the WalletInfo's walletId (a branded WalletId), not a raw string.
      const wallet = wallets[Number(btn.dataset.idx)];
      try {
        const session = await client.connect({ walletId: wallet.walletId });
        renderConnected(session);
      } catch (err) {
        statusEl.textContent = `Connect failed: ${(err as Error).message}`;
      }
    });
  });
});

// Keep the UI in sync with external session changes (multi-tab, expiry, restore).
client.on('session:connected', () => {
  void client.getActiveSession().then((s) => s && renderConnected(s));
});
client.on('session:disconnected', () => renderDisconnected());

// Initial state — restore an existing session if there is one.
void client.getActiveSession().then((s) => (s ? renderConnected(s) : renderDisconnected()));
