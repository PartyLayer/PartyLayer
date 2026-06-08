/**
 * @partylayer/core
 * Core types, errors, and abstractions for PartyLayer
 */

export * from './types';
export * from './errors';
export * from './adapters';
export * from './session';
export * from './detection';
export * from './transport/types';
export * from './metrics';
export * from './metrics-payload';
export * from './cip0103-types';
export * from './network';
export { DeepLinkTransport } from './transport/deeplink';
export { PopupTransport } from './transport/popup';
export { PostMessageTransport } from './transport/postmessage';
export { MockTransport } from './transport/mock';
// Re-export legacy transport interface if needed
export type { Transport } from './transport';
