/**
 * A narrow, typed client over the JSON Ledger API v2.
 *
 * It exposes exactly three operations the gateway needs against the participant: read
 * the ledger end, read active contracts filtered to one token-standard interface, and
 * submit a prepared command and wait for its update. Nothing else.
 *
 * There is deliberately NO generic "forward a ledger request" method. On this DevNet
 * participant the ledger API is unauthenticated, which means every request runs with
 * participant-admin authority; a passthrough would hand that authority to any browser
 * that can reach the gateway. Every method here is specific and the reads take a fixed
 * interface reference, so the only ledger surface the gateway can touch is these calls.
 */
import type { AcsEntry } from '../mapping.js';
import type { CostEstimationWire } from '../contract.js';

/** A ledger-API command wrapper, e.g. `{ ExerciseCommand: {...} }`, as the sdk emits. */
export type WrappedCommand = Record<string, unknown>;
/** A disclosed contract as the sdk / registry emits it for submission. */
export type DisclosedContract = Record<string, unknown>;

export interface SubmitResult {
  updateId: string;
}

/** A contract created by a submission: its template id and contract id. */
export interface CreatedContract {
  templateId: string;
  contractId: string;
}

export interface SubmitTreeResult {
  updateId: string;
  created: CreatedContract[];
}

export class LedgerClient {
  private readonly base: string;

  constructor(
    baseUrl: string,
    private readonly userId: string,
    private readonly token: string,
    /** The synchronizer a prepare-for-cost call targets. Absent disables cost estimation. */
    private readonly synchronizerId?: string,
  ) {
    this.base = baseUrl.replace(/\/$/, '');
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    // Auth is disabled on this participant; the token, when present, only carries the
    // user id. It is read from env and never logged.
    if (this.token) h.authorization = 'Bearer ' + this.token;
    return h;
  }

  /** The current ledger end offset, used as the active-contracts snapshot point. */
  async ledgerEnd(): Promise<number> {
    const res = await fetch(this.base + '/v2/state/ledger-end', { headers: this.headers() });
    if (!res.ok) throw new Error('ledger-end -> HTTP ' + res.status);
    const body = (await res.json()) as { offset: number };
    return body.offset;
  }

