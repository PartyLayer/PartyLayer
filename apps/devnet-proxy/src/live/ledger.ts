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

/** A ledger-API command wrapper, e.g. `{ ExerciseCommand: {...} }`, as the sdk emits. */
export type WrappedCommand = Record<string, unknown>;
/** A disclosed contract as the sdk / registry emits it for submission. */
export type DisclosedContract = Record<string, unknown>;

export interface SubmitResult {
  updateId: string;
}

export class LedgerClient {
  private readonly base: string;

  constructor(
    baseUrl: string,
    private readonly userId: string,
    private readonly token: string,
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
