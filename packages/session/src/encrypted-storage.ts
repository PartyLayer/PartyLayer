/**
 * Encrypted `SessionStorage` backends.
 *
 * Two ADDITIVE implementations of the existing {@link SessionStorage} contract
 * (`getItem`/`setItem`/`removeItem`, MaybePromise-aware) — they encrypt the
 * stored VALUE at rest with AES-GCM-256:
 *   - {@link createEncryptedIndexedDBStorage} — DEFAULT; ciphertext blob in IndexedDB.
 *   - {@link createEncryptedLocalStorage}     — ciphertext blob in localStorage.
 *
 * APPROVED-DESIGN INVARIANT (see crypto.ts): regardless of backend the
 * AES-GCM-256 key is non-extractable and lives ONLY in IndexedDB. Only the
 * ciphertext blob LOCATION differs here. Each write uses a fresh random 12-byte
 * IV stored beside the ciphertext.
 *
 * RESILIENCE: a corrupted blob, a wrong/rotated key, or an unknown FUTURE crypto
 * envelope version makes `getItem` return `null` and CLEAR that entry — it never
 * throws into application code (the restore-safety guarantee).
 *
 * These backends are session-shape-agnostic: they encrypt whatever string the
 * store persists. The versioned SESSION payload + migration scaffold lives in
 * `session-envelope.ts`; compose them (`setItem(key, encodeSessionEnvelope(...))`).
 */
import {
  type CryptoEnvelope,
  decryptFromEnvelope,
  encryptToEnvelope,
  idbDelete,
  idbGet,
  idbPut,
  loadOrCreateKey,
  originTag,
} from './crypto';
import type { SessionStorage } from './storage';

export interface EncryptedStorageOptions {
  /**
   * Explicit origin tag for naming the key/data stores. Defaults to
   * `location.origin` (browser) or a stable off-origin literal (Node/tests).
   * Enables per-origin isolation + deterministic test naming.
   */
  origin?: string;
}

/** A minimal place to keep ciphertext blobs, keyed by the SessionStorage key. */
interface BlobStore {
  get(key: string): Promise<string | null>;
  set(key: string, blob: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const DATA_DB_PREFIX = 'partylayer-session-data';
const DATA_STORE = 'blobs';
const LS_PREFIX = 'partylayer.session.enc';

function indexedDbBlobStore(origin: string): BlobStore {
  const db = `${DATA_DB_PREFIX}::${origin}`;
  return {
    async get(key) {
      return (await idbGet<string>(db, DATA_STORE, key)) ?? null;
    },
    async set(key, blob) {
      await idbPut(db, DATA_STORE, key, blob);
    },
    async remove(key) {
      await idbDelete(db, DATA_STORE, key);
    },
  };
}

function localStorageBlobStore(origin: string): BlobStore {
  const ns = (key: string) => `${LS_PREFIX}::${origin}::${key}`;
  const ls = (): Storage => {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    if (!s) throw new Error('localStorage is unavailable in this runtime');
    return s;
  };
  return {
    async get(key) {
      return ls().getItem(ns(key));
    },
    async set(key, blob) {
      ls().setItem(ns(key), blob);
    },
    async remove(key) {
      ls().removeItem(ns(key));
    },
  };
}

/**
 * Build a `SessionStorage` whose values are AES-GCM-256 encrypted; the
 * ciphertext blob is held by `blobs`, the key always in IndexedDB.
 */
function createEncryptedStorage(origin: string, blobs: BlobStore): SessionStorage {
  return {
    async getItem(key) {
      let raw: string | null;
      try {
        raw = await blobs.get(key);
      } catch {
        return null; // store unavailable → behave as "nothing persisted"
      }
      if (raw == null) return null;
      try {
        const env = JSON.parse(raw) as CryptoEnvelope;
        const cryptoKey = await loadOrCreateKey(origin);
        return await decryptFromEnvelope(cryptoKey, env);
      } catch {
        // Corrupt JSON, wrong/rotated key, tampered ciphertext, or an unknown
        // future crypto-envelope version → drop it. NEVER throw into app code.
        try {
          await blobs.remove(key);
        } catch {
          /* best-effort clear */
        }
        return null;
      }
    },
    async setItem(key, value) {
      const cryptoKey = await loadOrCreateKey(origin);
      const env = await encryptToEnvelope(cryptoKey, value);
      await blobs.set(key, JSON.stringify(env));
    },
    async removeItem(key) {
      await blobs.remove(key);
    },
  };
}

/** DEFAULT encrypted backend — ciphertext in IndexedDB, key in IndexedDB. */
export function createEncryptedIndexedDBStorage(
  options: EncryptedStorageOptions = {},
): SessionStorage {
  const origin = originTag(options.origin);
  return createEncryptedStorage(origin, indexedDbBlobStore(origin));
}

/** Encrypted backend with ciphertext in localStorage — key STILL in IndexedDB. */
export function createEncryptedLocalStorage(
  options: EncryptedStorageOptions = {},
): SessionStorage {
  const origin = originTag(options.origin);
  return createEncryptedStorage(origin, localStorageBlobStore(origin));
}
