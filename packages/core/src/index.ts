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
export * from './cost';
export * from './transfer';
export type { AuthenticationIdentity, AuthenticationChallenge } from './authentication';
export type { TokenLock, TokenHolding, TokenHoldingRef } from './token-holdings';
export { parseTokenAccount, parseTokenHoldingV1, parseTokenHoldingV2, tokenHoldingOwner } from './token-accounts';
export type { TokenAccount, TokenHoldingV2, TokenHoldingV2Ref, AnyTokenHoldingRef } from './token-accounts';
export { availableTokenTransferV2Actions } from './token-transfers-v2';
export type { TokenTransferV1, TokenTransferInstructionV1, TokenTransferInstructionV1Ref, TokenTransferInstructionV1Status } from './token-transfers-v1';
export type { TokenTransferV2, TokenTransferV2Action, TokenTransferV2AvailableActions, TokenTransferInstructionV2, TokenTransferInstructionV2Ref, TokenTransferV2Result } from './token-transfers-v2';
export { DeepLinkTransport, createBrowserDeepLinkPlatform } from './transport/deeplink';
export type { DeepLinkPlatform, DeepLinkCallback } from './transport/deeplink';
export { PopupTransport } from './transport/popup';
export { PostMessageTransport } from './transport/postmessage';
export { MockTransport } from './transport/mock';
// Re-export legacy transport interface if needed
export type { Transport } from './transport';
