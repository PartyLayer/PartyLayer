import { afterEach, expect, it, vi } from 'vitest';
import { BronAuthClient } from './auth';
import { authorizeBronPopup, completeBronAuthorization } from './authorization';

const config = { authorizationUrl: 'https://auth.example/authorize?audience=canton', tokenUrl: 'https://auth.example/token',
  clientId: 'public-client', redirectUri: 'https://app.example/callback' };
const token = { access_token: 'fixture-access-token', expires_in: 3600, token_type: 'Bearer' };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('defaults to S256 PKCE with a valid verifier and consumes callback state exactly once', async () => {
  const fetcher = vi.fn(async () => Response.json(token)); vi.stubGlobal('fetch', fetcher);
  const auth = new BronAuthClient(config);
  const url = new URL(await auth.startAuth());
  expect(url.searchParams.get('audience')).toBe('canton');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  const callback = `${config.redirectUri}?code=authorization-code&state=${url.searchParams.get('state')}`;
  await auth.finishAuth(callback);
  expect(fetcher).toHaveBeenCalledOnce();
  const init = (fetcher.mock.calls as unknown as [string, RequestInit][])[0][1];
  const verifier = new URLSearchParams(init.body as string).get('code_verifier')!;
  expect(verifier).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  expect(Buffer.from(digest).toString('base64url')).toBe(url.searchParams.get('code_challenge'));
  expect(init).toMatchObject({ redirect: 'error', credentials: 'omit', cache: 'no-store' });
  await expect(auth.finishAuth(callback)).rejects.toThrow(/state/);
  expect(fetcher).toHaveBeenCalledOnce();
});

it.each(['missing-state', 'wrong-state', 'wrong-origin', 'wrong-path', 'duplicate-code'])('rejects %s before contacting the token endpoint', async kind => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const auth = new BronAuthClient(config); const state = new URL(await auth.startAuth()).searchParams.get('state');
  const url = new URL(`${config.redirectUri}?code=fixture&state=${state}`);
  if (kind === 'missing-state') url.searchParams.delete('state');
  if (kind === 'wrong-state') url.searchParams.set('state', 'forged');
  if (kind === 'wrong-origin') url.hostname = 'untrusted.example';
  if (kind === 'wrong-path') url.pathname = '/another-callback';
  if (kind === 'duplicate-code') url.searchParams.append('code', 'another');
  await expect(auth.finishAuth(url.href)).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
});

it.each([{ access_token: '' }, { expires_in: 0 }, { token_type: 'Unknown' }, { access_token: 'unsafe\nheader' }])('rejects malformed token response %j', async malformed => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...token, ...malformed })));
  const auth = new BronAuthClient(config); const state = new URL(await auth.startAuth()).searchParams.get('state');
  await expect(auth.finishAuth(`${config.redirectUri}?code=fixture&state=${state}`)).rejects.toThrow(/Invalid OAuth token/);
  expect(await auth.getAccessToken()).toBeNull();
});

it('never stores a token whose exchange completes after logout', async () => {
  let respond!: (value: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { respond = resolve; })); vi.stubGlobal('fetch', fetcher);
  const auth = new BronAuthClient(config); const state = new URL(await auth.startAuth()).searchParams.get('state');
  const result = auth.finishAuth(`${config.redirectUri}?code=fixture&state=${state}`);
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  await auth.logout(); respond(Response.json(token));
  await expect(result).rejects.toThrow(/cancelled/); expect(await auth.getAccessToken()).toBeNull();
});

it('does not restore a cached credential from a read that finishes after logout', async () => {
  let respond!: (value: string) => void;
  const storage = { get: vi.fn(() => new Promise<string>(resolve => { respond = resolve; })),
    set: vi.fn(async () => {}), remove: vi.fn(async () => {}), clear: vi.fn(async () => {}) };
  const auth = new BronAuthClient(config, storage);
  const reading = auth.getAccessToken(); await auth.logout();
  respond(JSON.stringify({ accessToken: 'cached-fixture', tokenType: 'Bearer', expiresAt: Date.now() + 60_000 }));
  expect(await reading).toBeNull(); expect(storage.remove).toHaveBeenCalledOnce();
});

