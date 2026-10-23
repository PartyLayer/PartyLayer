// @vitest-environment jsdom
import React, { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

const clients = vi.hoisted(() => ({ created: [] as Array<{ destroy: ReturnType<typeof vi.fn> }> }));
vi.mock('@partylayer/sdk', () => ({ createPartyLayer: () => {
  const client = { destroy: vi.fn() };
  clients.created.push(client);
  return client;
} }));
vi.mock('./context', () => ({ PartyLayerProvider: ({ children }: { children: React.ReactNode }) => children }));
import { PartyLayerKit } from './kit';

afterEach(() => { cleanup(); clients.created.length = 0; });

it('keeps the committed client alive across StrictMode effect replay and destroys it on real unmount', async () => {
  const view = render(<StrictMode><PartyLayerKit network="devnet" appName="Strict app">Ready</PartyLayerKit></StrictMode>);
  const committed = clients.created[clients.created.length - 1];
  await Promise.resolve();
  expect(committed.destroy).not.toHaveBeenCalled();
  view.unmount();
  await waitFor(() => expect(committed.destroy).toHaveBeenCalledTimes(1));
});

it('destroys the previous client when network changes and preserves the replacement', async () => {
  const view = render(<PartyLayerKit network="devnet" appName="Network app">Ready</PartyLayerKit>);
  const first = clients.created[clients.created.length - 1];
  view.rerender(<PartyLayerKit network="mainnet" appName="Network app">Ready</PartyLayerKit>);
  const replacement = clients.created[clients.created.length - 1];
  await waitFor(() => expect(first.destroy).toHaveBeenCalledTimes(1));
  expect(replacement.destroy).not.toHaveBeenCalled();
  view.unmount();
  await waitFor(() => expect(replacement.destroy).toHaveBeenCalledTimes(1));
});
