/**
 * Backend cost-estimate proxy (CIP-0104 reference).
 *
 * The validator's JSON Ledger API is localhost-only on the node, so a browser
 * dApp cannot reach it directly — this server-side route forwards a single
 * /v2/interactive-submission/prepare call and returns ONLY the costEstimation.
 *
 * prepare INTERPRETS the transaction and returns the estimate; it does NOT commit
 * (no state change, no CC spent). The ledger is auth-disabled, so no token is sent.
 *
 * When LEDGER_API_URL is unset the route returns a REAL captured DevNet estimate
 * (fixture) so the demo never renders blank and CI needs no live node.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Captured from a real prepare against the recovered DevNet validator
 * (Canton 3.5.5). Cost values are int64-as-string (the wire returns JSON numbers;
 * we keep them as strings everywhere to preserve precision past 2^53).
 */
const FIXTURE_ESTIMATION = {
  estimationTimestamp: '2026-06-26T10:44:51.289128Z',
  confirmationRequestTrafficCostEstimation: '2610',
  confirmationResponseTrafficCostEstimation: '0',
  totalTrafficCostEstimation: '2610',
} as const;

/** Default DevNet ValidatorRight template (override via LEDGER_TEMPLATE_ID). */
const DEFAULT_TEMPLATE_ID =
  '90987abecbcb1d004b063ddfe3b4b5d46cf3814ce89114a86c8cd75ff3cb8a4b:Splice.Amulet:ValidatorRight';

export async function POST() {
  const ledgerUrl = process.env.LEDGER_API_URL;

  // ── Fixture mode: no live ledger configured ──────────────────────────────
  if (!ledgerUrl) {
    return NextResponse.json({ costEstimation: FIXTURE_ESTIMATION, source: 'fixture' });
  }

  const party = process.env.LEDGER_PARTY;
  const synchronizerId = process.env.LEDGER_SYNCHRONIZER_ID;
  const dso = process.env.LEDGER_DSO_PARTY;
  if (!party || !synchronizerId || !dso) {
    return NextResponse.json(
      {
        error:
          'LEDGER_API_URL is set, but LEDGER_PARTY, LEDGER_SYNCHRONIZER_ID, and LEDGER_DSO_PARTY are required.',
      },
      { status: 500 },
    );
  }

  // CreateCommand of Splice.Amulet:ValidatorRight — the validator party is the
  // sole signatory, so it prepares with no holdings/scan context. PREPARE only.
  const prepareRequest = {
    commandId: `cost-demo-${Date.now()}`,
    userId: process.env.LEDGER_USER_ID || 'administrator',
    actAs: [party],
    commands: [
      {
        CreateCommand: {
          templateId: process.env.LEDGER_TEMPLATE_ID || DEFAULT_TEMPLATE_ID,
          createArguments: { dso, user: party, validator: party },
        },
      },
    ],
    // Three fields the OpenAPI marks optional but the decoder requires:
    synchronizerId,
    packageIdSelectionPreference: [],
    estimateTrafficCost: { disabled: false, expectedSignatures: [] },
  };

  let res: Response;
  try {
    res = await fetch(`${ledgerUrl.replace(/\/+$/, '')}/v2/interactive-submission/prepare`, {
      method: 'POST',
      // No Authorization header — the ledger is auth-disabled.
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prepareRequest),
      cache: 'no-store',
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Validator unreachable: ${e instanceof Error ? e.message : 'network error'}` },
      { status: 502 },
    );
  }

  const raw = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { error: `Prepare failed (HTTP ${res.status}).`, detail: raw.slice(0, 400) },
      { status: 502 },
    );
  }

  // Precision-safe: pull the int64 cost fields from the RAW text so values past
  // Number.MAX_SAFE_INTEGER never round-trip through a JS number. costEstimation
  // is optional on the prepare response (null when estimation is disabled/absent).
  const costEstimation = extractCostEstimation(raw);
  return NextResponse.json({ costEstimation, source: 'live' });
}

function extractCostEstimation(raw: string):
  | {
      estimationTimestamp: string;
      confirmationRequestTrafficCostEstimation: string;
      confirmationResponseTrafficCostEstimation: string;
      totalTrafficCostEstimation: string;
    }
  | null {
  // costEstimation is a flat object (timestamp + three integers) — no nested braces.
  const block = raw.match(/"costEstimation"\s*:\s*\{([^}]*)\}/);
  if (!block) return null;
  const body = block[1];
  const int = (name: string) =>
    body.match(new RegExp(`"${name}"\\s*:\\s*(-?\\d+)`))?.[1] ?? null;
  const str = (name: string) =>
    body.match(new RegExp(`"${name}"\\s*:\\s*"([^"]*)"`))?.[1] ?? null;

  const estimationTimestamp = str('estimationTimestamp');
  const confirmationRequestTrafficCostEstimation = int('confirmationRequestTrafficCostEstimation');
  const confirmationResponseTrafficCostEstimation = int('confirmationResponseTrafficCostEstimation');
  const totalTrafficCostEstimation = int('totalTrafficCostEstimation');

  if (
    estimationTimestamp == null ||
    confirmationRequestTrafficCostEstimation == null ||
    confirmationResponseTrafficCostEstimation == null ||
    totalTrafficCostEstimation == null
  ) {
    return null;
  }
  return {
    estimationTimestamp,
    confirmationRequestTrafficCostEstimation,
    confirmationResponseTrafficCostEstimation,
    totalTrafficCostEstimation,
  };
}
