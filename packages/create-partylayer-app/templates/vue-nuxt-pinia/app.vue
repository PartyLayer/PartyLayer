<script setup lang="ts">
import { getServerSession, truncateParty } from './lib/session';
import { useSessionStore } from './stores/session';

// SSR-aware cookie → server-rendered connected party (Option A: the server owns
// the display, so there's no disconnected→connected flash in the initial HTML).
const cookie = useCookie<string | null>('pl_session');
const session = getServerSession(cookie);
const serverParty = session?.account?.partyId ?? null;

// Pinia store = the reactive client session (the interactive island).
const sessionStore = useSessionStore();
</script>

<template>
  <main class="app">
    <h1>{{PROJECT_NAME}}</h1>
    <p class="subtitle">A PartyLayer dApp on Canton — Nuxt 3 + Pinia, SSR session.</p>

    <!-- SERVER-RENDERED party from the cookie (initial HTML, no flash) -->
    <p v-if="serverParty" class="session">
      Connected as <code data-testid="server-party">{{ truncateParty(serverParty) }}</code>
    </p>
    <p v-else class="session" data-testid="server-cta">
      Not connected — connect a wallet to continue.
    </p>

    <!-- Pinia-backed interactive session (reads the Pinia store, not the composables) -->
    <button v-if="!sessionStore.isConnected" class="btn" @click="sessionStore.connect()">
      Connect Wallet
    </button>
    <div v-else class="connected">
      <code>{{ truncateParty(sessionStore.party ?? '') }}</code>
      <button class="btn" @click="sessionStore.disconnect()">Disconnect</button>
    </div>
  </main>
</template>

<style>
:root { color-scheme: light dark; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: #0b0f1a;
  color: rgba(255, 255, 255, 0.92);
}
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  text-align: center;
}
.app h1 { font-size: 2.5rem; margin: 0; }
.subtitle { margin: 0 0 8px; color: rgba(255, 255, 255, 0.6); max-width: 32rem; }
.session code, .connected code {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 8px;
  border-radius: 6px;
}
.btn {
  padding: 10px 18px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: #ffcc00;
  color: #0b0f1a;
  font-weight: 600;
  cursor: pointer;
}
</style>
