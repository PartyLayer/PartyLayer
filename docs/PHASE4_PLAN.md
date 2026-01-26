# Phase 4 Implementation Plan

## A) Signed Registry Format ✅
- [x] Updated schema with channel, sequence, publishedAt
- [x] Signature in separate .sig file
- [x] Created registry directory structure
- [x] Created sign.ts script
- [x] Created verify.ts script

## B) Registry Client Enhancements ✅
- [x] Signature verification (Ed25519)
- [x] Multi-channel support
- [x] Sequence number validation
- [x] Last-known-good caching
- [x] SWR pattern
- [x] ETag support
- [x] Registry status tracking

## C) SDK/React Integration (In Progress)
- [ ] Add registry status events to SDK
- [ ] Update React components to show registry status
- [ ] Add debug indicators

## D) Registry Server + CLI (Pending)
- [ ] Create minimal registry server
- [ ] Create registry CLI tool

## E) Security Hardening (Pending)
- [ ] Origin allowlist enforcement
- [ ] Event normalization

## F) Release/DX (Pending)
- [ ] Versioning strategy
- [ ] CI gates
- [ ] Release documentation
