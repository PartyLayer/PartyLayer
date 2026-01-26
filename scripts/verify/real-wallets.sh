#!/bin/bash
#
# Real Wallet Verification Script
#
# This script runs E2E tests with REAL wallets (Console + Loop).
# Requires:
# - Console wallet installed in browser
# - Loop wallet installed in browser
# - Registry server running
# - Demo app running
#
# Usage: ./scripts/verify/real-wallets.sh

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ARTIFACTS_DIR="$ROOT/artifacts/verify/$TIMESTAMP"
mkdir -p "$ARTIFACTS_DIR"

echo "=========================================="
echo "Real Wallet Verification"
echo "=========================================="
echo ""
echo "This script will:"
echo "1. Start registry server"
echo "2. Start demo app (REAL mode)"
echo "3. Prompt you to complete wallet connections"
echo "4. Collect logs and screenshots"
echo ""
echo "Prerequisites:"
echo "- Console wallet installed in browser"
echo "- Loop wallet installed in browser"
echo ""
read -p "Press Enter to continue..."

# Start registry server
echo ""
echo "[1/4] Starting registry server..."
cd apps/registry-server
pnpm build
pnpm start > "$ARTIFACTS_DIR/registry-server.log" 2>&1 &
REGISTRY_PID=$!
cd "$ROOT"

sleep 2

# Start demo app (REAL mode - no mock wallets)
echo ""
echo "[2/4] Starting demo app (REAL mode)..."
cd apps/demo
unset NEXT_PUBLIC_MOCK_WALLETS
pnpm build
pnpm start > "$ARTIFACTS_DIR/demo-app.log" 2>&1 &
DEMO_PID=$!
cd "$ROOT"

sleep 5

echo ""
echo "[3/4] Demo app should be running at http://localhost:3000"
echo "Please:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Connect Console wallet"
echo "3. Connect Loop wallet"
echo "4. Test sign message with Console"
echo "5. Test sign message with Loop"
echo ""
read -p "Press Enter when you've completed the wallet connections..."

# Run E2E tests (they will skip if wallets not installed)
echo ""
echo "[4/4] Running E2E tests..."
cd apps/demo
unset NEXT_PUBLIC_MOCK_WALLETS
pnpm test:e2e --reporter=html --output-dir="$ARTIFACTS_DIR/playwright-report" || true
cd "$ROOT"

# Generate manual evidence report
cat > "$ARTIFACTS_DIR/MANUAL_REAL_WALLETS.md" <<EOF
# Manual Real Wallet Verification Report

**Date:** $(date -Iseconds)
**Git Commit:** $(git rev-parse HEAD)
**Node Version:** $(node --version)
**PNPM Version:** $(pnpm --version)

## Test Results

Please fill in:

- [ ] Console wallet detected as installed
- [ ] Console wallet connect successful
- [ ] Console wallet sign message successful
- [ ] Console wallet session restore works
- [ ] Loop wallet detected as installed
- [ ] Loop wallet connect successful
- [ ] Loop wallet sign message successful
- [ ] Loop wallet shows "reconnect required" (restore limitation)

## Screenshots

Please attach screenshots:
- Console wallet connect flow
- Loop wallet connect flow
- Sign message dialogs
- Error messages (if any)

## Issues Found

(Describe any issues encountered)

## Conclusion

- [ ] All tests passed
- [ ] Some tests failed (see issues above)
- [ ] Not tested (reason: _______________)

EOF

echo ""
echo "=========================================="
echo "Verification complete!"
echo "=========================================="
echo ""
echo "Artifacts saved to: $ARTIFACTS_DIR"
echo ""
echo "Please review: $ARTIFACTS_DIR/MANUAL_REAL_WALLETS.md"
echo ""

# Cleanup
echo "Cleaning up..."
kill $REGISTRY_PID 2>/dev/null || true
kill $DEMO_PID 2>/dev/null || true

echo "Done!"
