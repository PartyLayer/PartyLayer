/**
 * A narrow, typed client over the Scan (registry) API for the reads the tokenization
 * vertical needs that have no wallet-sdk method: the Amulet instrument metadata (name,
 * symbol, decimals, circulating supply) and the DSO party that administers it.
 *
 * The sdk drives transfers and allocations against Scan internally; these two reads use
 * the documented token-standard registry endpoints directly. Verified live:
 *   GET /registry/metadata/v1/instruments/Amulet -> { id, name, symbol, decimals, totalSupply }
 *   GET /api/scan/v0/dso-party-id                -> { dso_party_id }
 */

export interface ScanInstrument {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  /** The party that administers the instrument (the DSO for Amulet). */
  admin: string;
}

export class ScanClient {
  private readonly base: string;
  private dsoCache?: string;

  constructor(scanUrl: string) {
    this.base = scanUrl.replace(/\/$/, '');
  }

  /** The registry URL as a URL object, for the wallet-sdk registry params. */
  registryUrl(): URL {
    return new URL(this.base);
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await fetch(this.base + path, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('scan ' + path + ' -> HTTP ' + res.status);
    return (await res.json()) as T;
  }

  /** The DSO party id, which is the admin of the Amulet instrument. Cached per process. */
  async dsoPartyId(): Promise<string> {
    if (this.dsoCache) return this.dsoCache;
    const body = await this.getJson<{ dso_party_id: string }>('/api/scan/v0/dso-party-id');
    this.dsoCache = body.dso_party_id;
    return this.dsoCache;
  }

  /** The instrument metadata for `id` (default Amulet), plus its admin party. */
  async instrument(id = 'Amulet'): Promise<ScanInstrument> {
    const [meta, admin] = await Promise.all([
      this.getJson<{ id: string; name: string; symbol: string; decimals: number; totalSupply: string }>(
        '/registry/metadata/v1/instruments/' + encodeURIComponent(id),
      ),
      this.dsoPartyId(),
    ]);
    return {
      id: meta.id,
      name: meta.name,
      symbol: meta.symbol,
      decimals: meta.decimals,
      totalSupply: meta.totalSupply,
      admin,
    };
  }
}
