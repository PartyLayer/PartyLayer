/**
 * CIP-0103 Test Wallet Provider
 *
 * This script injects a CIP-0103 compliant wallet provider at
 * `window.canton.demoWallet` BEFORE React hydrates. This simulates
 * exactly what a real wallet browser extension would do.
 *
 * The provider implements the full CIP-0103 interface:
 *   - request(method, params) — RPC handler
 *   - on(event, handler) — event subscription
 *   - emit(event, data) — event emission
 *   - removeListener(event, handler) — unsubscribe
 *
 * Supported methods: status, connect, disconnect, getPrimaryAccount,
 * signMessage, prepareExecute
 */
(function () {
  'use strict';

  // ─── State ─────────────────────────────────────────────────────────
  // A real wallet extension keeps its per-origin connection across page
  // reloads and shares it across tabs (its background context is the source of
  // truth). The mock simulates that by persisting {connected, partyId} in
  // localStorage, so `status` reports connected after a reload / in a new tab
  // and the session layer can restore. Without this the mock would reset to
  // disconnected on every load and restore-after-reload could never succeed.
  var STORAGE_KEY = '__demo_wallet_session_v1';
  var networkId = 'canton:devnet';
  var listeners = {};

  function loadPersisted() {
    try {
      var raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.connected && s.partyId) return { connected: true, partyId: s.partyId };
      }
    } catch (e) { /* ignore */ }
    return { connected: false, partyId: null };
  }

  var __persisted = loadPersisted();
  var connected = __persisted.connected;
  var partyId = __persisted.partyId || 'party::demo-user-' + Math.random().toString(36).slice(2, 8);

  function persistSession() {
    try {
      if (typeof localStorage === 'undefined') return;
      if (connected) localStorage.setItem(STORAGE_KEY, JSON.stringify({ connected: true, partyId: partyId }));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  // The CIP-0103 account record surfaced via `accountsChanged`. Shape mirrors
  // CIP0103Account (the @partylayer/session store reads `primary` to pick the
  // active account). A real wallet emits this; the mock must too.
  var primaryAccount = {
    primary: true,
    partyId: partyId,
    status: 'allocated',
    hint: 'demo',
    publicKey: 'pk-demo',
    namespace: 'canton',
    networkId: networkId,
    signingProviderId: 'webauthn-prf',
  };

  // ─── Event system ──────────────────────────────────────────────────
  function on(event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
    return function unsubscribe() {
      removeListener(event, handler);
    };
  }

  function emit(event, data) {
    var handlers = listeners[event] || [];
    for (var i = 0; i < handlers.length; i++) {
      try { handlers[i](data); } catch (e) { console.error('[CIP-0103 Demo]', e); }
    }
  }

  function removeListener(event, handler) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(function (h) { return h !== handler; });
  }

  // ─── RPC handler ───────────────────────────────────────────────────
  function request(args) {
    var method = args.method;
    var params = args.params;

    switch (method) {
      case 'status':
        return Promise.resolve({
          provider: {
            id: 'Canton Demo Wallet',
            version: '1.0.0',
            providerType: 'browser-extension',
          },
          network: {
            id: 'devnet',
            name: 'Canton Devnet',
            networkId: networkId, // CIP-0103: the @partylayer/session restore reads status.network.networkId
          },
          // CIP-0103 standard connection state — the @partylayer/session store's
          // restore (restoreImpl) reads status.connection.isConnected.
          connection: { isConnected: connected },
          // Legacy SDK-layer session shape (useClientSession).
          session: connected
            ? { userId: partyId, isConnected: true }
            : null,
        });

      case 'listAccounts':
        // CIP-0103: restoreImpl requests listAccounts to repopulate accounts on
        // restore. Return the primary account when connected, else nothing.
        return Promise.resolve(connected ? [primaryAccount] : []);

      case 'connect':
        connected = true;
        persistSession(); // survive reloads + share across tabs (real-wallet behavior)
        // Legacy SDK-layer session event (drives useClientSession / the Nav chip).
        emit('session', { type: 'connected', userId: partyId });
        // CIP-0103 STANDARD events — a real wallet emits these on connect, and
        // the @partylayer/session store (the encrypted-persistence owner)
        // subscribes to them (statusChanged + accountsChanged). Without these the
        // store never sees the connection, never persists, and the encrypted
        // session-key IndexedDB is never created. Emitted async (after the connect
        // RPC resolves) so adapter-side listeners attached during connect are in
        // place before the events fire.
        setTimeout(function () {
          emit('statusChanged', { connection: { isConnected: true }, network: { networkId: networkId } });
          emit('accountsChanged', [primaryAccount]);
        }, 0);
        return Promise.resolve({
          isConnected: true,
          userId: partyId,
        });

      case 'disconnect':
        connected = false;
        persistSession(); // clear the persisted per-origin connection
        emit('session', { type: 'disconnected' });
        emit('statusChanged', { connection: { isConnected: false } });
        return Promise.resolve({ isConnected: false });

      case 'getPrimaryAccount':
        if (!connected) {
          return Promise.reject({
            code: 4100,
            message: 'Not connected',
          });
        }
        return Promise.resolve({
          partyId: partyId,
          address: '0x' + partyId.replace(/[^a-f0-9]/gi, '').slice(0, 40).padEnd(40, '0'),
          namespace: 'canton',
        });

      case 'signMessage':
        if (!connected) {
          return Promise.reject({
            code: 4100,
            message: 'Not connected',
          });
        }
        var message = params && params.message ? params.message : '';
        var sig = '0xdemo_sig_' + btoa(message).slice(0, 32) + '_' + Date.now().toString(36);
        return Promise.resolve(sig);

      case 'prepareExecute':
        if (!connected) {
          return Promise.reject({
            code: 4100,
            message: 'Not connected',
          });
        }
        var txHash = '0xtx_' + Math.random().toString(36).slice(2, 18);
        var commandId = 'cmd_' + Math.random().toString(36).slice(2, 10);
        emit('txChanged', {
          status: 'pending',
          transactionHash: txHash,
          commandId: commandId,
        });
        // Simulate async execution
        setTimeout(function () {
          emit('txChanged', {
            status: 'signed',
            transactionHash: txHash,
            commandId: commandId,
          });
        }, 500);
        setTimeout(function () {
          emit('txChanged', {
            status: 'executed',
            transactionHash: txHash,
            commandId: commandId,
            updateId: 'upd_' + Math.random().toString(36).slice(2, 10),
          });
        }, 1500);
        return Promise.resolve({
          transactionHash: txHash,
          commandId: commandId,
        });

      default:
        return Promise.reject({
          code: -32601,
          message: 'Method not found: ' + method,
        });
    }
  }

  // ─── Inject into window.canton namespace (collision-resilient) ───────
  //
  // A REAL wallet extension's content script can own window.canton before this
  // script runs (document_start beats any page script), may have defined it
  // non-writable/frozen (assignment would THROW under 'use strict' and kill the
  // injection), or may OVERWRITE window.canton after this script ran. The demo
  // must coexist, never fight the real extension destructively:
  //   1. Always publish the provider on the demo-owned fallback global
  //      window.__plDemoMock (no extension touches it; the demo adapter checks
  //      it too, so discovery works even when window.canton is hostile).
  //   2. Best-effort attach to window.canton.demoWallet in try/catch.
  //   3. Re-assert on DOMContentLoaded plus a short bounded retry window, to
  //      survive an extension that replaces window.canton after page scripts.
  if (typeof window !== 'undefined') {
    var demoProvider = {
      request: request,
      on: on,
      emit: emit,
      removeListener: removeListener,
    };

    // (1) Collision-proof channel, always available to the demo adapter.
    try {
      Object.defineProperty(window, '__plDemoMock', {
        value: demoProvider,
        writable: true,
        configurable: true,
      });
    } catch (e) {
      try { window.__plDemoMock = demoProvider; } catch (e2) { /* give up */ }
    }

    // (2) + (3) Best-effort attach to the canonical namespace, re-asserted.
    var attachToCanton = function () {
      try {
        if (!window.canton) window.canton = {};
        if (window.canton.demoWallet !== demoProvider) {
          window.canton.demoWallet = demoProvider;
        }
        return window.canton.demoWallet === demoProvider;
      } catch (e) {
        return false;
      }
    };

    if (attachToCanton()) {
      console.log('[CIP-0103] Demo Wallet injected at window.canton.demoWallet');
    } else {
      console.warn(
        '[CIP-0103] Demo Wallet could not attach to window.canton (a real ' +
          'extension owns it); available via the window.__plDemoMock fallback.',
      );
    }

    // Re-assert after DOM ready plus a bounded retry window (8 x 250ms, ~2s), in
    // case an extension replaces window.canton late. Never removes or replaces a
    // real extension's own providers; only (re)adds the demoWallet key.
    var reassertsLeft = 8;
    var reassert = function () {
      attachToCanton();
      reassertsLeft -= 1;
      if (reassertsLeft > 0) setTimeout(reassert, 250);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        attachToCanton();
      });
    }
    setTimeout(reassert, 250);
  }
})();
