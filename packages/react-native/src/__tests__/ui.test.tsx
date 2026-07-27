/**
 * UI component tests (phase B2). React Native is mocked (no device runtime), the hooks
 * are mocked so each connect state is controllable, and react-native-svg is injected
 * through the loader's test seam. Tests cover component logic, not pixels.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createElement, Fragment } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';

// Mock React Native primitives as findable host elements.
vi.mock('react-native', () => {
  const h = createElement as unknown as (type: string, props?: Record<string, unknown> | null, ...children: unknown[]) => React.ReactElement;
  const pass = (name: string) => (props: Record<string, unknown>) =>
    h(name, props, typeof props.children === 'function' ? (props.children as (s: { pressed: boolean }) => unknown)({ pressed: false }) : (props.children as unknown));
  return {
    View: pass('View'),
    Text: pass('Text'),
    Image: (props: Record<string, unknown>) => h('Image', props),
    ActivityIndicator: (props: Record<string, unknown>) => h('ActivityIndicator', props),
    Pressable: pass('Pressable'),
    Modal: (props: Record<string, unknown>) => (props.visible ? h('Modal', props, props.children as unknown) : null),
    FlatList: (props: { data?: unknown[]; renderItem: (info: { item: unknown; index: number }) => unknown; keyExtractor?: (item: unknown, i: number) => string }) =>
      h(
        'FlatList',
        props,
        ...(props.data ?? []).map((item, index) =>
          createElement(Fragment, { key: props.keyExtractor ? props.keyExtractor(item, index) : index }, props.renderItem({ item, index }) as never),
        ),
      ),
    StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
  };
});

/** Loose createElement for building mock host elements in this test. */
const hostEl = createElement as unknown as (type: string, props?: Record<string, unknown> | null) => React.ReactElement;

// Mock react-native-svg so svg-loader's module-top static import resolves, AND so the
// real import path (not just the test seam) is exercised: the regression test below
// reads from this mock, so a reversion to a bundler-invisible require would fail here.
// vi.hoisted makes the mock available to both the (hoisted) factory and the test body.
const mockRnSvg = vi.hoisted(() => ({
  default: () => null,
  Path: () => null,
  Rect: () => null,
  SvgUri: () => null,
  SvgXml: () => null,
}));
vi.mock('react-native-svg', () => mockRnSvg);
vi.mock('../use-connect', () => ({ useConnect: vi.fn() }));
vi.mock('../use-wallets', () => ({ useWallets: vi.fn() }));

import { useConnect } from '../use-connect';
import { useWallets } from '../use-wallets';
import { __setSvgComponentsForTest, getSvgComponents } from '../ui/svg-loader';
import { WalletIcon } from '../ui/wallet-icon';
import { ConnectButton } from '../ui/connect-button';
import { WalletList } from '../ui/wallet-list';
import { toReactNativeTheme, themes } from '../theme';

const theme = toReactNativeTheme(themes.default.dark);
const mockUseConnect = useConnect as unknown as Mock;
const mockUseWallets = useWallets as unknown as Mock;

const MockSvgUri = (props: Record<string, unknown>) => hostEl('SvgUri', props);
const MockSvgXml = (props: Record<string, unknown>) => hostEl('SvgXml', props);

const VALID_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" /></svg>';
const HTML_BODY = '<!doctype html><html><head><title>PartyLayer</title></head><body>registry</body></html>';

/** Queue the next fetch response body (WalletIcon fetches an svg url to validate it). */
function mockFetchOnce(body: string, ok = true): void {
  (global.fetch as unknown as Mock).mockResolvedValueOnce({ ok, text: async () => body });
}

