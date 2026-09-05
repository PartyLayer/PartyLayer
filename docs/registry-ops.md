# Registry Operations Guide

This guide covers how to safely update, promote, and rollback the wallet registry.

## Prerequisites

1. **Signing Keys**: Generate keys using:
   ```bash
   pnpm registry:sign --generate-key
   ```
   ⚠️ **Never commit private keys (`.key` files) to git.**

2. **Registry CLI**: Install and build:
   ```bash
   cd packages/registry-cli
   pnpm install
   pnpm build
   ```


## `ERR_ABORTED` on registry.json in the console is not a failed fetch

In development you will see one or two aborted requests for
`/v1/<channel>/registry.json` in the browser console:

```
GET .../registry/v1/stable/registry.json   net::ERR_ABORTED
```

**This is React StrictMode double-mounting**, not a broken registry. StrictMode
mounts every component twice in dev; the first mount's in-flight fetch is
aborted when it unmounts, and the second one completes. The registry loads fine —
the wallet list renders, and the same page served over `curl` returns HTTP 200
with the full document.

It is called out here because it reads exactly like a failed network request to
anyone scanning a console, and time has been lost to it. Two checks settle it in
seconds:

```bash
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' \
  http://localhost:3000/registry/v1/stable/registry.json      # expect: 200 10330
```

and: does the picker actually list wallets? If it does, the registry loaded.

A genuinely broken registry fetch looks different — `RegistryFetchFailedError`
surfaced through the SDK, an empty or fallback wallet list, and a non-200 status
on that URL. Production builds do not run StrictMode, so this does not appear
there at all.


## Common Operations

Wallet logos live in `registry/wallets/`; see [registry/wallets/NOTICE.md](../registry/wallets/NOTICE.md) for the trademark notice that covers those marks.

### Add a New Wallet

```bash
# Add to beta first (staged rollout)
partylayer-registry add-wallet \
  --channel beta \
  --walletId mywallet \
  --name "My Wallet" \
  --adapterPackage "@partylayer/adapter-mywallet" \
  --adapterRange ">=0.1.0" \
  --homepage "https://mywallet.com" \
  --icon "https://mywallet.com/icon.png" \
  --sign \
  --key registry/keys/dev.key

# Verify
partylayer-registry verify --channel beta --pubkey registry/keys/dev.pub

# Check status
partylayer-registry print-status --channel beta
```

### Promote from Beta to Stable

```bash
# Promote beta registry to stable
partylayer-registry promote \
  --from beta \
  --to stable \
  --key registry/keys/dev.key

# Verify stable
partylayer-registry verify --channel stable --pubkey registry/keys/dev.pub
```

### Update Existing Wallet

```bash
partylayer-registry update-wallet \
  --channel stable \
  --walletId mywallet \
  --name "Updated Wallet Name" \
  --homepage "https://newurl.com"

# Sign after update
partylayer-registry sign --channel stable --key registry/keys/dev.key
```

### Remove Wallet

```bash
partylayer-registry remove-wallet \
  --channel stable \
  --walletId deprecated-wallet

# Sign after removal
partylayer-registry sign --channel stable --key registry/keys/dev.key
```

### Bump Sequence (Force Refresh)

```bash
# Increment sequence without changing wallets
partylayer-registry bump-sequence --channel stable

# Sign
partylayer-registry sign --channel stable --key registry/keys/dev.key
```

## Key Rotation

### 1. Generate New Key Pair

```bash
pnpm registry:sign --generate-key
# Creates registry/keys/dev-{timestamp}.pub and .key
```

### 2. Sign with Both Keys (Transition Period)

```bash
# Sign with old key
partylayer-registry sign --channel stable --key registry/keys/old.key

# Sign with new key (overwrites)
partylayer-registry sign --channel stable --key registry/keys/new.key
```

### 3. Update SDK Configs

Add new public key to `registryPublicKeys` array:

```typescript
const client = createPartyLayer({
  registryPublicKeys: [
    'old-public-key-base64', // Keep for backward compatibility
    'new-public-key-base64', // Add new key
  ],
  // ...
});
```

### 4. After Transition Period

- Remove old key from `registryPublicKeys`
- Archive old private key securely
- Update documentation

## Rollback Procedure

If a bad registry is published:

### 1. Identify Last Known Good Sequence

Check cached registry in SDK or check git history:

```bash
git log registry/v1/stable/registry.json
```

### 2. Restore Previous Registry

