/**
 * AES-GCM-256 key management + envelope crypto for encrypted session persistence.
 *
 * APPROVED DESIGN — CRITICAL INVARIANT (cited per request):
 *   The AES-GCM-256 `CryptoKey` is ALWAYS generated **non-extractable** and is
 *   ALWAYS stored in **IndexedDB** (via structured clone — `localStorage` can
 *   only hold strings and therefore cannot hold a `CryptoKey`). Only the
 *   CIPHERTEXT blob location varies by backend (IndexedDB vs localStorage).
 *   Rationale: both backends are supported; key non-extractability is the
 *   security floor, so the key must never be serialized to a string store.
 *
 * Per-write a fresh random 12-byte IV is generated (never reused) and stored
 * alongside the ciphertext.
 *
 * THREAT MODEL (honest, see README): this protects at-rest persisted data and
 * casual inspection (devtools, disk). It does NOT defend against same-origin
 * XSS — in-page code can call `encrypt`/`decrypt` through the very same
 * non-extractable key handle. No overclaiming.
 */

/** WebCrypto availability — encrypted backends require SubtleCrypto + IndexedDB. */
function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) {
    throw new Error('WebCrypto (crypto.subtle) is unavailable in this runtime');
  }
  return c.subtle;
}

function getIndexedDB(): IDBFactory {
  const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!idb) throw new Error('IndexedDB is unavailable in this runtime');
  return idb;
}

/**
 * Origin-bound namespace. Browsers already partition storage per origin; we
 * additionally embed the origin in every DB/store/key name so this layer never
 * mixes data across origins even within a shared test/runtime global
 * (origin-bound session isolation). Falls back to a stable literal off-origin
 * (Node/tests) so naming is deterministic.
 */
export function originTag(explicit?: string): string {
  if (explicit) return explicit;
  const origin = (globalThis as { location?: { origin?: string } }).location?.origin;
  return origin && origin.length > 0 ? origin : 'no-origin';
}

const KEY_DB_PREFIX = 'partylayer-session-key';
const KEY_STORE = 'keys';
const KEY_ID = 'aes-gcm-256';

function keyDbName(origin: string): string {
  return `${KEY_DB_PREFIX}::${origin}`;
}

/** Promisify an IDBRequest. */
function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

/** Open (and upgrade-create the object store for) an origin-bound IndexedDB. */
export function openDb(name: string, store: string): Promise<IDBDatabase> {
  const open = getIndexedDB().open(name, 1);
  open.onupgradeneeded = () => {
    const db = open.result;
    if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
  };
  return reqToPromise(open);
}

export async function idbGet<T>(name: string, store: string, key: string): Promise<T | undefined> {
  const db = await openDb(name, store);
  try {
    const tx = db.transaction(store, 'readonly');
    return await reqToPromise<T | undefined>(tx.objectStore(store).get(key) as IDBRequest<T | undefined>);
  } finally {
    db.close();
  }
}

export async function idbPut(name: string, store: string, key: string, value: unknown): Promise<void> {
  const db = await openDb(name, store);
  try {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value as never, key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'));
    });
  } finally {
    db.close();
  }
}

export async function idbDelete(name: string, store: string, key: string): Promise<void> {
  const db = await openDb(name, store);
  try {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB delete aborted'));
    });
  } finally {
    db.close();
  }
}

/**
 * Load the origin's AES-GCM-256 key from IndexedDB, generating + persisting a
 * fresh **non-extractable** key on first use. The stored value is a live
 * `CryptoKey` (structured clone) — never raw key bytes.
 */
export async function loadOrCreateKey(origin: string): Promise<CryptoKey> {
  const db = keyDbName(origin);
  const existing = await idbGet<CryptoKey>(db, KEY_STORE, KEY_ID);
  // A structured-cloned CryptoKey round-trips as a CryptoKey.
  if (existing && (existing as { type?: unknown }).type) return existing;

  const key = await getSubtle().generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // NON-EXTRACTABLE — the security floor; never exportable.
    ['encrypt', 'decrypt'],
  );
  await idbPut(db, KEY_STORE, KEY_ID, key);
  return key;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

/** Ciphertext envelope as persisted (the only thing that varies by backend is WHERE this JSON lives). */
export interface CryptoEnvelope {
  /** Crypto envelope format version (distinct from the session-schema version). */
  readonly f: 1;
  /** Fresh per-write 12-byte IV, base64. */
  readonly iv: string;
  /** AES-GCM ciphertext, base64. */
  readonly ct: string;
}

// TS 5.7+ types `Uint8Array` as `Uint8Array<ArrayBufferLike>`, which is not
// directly assignable to DOM `BufferSource` (ArrayBuffer-backed). Our views are
// always ArrayBuffer-backed at runtime, so narrow them at the WebCrypto boundary.
const asBuf = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

/** Encrypt a plaintext string into a fresh-IV envelope. */
export async function encryptToEnvelope(key: CryptoKey, plaintext: string): Promise<CryptoEnvelope> {
  const iv = (globalThis.crypto as Crypto).getRandomValues(new Uint8Array(12));
  const ct = await getSubtle().encrypt(
    { name: 'AES-GCM', iv: asBuf(iv) },
    key,
    asBuf(enc.encode(plaintext)),
  );
  return { f: 1, iv: toB64(iv), ct: toB64(ct) };
}

/** Decrypt an envelope back to plaintext. Throws on tamper/wrong-key (caller maps to null). */
export async function decryptFromEnvelope(key: CryptoKey, env: CryptoEnvelope): Promise<string> {
  if (!env || env.f !== 1 || typeof env.iv !== 'string' || typeof env.ct !== 'string') {
    throw new Error('Unrecognized crypto envelope');
  }
  const pt = await getSubtle().decrypt(
    { name: 'AES-GCM', iv: asBuf(fromB64(env.iv)) },
    key,
    asBuf(fromB64(env.ct)),
  );
  return dec.decode(pt);
}
