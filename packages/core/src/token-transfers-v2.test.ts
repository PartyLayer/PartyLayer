import { expect, it } from 'vitest';
import { availableTokenTransferV2Actions, type TokenTransferV2AvailableActions } from './token-transfers-v2';

it('requires every actor in at least one advertised group, rather than any actor in a joint group', () => {
  const actions: TokenTransferV2AvailableActions = [
    [{ tag: 'TIA_Accept', value: {} }, [['alice', 'custodian'], ['bob']]],
    [{ tag: 'TIA_Withdraw', value: {} }, [['sender']]],
    [{ tag: 'TIA_Custom', value: { id: 'issuer:approve' } }, [['issuer']]],
  ];
  expect(availableTokenTransferV2Actions(actions, ['alice'])).toEqual([]);
  expect(availableTokenTransferV2Actions(actions, ['alice', 'custodian'])).toEqual([actions[0][0]]);
  expect(availableTokenTransferV2Actions(actions, ['bob'])).toEqual([actions[0][0]]);
  expect(availableTokenTransferV2Actions(actions, ['issuer'])).toEqual([actions[2][0]]);
  expect(availableTokenTransferV2Actions(actions, [])).toEqual([]);
  expect(availableTokenTransferV2Actions(actions, [''])).toEqual([]);
});