it('orders logout removal after an already-started storage write', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(token)));
  let release!: () => void; let cached: string | null = null;
  const storage = { get: vi.fn(async () => cached), set: vi.fn(async (_key: string, value: string) => {
    await new Promise<void>(resolve => { release = resolve; }); cached = value;
  }), remove: vi.fn(async () => { cached = null; }), clear: vi.fn(async () => {}) };
  const auth = new BronAuthClient(config, storage); const state = new URL(await auth.startAuth()).searchParams.get('state');
  const finishing = auth.finishAuth(`${config.redirectUri}?code=fixture&state=${state}`);
  await vi.waitFor(() => expect(storage.set).toHaveBeenCalledOnce());
  const loggingOut = auth.logout(); const cancelled = expect(finishing).rejects.toThrow(/cancelled/);
  release(); await cancelled; await loggingOut;
  expect(cached).toBeNull(); expect(await auth.getAccessToken()).toBeNull();
});

function browser() {
  let receive: ((event: MessageEvent) => void) | undefined;
  const popup = { closed: false, close: vi.fn() };
  const window = { location: { origin: 'https://app.example', pathname: '/callback', href: 'https://app.example/callback?code=fixture&state=state' },
    open: vi.fn(() => popup), addEventListener: vi.fn((_type, listener) => { receive = listener; }),
    removeEventListener: vi.fn(), opener: { postMessage: vi.fn() }, history: { replaceState: vi.fn() }, close: vi.fn() };
  vi.stubGlobal('window', window);
  return { window, popup, get receive() { return receive; } };
}

it('requires browser PKCE, refuses browser client secrets and unsafe OAuth endpoints', () => {
  browser();
  expect(() => new BronAuthClient({ ...config, clientSecret: 'fixture-secret' })).toThrow(/client secret/);
  expect(() => new BronAuthClient({ ...config, usePKCE: false })).toThrow(/PKCE/);
  expect(() => new BronAuthClient({ ...config, tokenUrl: 'http://untrusted.example/token' })).toThrow(/HTTPS/);
});

it('accepts only the opened popup and registered callback origin, cleans up, and finishes authorization', async () => {
  const ui = browser(); const auth = new BronAuthClient(config);
  const fetcher = vi.fn(async () => Response.json(token)); vi.stubGlobal('fetch', fetcher);
  const result = authorizeBronPopup(auth, config.redirectUri, 5000);
  await vi.waitFor(() => expect(ui.window.open).toHaveBeenCalledOnce());
  const url = new URL((ui.window.open.mock.calls as unknown as [string][])[0][0]);
  const data = { type: 'partylayer:bron:authorization-callback', callbackUrl: `${config.redirectUri}?code=fixture&state=${url.searchParams.get('state')}` };
  ui.receive!({ origin: 'https://untrusted.example', source: ui.popup, data } as unknown as MessageEvent);
  ui.receive!({ origin: 'https://app.example', source: {}, data } as MessageEvent);
  expect(fetcher).not.toHaveBeenCalled();
  ui.receive!({ origin: 'https://app.example', source: ui.popup, data } as unknown as MessageEvent);
  await result;
  expect(await auth.getAccessToken()).toBe('fixture-access-token');
  expect(ui.window.removeEventListener).toHaveBeenCalled(); expect(ui.popup.close).toHaveBeenCalledOnce();
});

it('cancels a waiting popup without leaving reusable authorization state', async () => {
  const ui = browser(); const auth = new BronAuthClient(config);
  const result = authorizeBronPopup(auth, config.redirectUri, 5000);
  await vi.waitFor(() => expect(ui.window.open).toHaveBeenCalledOnce());
  auth.cancelAuthorization(); await expect(result).rejects.toThrow(/cancelled/);
  expect(ui.popup.close).toHaveBeenCalledOnce(); expect(ui.window.removeEventListener).toHaveBeenCalled();
});

it('relays the callback only to its own origin and removes codes from the redirect page URL', () => {
  const ui = browser(); completeBronAuthorization(config.redirectUri);
  expect(ui.window.opener.postMessage).toHaveBeenCalledWith(expect.objectContaining({ callbackUrl: ui.window.location.href }), 'https://app.example');
  expect(ui.window.history.replaceState).toHaveBeenCalledWith(null, '', '/callback'); expect(ui.window.close).toHaveBeenCalledOnce();
});