```bash
# Checkout previous version
git checkout HEAD~1 -- registry/v1/stable/registry.json

# Ensure sequence is higher than bad one
# Edit metadata.sequence if needed

# Sign with current key
partylayer-registry sign --channel stable --key registry/keys/dev.key

# Verify
partylayer-registry verify --channel stable --pubkey registry/keys/dev.pub
```

### 3. SDK Behavior

- SDK detects sequence downgrade and rejects new registry
- Falls back to last-known-good cache
- Emits `REGISTRY_VERIFICATION_FAILED` error event
- UI shows cached/stale indicator

## Staged Rollout Workflow

1. **Add to Beta**:
   ```bash
   partylayer-registry add-wallet --channel beta ...
   ```

2. **Monitor Beta Usage**:
   - Check error rates
   - Verify wallet adapter works
   - Monitor registry status events in debug page

3. **Promote to Stable**:
   ```bash
   partylayer-registry promote --from beta --to stable --key ...
   ```

4. **Monitor Stable**:
   - Watch for errors
   - Verify signature verification works
   - Check cache behavior

## Registry Server Deployment

### Development

```bash
cd apps/registry-server
pnpm dev
```

### Production

```bash
# Set environment variables
export PORT=3001
export REGISTRY_DIR=/path/to/registry

# Run server
pnpm start
```

### Static Hosting (Vercel/Netlify)

```bash
DEPLOY_MODE=static pnpm start
```

This prints file locations to serve via CDN.

## Cache Policy (CDN)

The registry is served by Cloudflare Pages at `registry.partylayer.xyz`. Caching is set by `registry/_headers` and `registry/_worker.js`, per path type:

- **Manifest** (`/v1/<channel>/registry.json`): `max-age=60`, set in `_worker.js`. Short on purpose, so a new entry, a promotion, or an icon correction reaches users within about a minute. It is set in the worker rather than `_headers` because Pages combines Cache-Control across every matching `_headers` rule, which would concatenate the `/*.json` `max-age=300` with a manifest `max-age=60` into an ambiguous header. ETags are present, so most of these loads are `304 Not Modified` with no body.
- **Icons** (`/wallets/*`): `max-age=3600` (one hour), with plain, human-readable filenames. Icons revalidate against their ETag once an hour, which is a `304` (about 950 bytes of headers, no image body), so the bandwidth cost is negligible for eight marks totalling roughly 49 KB. A corrected mark therefore propagates within an hour with no cache purge and no build tooling. Filenames stay plain (no content hash) because contributors add their `icon` URL by hand in their registry PR, per the generic bridge guide, and a hashed URL would make that contribution worse.
- **Not found**: the worker returns a real `404` with `Cache-Control: no-store`. It must never return the index page as a `200`.

### Why the not-found rule exists

This is not a style choice; it is here because of a real incident. Pages was serving the SPA index fallback as `200 text/html` for any missing path, and that HTML inherited the one-day `/wallets/*` cache. So a request to a mark URL before it was deployed (a diagnostic curl, or a consumer loading a just-added wallet a moment early) cached a not-found as a success for 24 hours. The symptom was a wallet icon falling back to the neutral glyph on production while the file was present and valid at the origin, with no way for the person seeing it to tell a stale cache from a missing file. The worker now detects a file request (a path with a non-HTML extension) that came back as the HTML fallback and returns an uncacheable 404 instead.

If you change a header here, keep three invariants: the manifest stays short, icons stay revalidated rather than immutable (so a correction needs no purge), and a missing path is a non-cacheable 404, never a cached 200.

## Security Best Practices

1. **Never commit private keys** - Add `registry/keys/*.key` to `.gitignore`
2. **Use separate keys for dev/prod** - Never use dev keys in production
3. **Rotate keys periodically** - Follow key rotation procedure
4. **Verify signatures before deploying** - Always run `verify` command
5. **Monitor sequence numbers** - Ensure monotonic increments
6. **Test rollback procedure** - Know how to recover from bad updates

## Troubleshooting

### Signature Verification Fails

- Check public key matches private key used to sign
- Verify registry.json wasn't modified after signing
- Ensure signature file exists and is valid JSON

### Sequence Downgrade Detected

- This is intentional security feature
- SDK rejects downgrades and uses cached version
- To fix: ensure new registry has higher sequence number

### Registry Not Updating

- Check ETag headers - SDK uses 304 Not Modified
- Clear SDK cache: `client.clearCache()` (if exposed)
- Verify registry server is serving latest files

## See Also

- [Release Process](./releasing.md) - Package versioning and publishing
