/**
 * @cantonconnect/core
 * Core types, errors, and abstractions for CantonConnect
 */

export * from './types';
export * from './errors';
export * from './adapters';
export * from './session';
export * from './transport/types';
export { DeepLinkTransport } from './transport/deeplink';
export { PopupTransport } from './transport/popup';
export { PostMessageTransport } from './transport/postmessage';
export { MockTransport } from './transport/mock';
// Re-export legacy transport interface if needed
export type { Transport } from './transport';
