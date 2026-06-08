/**
 * CAIP-2 Network Identity Utilities
 *
 * Moved to @partylayer/core (so the lower adapter layer can use them without
 * importing @partylayer/provider). Re-exported here for backward compatibility:
 * provider/bridge.ts and provider's public exports keep importing from
 * './network' with no API change.
 */

export { CANTON_NETWORKS, toCAIP2Network, fromCAIP2Network, isValidCAIP2 } from '@partylayer/core';