/** Flush the WalletIcon fetch and its effect so the svg or fallback has resolved. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: any svg fetch returns valid SVG. Tests that need HTML/failure override it.
  global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => VALID_SVG }) as never;
  __setSvgComponentsForTest({
    Svg: (p: Record<string, unknown>) => hostEl('Svg', p),
    Path: (p: Record<string, unknown>) => hostEl('Path', p),
    Rect: (p: Record<string, unknown>) => hostEl('Rect', p),
    SvgUri: MockSvgUri,
    SvgXml: MockSvgXml,
  } as never);
  mockUseConnect.mockReturnValue({ session: null, status: 'idle', connect: vi.fn(), disconnect: vi.fn(), isConnecting: false, isConnected: false, error: null });
  mockUseWallets.mockReturnValue({ wallets: [], walletIcons: [], isLoading: false, isSuccess: true, isError: false, error: null, refetch: vi.fn() });
});

function render(el: React.ReactElement): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(el);
  });
  return r;
}

const has = (r: ReactTestRenderer, testID: string) => r.root.findAll((n) => n.props.testID === testID).length > 0;

describe('svg-loader real import path (regression guard)', () => {
  it('resolves react-native-svg from the static import, not only the test seam', () => {
    // Clear the seam so getSvgComponents must read the module-top static import. It
    // returns the mocked react-native-svg, proving the import path is bundler-visible.
    __setSvgComponentsForTest(null);
    const svg = getSvgComponents();
    expect(svg.SvgUri).toBe(mockRnSvg.SvgUri);
    expect(svg.SvgXml).toBe(mockRnSvg.SvgXml);
    expect(svg.Svg).toBe(mockRnSvg.default);
  });
});

describe('WalletIcon renderer matrix', () => {
  it('renders Image for png and jpg', () => {
    for (const format of ['png', 'jpg'] as const) {
      const r = render(<WalletIcon url={`https://x/i.${format}`} format={format} size={36} theme={theme} testID="ic" />);
      expect(r.root.findAllByType('Image' as never).length, format).toBe(1);
      expect(has(r, 'ic-fallback')).toBe(false);
    }
  });

  it('renders the svg after validating the fetched body is real SVG', async () => {
    mockFetchOnce(VALID_SVG);
    const r = render(<WalletIcon url="https://x/i.svg" format="svg" size={36} theme={theme} testID="ic" />);
    await flush();
    expect(r.root.findAllByType(MockSvgXml as never).length).toBe(1);
    expect(has(r, 'ic-fallback')).toBe(false);
  });

  it('falls back to the neutral glyph when the svg url returns non SVG (HTML), never nothing', async () => {
    // The walletconnect case: the CDN returns an HTML landing page, not an SVG. SvgUri
    // would render nothing with no onError; validating the body first makes it fall back.
    mockFetchOnce(HTML_BODY);
    const r = render(<WalletIcon url="https://x/walletconnect.svg" format="svg" size={36} theme={theme} testID="ic" />);
    await flush();
    expect(has(r, 'ic-fallback')).toBe(true);
    expect(r.root.findAllByType(MockSvgXml as never).length).toBe(0);
  });

  it('falls back when the svg fetch fails outright', async () => {
    (global.fetch as unknown as Mock).mockRejectedValueOnce(new Error('network'));
    const r = render(<WalletIcon url="https://x/down.svg" format="svg" size={36} theme={theme} testID="ic" />);
    await flush();
    expect(has(r, 'ic-fallback')).toBe(true);
  });

  it('renders the neutral fallback for unknown (never a letter)', () => {
    const r = render(<WalletIcon url="https://x/i.weird" format="unknown" size={36} theme={theme} testID="ic" />);
    expect(has(r, 'ic-fallback')).toBe(true);
    expect(r.root.findAllByType('Image' as never).length).toBe(0);
  });

  it('falls back on a png load error', () => {
    const r = render(<WalletIcon url="https://x/i.png" format="png" size={36} theme={theme} testID="ic" />);
    const img = r.root.findByType('Image' as never);
    act(() => (img.props.onError as () => void)());
    expect(has(r, 'ic-fallback')).toBe(true);
  });
});

describe('ConnectButton reflects connect state', () => {
  it('shows the label when disconnected', () => {
    const r = render(<ConnectButton client={{} as never} theme={theme} label="Connect Wallet" />);
    const texts = r.root.findAllByType('Text' as never).map((n) => n.props.children);
    expect(texts).toContain('Connect Wallet');
  });

  it('shows a spinner when connecting', () => {
    mockUseConnect.mockReturnValue({ session: null, status: 'connecting', connect: vi.fn(), disconnect: vi.fn(), isConnecting: true, isConnected: false, error: null });
    const r = render(<ConnectButton client={{} as never} theme={theme} />);
    expect(has(r, 'spinner')).toBe(true);
  });

  it('shows the party identity and wallet icon when connected', async () => {
    mockUseConnect.mockReturnValue({ session: { walletId: 'console', partyId: 'party::abcdefghijklmnop' }, status: 'connected', connect: vi.fn(), disconnect: vi.fn(), isConnecting: false, isConnected: true, error: null });
    mockUseWallets.mockReturnValue({ wallets: [], walletIcons: [{ walletId: 'console', url: 'https://x/console.svg', format: 'svg' }], isLoading: false, isSuccess: true, isError: false, error: null, refetch: vi.fn() });
    const r = render(<ConnectButton client={{} as never} theme={theme} />);
    await flush();
    // The connected wallet's svg logo renders (not a letter), and the party id is shown truncated.
    expect(r.root.findAllByType(MockSvgXml as never).length).toBe(1);
    const texts = r.root.findAllByType('Text' as never).map((n) => String(n.props.children));
    expect(texts.some((t) => t.includes('...'))).toBe(true);
  });

  it('uses the theme pressed color, not a hardcoded value', () => {
    const r = render(<ConnectButton client={{} as never} theme={theme} />);
    const btn = r.root.find((n) => n.props.testID === 'connect-button');
    const style = (btn.props.style as (s: { pressed: boolean }) => Record<string, unknown>);
    expect(style({ pressed: false }).backgroundColor).toBe(theme.colors.primary);
    expect(style({ pressed: true }).backgroundColor).toBe(theme.colors.pressed);
  });
});

describe('WalletList', () => {
  const wallets = [
    { walletId: 'console', name: 'Console', website: 'https://c', icons: { md: 'https://x/console.svg' } },
    { walletId: 'walley', name: 'Walley', website: 'https://w', icons: { md: 'https://x/walley-logo.png' } },
  ];

  it('renders a row per wallet with its real logo', async () => {
    mockUseWallets.mockReturnValue({ wallets, walletIcons: [], isLoading: false, isSuccess: true, isError: false, error: null, refetch: vi.fn() });
    const r = render(<WalletList client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    await flush();
    expect(has(r, 'wallet-row-console')).toBe(true);
    expect(has(r, 'wallet-row-walley')).toBe(true);
    // console has an svg logo, walley a png: both render as real logos, no letters.
    expect(r.root.findAllByType(MockSvgXml as never).length).toBe(1);
    expect(r.root.findAllByType('Image' as never).length).toBe(1);
  });

  it('tapping a wallet starts connect with the right wallet id', () => {
    const connect = vi.fn().mockResolvedValue({});
    mockUseConnect.mockReturnValue({ session: null, status: 'idle', connect, disconnect: vi.fn(), isConnecting: false, isConnected: false, error: null });
    mockUseWallets.mockReturnValue({ wallets, walletIcons: [], isLoading: false, isSuccess: true, isError: false, error: null, refetch: vi.fn() });
    const r = render(<WalletList client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    act(() => (r.root.find((n) => n.props.testID === 'wallet-row-walley').props.onPress as () => void)());
    expect(connect).toHaveBeenCalledWith({ walletId: 'walley' });
  });

  it('renders the error state and retry calls connect again', async () => {
    const connect = vi.fn().mockRejectedValueOnce(new Error('user rejected')).mockResolvedValue({});
    mockUseConnect.mockReturnValue({ session: null, status: 'idle', connect, disconnect: vi.fn(), isConnecting: false, isConnected: false, error: null });
    mockUseWallets.mockReturnValue({ wallets, walletIcons: [], isLoading: false, isSuccess: true, isError: false, error: null, refetch: vi.fn() });
    const r = render(<WalletList client={{} as never} theme={theme} visible onClose={vi.fn()} />);

    await act(async () => {
      (r.root.find((n) => n.props.testID === 'wallet-row-console').props.onPress as () => void)();
    });
    expect(has(r, 'state-error')).toBe(true);
    const texts = r.root.findAllByType('Text' as never).map((n) => String(n.props.children));
    expect(texts).toContain('user rejected');

    await act(async () => {
      (r.root.find((n) => n.props.testID === 'retry').props.onPress as () => void)();
    });
    expect(connect).toHaveBeenCalledTimes(2);
    expect(connect).toHaveBeenLastCalledWith({ walletId: 'console' });
  });

  it('applies the theme background to the panel (not hardcoded)', () => {
    mockUseWallets.mockReturnValue({ wallets, walletIcons: [], isLoading: false, isSuccess: true, isError: false, error: null, refetch: vi.fn() });
    const r = render(<WalletList client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    const overlay = r.root.findAll((n) => (n.type as unknown as string) === 'View' && (n.props.style as { backgroundColor?: string })?.backgroundColor === theme.overlay);
    expect(overlay.length).toBeGreaterThan(0);
  });
});
