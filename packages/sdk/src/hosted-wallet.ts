import type { CIP0103Account, CIP0103Provider, OfficialProviderAdapter } from '@partylayer/core';
import { HostedPopupChannel, hostedRpcError } from './hosted-popup';

export interface HostedWalletProfile {
  providerId: string;
  name: string;
  version: string;
  popupName: string;
  readyType: string;
  connectPath: string;
  popupFeatures: string;
  methods: { connect: string; disconnect: string; signMessage: string; prepareExecute: string };
  account(result: unknown, networkId: string): CIP0103Account;
}

export interface HostedWalletOptions {
  walletUrl: string;
  networkId: string;
  providerId?: string;
  name?: string;
  icon?: string;
  connectPath?: string;
  timeoutMs?: number;
  popupFeatures?: string;
}

/**
 * Internal ProviderAdapter. Discovery/native ownership stays with the SDK owner.
 * Account/status are the last wallet-approved identity, not a remote freshness
 * check. Closing an idle UI window does not establish server logout; the next
 * explicit request can reopen it. Only an actual connect reply changes identity.
 * Disconnect/teardown clear it. A lost write reply never triggers replay.
 */
export function createHostedWalletAdapter(profile: HostedWalletProfile, options: HostedWalletOptions): OfficialProviderAdapter {
  const providerId = options.providerId ?? profile.providerId;
  const timeoutMs = Math.max(5_000, options.timeoutMs ?? 60_000);
  if (!Number.isFinite(timeoutMs)) throw new Error('Hosted wallet timeout must be finite');
  const channel = new HostedPopupChannel({ walletUrl: options.walletUrl, connectPath: options.connectPath ?? profile.connectPath,
    timeoutMs, popupName: profile.popupName, readyType: profile.readyType, popupFeatures: options.popupFeatures ?? profile.popupFeatures });
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  let account: CIP0103Account | null = null;
  let revision = 0;
  const status = () => ({ connection: { isConnected: account !== null, isNetworkConnected: account !== null },
    provider: { id: providerId, version: profile.version, providerType: 'remote' }, network: { networkId: options.networkId } });
  const changed = () => { provider.emit('statusChanged', status()); provider.emit('accountsChanged', account ? [account] : []); };
  const clear = (notifyDisconnected = false) => {
    ++revision;
    if (!account && !notifyDisconnected) return;
    account = null;
    provider.emit('disconnected');
    changed();
  };
  const requireAccount = () => { if (!account) throw hostedRpcError(4100, 'No active hosted wallet connection'); return account; };
  const paramsObject = (value: unknown): Record<string, unknown> => {
    if (value === undefined) return {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw hostedRpcError(-32602, 'Method parameters must be an object');
    return value as Record<string, unknown>;
  };
  const provider: CIP0103Provider = {
    request: async <T>(args: Parameters<CIP0103Provider['request']>[0]): Promise<T> => {
      try {
        if (!args || typeof args !== 'object' || Array.isArray(args) || typeof args.method !== 'string') throw hostedRpcError(-32600, 'Request must have a string method');
        const params = paramsObject(args.params);
        let result: unknown;
        switch (args.method) {
          case 'connect': {
            const captured = revision;
            const connected = await channel.request(profile.methods.connect, {
              appName: typeof params.appName === 'string' ? params.appName : 'Canton application',
              network: options.networkId,
              ...(typeof params.requestId === 'string' || typeof params.requestId === 'number' ? { requestId: params.requestId } : {}),
              origin: window.location.origin,
            });
            if (captured !== revision) throw hostedRpcError(4900, 'Hosted wallet connection was cancelled');
            account = profile.account(connected, options.networkId);
            provider.emit('connected', account);
            changed();
            result = { isConnected: true, isNetworkConnected: true };
            break;
          }
          case 'disconnect':
            try { if (account && channel.isOpen) await channel.request(profile.methods.disconnect); }
            finally { channel.close(); clear(true); }
            break;
          case 'isConnected': result = account !== null; break;
          case 'status': result = status(); break;
          case 'listAccounts': result = [requireAccount()]; break;
          case 'getPrimaryAccount': result = requireAccount(); break;
          case 'getActiveNetwork': requireAccount(); result = { networkId: options.networkId }; break;
          case 'signMessage':
            requireAccount();
            if (typeof params.message !== 'string' || !params.message) throw hostedRpcError(-32602, 'message must be a non-empty UTF-8 string');
            result = await channel.request(profile.methods.signMessage, { message: params.message });
            break;
          case 'prepareExecute':
            requireAccount();
            if (!Array.isArray(params.commands) || params.commands.length === 0) throw hostedRpcError(-32602, 'commands must be a non-empty array');
            result = await channel.request(profile.methods.prepareExecute, { commands: params.commands });
            break;
          default: throw hostedRpcError(4200, `Unsupported CIP-0103 method: ${args.method}`);
        }
        return result as T;
      } catch (error) {
        if (error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'number') throw error;
        throw hostedRpcError(-32603, error instanceof Error ? error.message : 'Hosted wallet request failed');
      }
    },
    on(event, listener) {
      const set = listeners.get(event) ?? new Set();
      set.add(listener as (...args: unknown[]) => void);
      listeners.set(event, set);
      return provider;
    },
    emit(event, ...args) {
      const set = listeners.get(event);
      if (!set?.size) return false;
      for (const listener of set) listener(...args);
      return true;
    },
    removeListener(event, listener) { listeners.get(event)?.delete(listener as (...args: unknown[]) => void); return provider; },
  };
  return { providerId, name: options.name ?? profile.name, type: 'remote', icon: options.icon,
    detect: async () => typeof window !== 'undefined', provider: () => provider,
    restore: async () => null, teardown: () => { channel.close(); clear(); } };
}
