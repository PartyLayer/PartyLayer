# PartyLayer Metrics & Telemetry

This document describes the metrics collection system in PartyLayer SDK, designed to support App Rewards reporting and ecosystem health monitoring.

## Overview

PartyLayer is an **enablement layer**, not a transaction producer. Our metrics focus on:

- **Adoption**: How many dApps use PartyLayer
- **Enablement**: How many wallet connections and sessions we facilitate
- **Stability**: Error rates and restore success

> **Privacy First**: All metrics are privacy-safe. No wallet addresses, party IDs, or user identifiers are ever collected.

---

## Quick Start

### Enable Telemetry

```typescript
import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'devnet',
  app: { name: 'My dApp' },
  telemetry: {
    enabled: true,
    endpoint: 'https://your-metrics-backend.example.com/api/v1/events',
    appId: 'my-dapp',  // Will be hashed
  },
});
```

### Check Metrics (Debug)

```typescript
import { MetricsTelemetryAdapter } from '@partylayer/sdk';

const adapter = new MetricsTelemetryAdapter({ enabled: true, network: 'devnet' });
// ... use adapter ...

// Get current metrics
console.log(adapter.getMetrics());
// { wallet_connect_attempts: 5, wallet_connect_success: 4, ... }
```

---

## Telemetry Configuration

```typescript
interface TelemetryConfig {
  // Enable/disable telemetry (default: false)
  enabled: boolean;
  
  // Backend endpoint (optional - metrics stored locally if not set)
  endpoint?: string;
  
  // Sampling rate 0.0-1.0 (default: 1.0 = 100%)
  sampleRate?: number;
  
  // App identifier (will be SHA-256 hashed)
  appId?: string;
  
  // Include hashed origin (default: false)
  includeOrigin?: boolean;
  
  // Batch size before flush (default: 10)
  batchSize?: number;
  
  // Auto-flush interval in ms (default: 30000)
  flushIntervalMs?: number;
  
  // Network identifier
  network?: string;
}
```

---

## Canonical Metrics

These metric names are stable and should not be changed. Changing them breaks App Rewards reporting.

### Enablement Metrics

| Metric | Description | When Incremented |
|--------|-------------|------------------|
| `wallet_connect_attempts` | Total connect() calls | Every `connect()` call |
| `wallet_connect_success` | Successful connections | `session:connected` event |
| `sessions_created` | New sessions (not restored) | New connection established |
| `sessions_restored` | Sessions restored from storage | Successful restore |
| `restore_attempts` | Total restore attempts | Every restore call |

### Error Metrics

| Metric | Description |
|--------|-------------|
| `error_USER_REJECTED` | User cancelled operation |
| `error_WALLET_NOT_INSTALLED` | Wallet extension not found |
| `error_TIMEOUT` | Operation timed out |
| `error_TRANSPORT_ERROR` | Communication error |
| `error_<CODE>` | Any other error code |

### Registry Metrics

| Metric | Description |
|--------|-------------|
| `registry_fetch` | Registry fetched from network |
| `registry_cache_hit` | Registry served from cache |
| `registry_stale` | Stale registry was used |

---

## Metric → Event Mapping

| SDK Event | Metric |
|-----------|--------|
| `connect()` call | `wallet_connect_attempts` |
| `session:connected` | `wallet_connect_success`, `sessions_created` or `sessions_restored` |
| `error` with code | `error_<code>` |
| `registry:status` source=network | `registry_fetch` |
| `registry:status` source=cache | `registry_cache_hit` |
| `registry:status` stale=true | `registry_stale` |

---

## Privacy Guarantees

### Never Collected

The following are NEVER included in metrics:

- Wallet addresses
- Raw party IDs
- Transaction payloads
- Signed message content
- User identifiers
- Email addresses
- IP addresses (by design, not logged at SDK level)

### Collected (Safe)

- SDK version
- Network name (devnet, mainnet)
- Metric counts
- Timestamps
- Error codes (generic categories)

### Opt-in (Hashed)

- App identifier (SHA-256 hashed)
- Origin (SHA-256 hashed, if `includeOrigin: true`)

---

## Payload Format

Metrics are sent as JSON payloads:

```typescript
interface MetricsPayload {
  sdkVersion: string;      // e.g., "0.3.0"
  network: string;         // e.g., "devnet"
  timestamp: number;       // Unix timestamp (ms)
  metrics: {               // Metric name → count
    wallet_connect_attempts: number;
    wallet_connect_success: number;
    sessions_created: number;
    // ... more metrics
  };
  appIdHash?: string;      // SHA-256 hash of appId
  originHash?: string;     // SHA-256 hash of origin (opt-in)
}
```

---

## Backend Integration

### Expected Endpoint

The metrics backend should accept:

```
POST /api/v1/events
Content-Type: application/json

{
  "sdkVersion": "0.3.0",
  "network": "devnet",
  "timestamp": 1706889600000,
  "metrics": { ... },
  "appIdHash": "a1b2c3..."
}
```

### Response

- `200 OK` - Event accepted
- `400 Bad Request` - Invalid payload (PII detected, missing fields)

### Recommended Backend

See `partylayer-metrics-backend` repository for a Cloudflare Workers + D1 reference implementation.

---

## App Rewards Alignment

These metrics support Canton Network App Rewards reporting:

### Category: Infrastructure / Enablement

PartyLayer enables wallet connections for dApps. Our metrics prove:

1. **Adoption** - Monthly Active dApps (from `appIdHash` unique counts)
2. **Enablement** - Sessions enabled (from `sessions_created` + `sessions_restored`)
3. **Coverage** - Wallets supported (from registry)
4. **Quality** - Error rates, restore success rates

### Monthly Report Template

```markdown
## PartyLayer Monthly Report (YYYY-MM)

### Adoption
- Monthly Active dApps: XX
- Total dApps Integrated: XX

### Enablement
- Wallet Connect Attempts: XX,XXX
- Successful Sessions: XX,XXX
- Session Restore Success: XX.X%

### Coverage
- Wallets Supported: X/X (100%)

### Error Distribution
- USER_REJECTED: XX%
- WALLET_NOT_INSTALLED: XX%
- OTHER: XX%
```

---

## Testing

### Unit Tests

```bash
# Run metrics tests
cd packages/sdk
pnpm test
```

### Manual Testing

1. Enable telemetry in demo app
2. Connect/disconnect wallets
3. Check metrics panel in UI
4. Verify metrics in browser console

---

## Troubleshooting

### Metrics not appearing?

1. Check `telemetry.enabled: true`
2. Verify endpoint is reachable
3. Check browser console for errors

### High error rates?

1. Check `error_<CODE>` breakdown
2. Most common: `USER_REJECTED` (normal user behavior)
3. Investigate `TRANSPORT_ERROR` for connectivity issues

### Sampling not working?

- `sampleRate: 0` disables all metrics
- `sampleRate: 1.0` captures everything
- Values between apply probabilistic sampling

---

## Version History

| Version | Changes |
|---------|---------|
| 0.3.0 | Initial metrics implementation |

---

## Related Documents

- [PUBLIC_API_STABILITY.md](./PUBLIC_API_STABILITY.md) - API stability guarantees
- [EVENT_SPEC.md](./EVENT_SPEC.md) - Event payload specifications
