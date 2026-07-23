/**
 * JSON-RPC 2.0 client for the Cauri CIP-103 gateway (`POST /api/dapp`).
 */

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  id: string;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export interface CauriConnectResult {
  isConnected: boolean;
  isNetworkConnected: boolean;
  userUrl?: string;
  sessionToken?: string;
}

// Wire name is `messageId` per CIP-103 OpenRPC; the wallet handles it as a
// commandId internally.
export interface CauriSignMessageResult {
  messageId: string;
  userUrl: string;
}

export interface CauriIsConnectedResult {
  isConnected: boolean;
  isNetworkConnected: boolean;
  partyId?: string;
}

export class CauriRpcClient {
  constructor(readonly apiBase: string) {}

  async call<T>(method: string, params?: Record<string, unknown>, bearerToken?: string): Promise<T> {
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      params: params ?? {},
    };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

    const res = await fetch(`${this.apiBase}/api/dapp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!text) {
      throw new Error(`Cauri gateway returned empty body for ${method} (HTTP ${res.status})`);
    }
    const parsed = JSON.parse(text) as JsonRpcResponse<T>;
    if (parsed.error) {
      throw new Error(`Cauri gateway ${method} failed: ${parsed.error.code} ${parsed.error.message}`);
    }
    if (parsed.result === undefined) {
      throw new Error(`Cauri gateway ${method} returned no result`);
    }
    return parsed.result;
  }
}
