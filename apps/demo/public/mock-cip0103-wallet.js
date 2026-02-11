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
  var connected = false;
  var listeners = {};
  var partyId = 'party::demo-user-' + Math.random().toString(36).slice(2, 8);

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
          },
          session: connected
            ? { userId: partyId, isConnected: true }
            : null,
        });

      case 'connect':
        connected = true;
        emit('session', { type: 'connected', userId: partyId });
        return Promise.resolve({
          isConnected: true,
          userId: partyId,
        });

      case 'disconnect':
        connected = false;
        emit('session', { type: 'disconnected' });
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

  // ─── Inject into window.canton namespace ───────────────────────────
  if (typeof window !== 'undefined') {
    if (!window.canton) window.canton = {};
    window.canton.demoWallet = {
      request: request,
      on: on,
      emit: emit,
      removeListener: removeListener,
    };
    console.log('[CIP-0103] Demo Wallet injected at window.canton.demoWallet');
  }
})();