  /**
   * Active contracts visible to any of `parties`, filtered to a single token-standard
   * interface and returning that interface's view. Contracts seen by more than one of
   * the parties are returned once.
   */
  async activeByInterface(parties: string[], interfaceId: string): Promise<AcsEntry[]> {
    const activeAtOffset = await this.ledgerEnd();
    const filtersByParty: Record<string, unknown> = {};
    for (const p of parties) {
      filtersByParty[p] = {
        cumulative: [
          { identifierFilter: { InterfaceFilter: { value: { interfaceId, includeInterfaceView: true } } } },
        ],
      };
    }
    const res = await fetch(this.base + '/v2/state/active-contracts', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ activeAtOffset, eventFormat: { filtersByParty, verbose: false } }),
    });
    if (!res.ok) {
      throw new Error(
        'active-contracts ' + interfaceId + ' -> HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200),
      );
    }
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const seen = new Set<string>();
    const out: AcsEntry[] = [];
    for (const row of rows) {
      const entry = (row.contractEntry as Record<string, unknown> | undefined)?.JsActiveContract as
        | Record<string, unknown>
        | undefined;
      const created = entry?.createdEvent as
        | { contractId?: string; interfaceViews?: Array<{ viewValue?: Record<string, unknown> }> }
        | undefined;
      if (!created?.contractId) continue;
      const view = (created.interfaceViews ?? []).find((iv) => iv?.viewValue)?.viewValue;
      if (!view) continue;
      if (seen.has(created.contractId)) continue;
      seen.add(created.contractId);
      out.push({ contractId: created.contractId, view });
    }
    return out;
  }

  /**
   * Submit prepared commands as a local party and wait for the update. The demo parties
   * live in this participant's namespace, so the participant signs; there is no external
   * key and no prepare/execute round trip.
   */
  async submitAndWait(
    commands: readonly unknown[],
    disclosedContracts: readonly unknown[],
    actAs: string[],
    commandId: string,
  ): Promise<SubmitResult> {
    const res = await fetch(this.base + '/v2/commands/submit-and-wait', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        commands,
        commandId,
        actAs,
        readAs: [],
        userId: this.userId,
        disclosedContracts,
      }),
    });
    if (!res.ok) {
      throw new Error('submit-and-wait -> HTTP ' + res.status + ' ' + (await res.text()).slice(0, 300));
    }
    const body = (await res.json()) as { updateId: string };
    return { updateId: body.updateId };
  }

  /**
   * Submit prepared commands as a local party, wait, and return the update id together
   * with the contracts the transaction created. The multi-step DvP orchestration needs
   * each created contract id to drive the next step; this is a distinct named operation
   * so the plain submit-and-wait stays a plain submit-and-wait (no passthrough is added).
   */
  async submitAndWaitForTransactionTree(
    commands: readonly unknown[],
    disclosedContracts: readonly unknown[],
    actAs: string[],
    commandId: string,
  ): Promise<SubmitTreeResult> {
    const res = await fetch(this.base + '/v2/commands/submit-and-wait-for-transaction-tree', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        commands,
        commandId,
        actAs,
        readAs: [],
        userId: this.userId,
        disclosedContracts,
      }),
    });
    if (!res.ok) {
      throw new Error(
        'submit-and-wait-for-transaction-tree -> HTTP ' + res.status + ' ' + (await res.text()).slice(0, 300),
      );
    }
    const body = (await res.json()) as {
      transactionTree: { updateId: string; eventsById: Record<string, { CreatedTreeEvent?: { value?: CreatedContract } }> };
    };
    const tree = body.transactionTree;
    const created: CreatedContract[] = [];
    for (const ev of Object.values(tree.eventsById)) {
      const v = ev.CreatedTreeEvent?.value;
      if (v?.contractId && v?.templateId) created.push({ templateId: v.templateId, contractId: v.contractId });
    }
    return { updateId: tree.updateId, created };
  }

  /**
   * Prepare (interpret) commands and return ONLY the pre-submission cost estimate.
   * prepare interprets the transaction and reports its cost; it does NOT commit, so no
   * state changes and no traffic is spent. Cost estimation needs a synchronizer id, so
   * this returns null when none is configured. Any non-OK response or parse failure also
   * returns null and never throws, so the caller degrades to an illustrative estimate.
   *
   * The three int64 cost fields are read from the RAW response text, so values past
   * Number.MAX_SAFE_INTEGER never round-trip through a JS number.
   */
  async prepareForCost(
    commands: readonly unknown[],
    disclosedContracts: readonly unknown[],
    actAs: string[],
    commandId: string,
  ): Promise<CostEstimationWire | null> {
    if (!this.synchronizerId) return null;
    let res: Response;
    try {
      res = await fetch(this.base + '/v2/interactive-submission/prepare', {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          commandId,
          userId: this.userId,
          actAs,
          readAs: [],
          commands,
          disclosedContracts,
          synchronizerId: this.synchronizerId,
          // Three fields the OpenAPI marks optional but the decoder requires.
          packageIdSelectionPreference: [],
          estimateTrafficCost: { disabled: false, expectedSignatures: [] },
        }),
      });
    } catch {
      return null;
    }
    if (!res.ok) return null;
    const raw = await res.text();
    return extractCostEstimation(raw);
  }
}

/**
 * Pull the pre-submission cost estimate from a raw prepare response. Precision-safe: the
 * int64 cost fields are read from the RAW text so values past Number.MAX_SAFE_INTEGER
 * never round-trip through a JS number. costEstimation is optional on the response (null
 * when estimation is disabled or absent), which is a successful result, not an error.
 */
function extractCostEstimation(raw: string): CostEstimationWire | null {
  // costEstimation is a flat object (timestamp plus three integers), no nested braces.
  const block = raw.match(/"costEstimation"\s*:\s*\{([^}]*)\}/);
  if (!block) return null;
  const body = block[1];
  const int = (name: string) => body.match(new RegExp('"' + name + '"\\s*:\\s*(-?\\d+)'))?.[1] ?? null;
  const str = (name: string) => body.match(new RegExp('"' + name + '"\\s*:\\s*"([^"]*)"'))?.[1] ?? null;

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

/** Build a CreateCommand wrapper for the JSON Ledger API. */
export function createCommand(templateId: string, createArguments: Record<string, unknown>): WrappedCommand {
  return { CreateCommand: { templateId, createArguments } };
}

/** Build an ExerciseCommand wrapper for the JSON Ledger API. */
export function exerciseCommand(
  templateId: string,
  contractId: string,
  choice: string,
  choiceArgument: Record<string, unknown>,
): WrappedCommand {
  return { ExerciseCommand: { templateId, contractId, choice, choiceArgument } };
}
