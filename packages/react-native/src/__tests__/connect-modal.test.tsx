/**
 * ConnectModal: the behaviours added on top of the flow WalletList already had.
 *
 * Reduced motion, the safe area inset, the screen reader affordances, the neutral
 * connecting copy, and rendering with no props at all under the two providers.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createElement, Fragment } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';

const reduceMotion = vi.hoisted(() => ({
  enabled: false,
  handler: null as null | ((enabled: boolean) => void),
}));

vi.mock('react-native', () => {
  const h = createElement as unknown as (
    type: string,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ) => React.ReactElement;
  const pass = (name: string) => (props: Record<string, unknown>) =>
    h(
      name,
      props,
      typeof props.children === 'function'
        ? (props.children as (s: { pressed: boolean }) => unknown)({ pressed: false })
        : (props.children as unknown),
    );
  return {
    View: pass('View'),
    Text: pass('Text'),
    Image: (props: Record<string, unknown>) => h('Image', props),
    ActivityIndicator: (props: Record<string, unknown>) => h('ActivityIndicator', props),
    Pressable: pass('Pressable'),
    Modal: (props: Record<string, unknown>) => (props.visible ? h('Modal', props, props.children as unknown) : null),
    FlatList: (props: {
      data?: unknown[];
      renderItem: (info: { item: unknown; index: number }) => unknown;
      keyExtractor?: (item: unknown, i: number) => string;
    }) =>
      h(
        'FlatList',
        props,
        ...(props.data ?? []).map((item, index) =>
          createElement(
            Fragment,
            { key: props.keyExtractor ? props.keyExtractor(item, index) : index },
            props.renderItem({ item, index }) as never,
          ),
        ),
      ),
    StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
    KeyboardAvoidingView: pass('KeyboardAvoidingView'),
    Platform: { OS: 'ios', select: (spec: Record<string, unknown>) => spec.ios ?? spec.default },
    StatusBar: { currentHeight: 0 },
    AccessibilityInfo: {
      isReduceMotionEnabled: () => Promise.resolve(reduceMotion.enabled),
      addEventListener: (_type: string, handler: (enabled: boolean) => void) => {
        reduceMotion.handler = handler;
        return { remove: () => { reduceMotion.handler = null; } };
      },
    },
    useColorScheme: () => 'light',
  };
});

vi.mock('react-native-svg', () => ({
  default: () => null,
  Path: () => null,
  Rect: () => null,
  Circle: () => null,
  SvgUri: () => null,
  SvgXml: () => null,
}));
vi.mock('../use-connect', () => ({ useConnect: vi.fn() }));
vi.mock('../use-wallets', () => ({ useWallets: vi.fn() }));

import { useConnect } from '../use-connect';
import { useWallets } from '../use-wallets';
import { ConnectModal } from '../ui/connect-modal';
import { PartyLayerProvider } from '../context';
import { ThemeProvider } from '../theme-context';
import { makeClient } from './doubles';
import { toReactNativeTheme, themes } from '../theme';

const theme = toReactNativeTheme(themes.default.dark);
const mockUseConnect = useConnect as unknown as Mock;
const mockUseWallets = useWallets as unknown as Mock;

const wallets = [
  { walletId: 'console', name: 'Console', icons: { md: 'https://x/console.png' } },
] as never[];

function listLoaded() {
  mockUseWallets.mockReturnValue({
    wallets,
    walletIcons: [],
    isLoading: false,
    isSuccess: true,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  reduceMotion.enabled = false;
  reduceMotion.handler = null;
  global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '' }) as never;
  mockUseConnect.mockReturnValue({ connect: vi.fn().mockResolvedValue({}), session: null, status: 'idle' });
  listLoaded();
});

function render(element: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

/** Flush the reduce-motion probe, which resolves on a microtask. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('ConnectModal: reduced motion', () => {
  it('slides by default', async () => {
    const r = render(<ConnectModal client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    await flush();
    expect(r.root.findByProps({ testID: 'wallet-modal' }).props.animationType).toBe('slide');
  });

  it('drops the animation when reduce motion is on', async () => {
    reduceMotion.enabled = true;
    const r = render(<ConnectModal client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    await flush();
    expect(r.root.findByProps({ testID: 'wallet-modal' }).props.animationType).toBe('none');
  });

  it('reacts to the setting being switched on while open', async () => {
    const r = render(<ConnectModal client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    await flush();
    expect(r.root.findByProps({ testID: 'wallet-modal' }).props.animationType).toBe('slide');

    await act(async () => {
      reduceMotion.handler?.(true);
    });
    expect(r.root.findByProps({ testID: 'wallet-modal' }).props.animationType).toBe('none');
  });
});

describe('ConnectModal: safe area insets', () => {
  it('uses the supplied bottom inset', async () => {
    const r = render(
      <ConnectModal client={{} as never} theme={theme} visible onClose={vi.fn()} insets={{ bottom: 48 }} />,
    );
    await flush();
    const panel = r.root.findAll(
      (n) => (n.type as unknown as string) === 'View' && typeof (n.props.style as { paddingBottom?: number })?.paddingBottom === 'number',
    );
    expect((panel[0].props.style as { paddingBottom: number }).paddingBottom).toBe(20 + 48);
  });

  it('falls back to a platform default when no inset is given', async () => {
    const r = render(<ConnectModal client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    await flush();
    const panel = r.root.findAll(
      (n) => (n.type as unknown as string) === 'View' && typeof (n.props.style as { paddingBottom?: number })?.paddingBottom === 'number',
    );
    // Platform is mocked as ios, whose default is 24.
    expect((panel[0].props.style as { paddingBottom: number }).paddingBottom).toBe(20 + 24);
  });
});

describe('ConnectModal: screen reader', () => {
  it('marks the sheet as a modal so the reader does not reach the content behind it', async () => {
    const r = render(<ConnectModal client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    await flush();
    expect(r.root.findAll((n) => n.props.accessibilityViewIsModal === true).length).toBeGreaterThan(0);
  });

  it('announces the state through a live region', async () => {
    mockUseWallets.mockReturnValue({
      wallets: undefined,
      walletIcons: [],
      isLoading: true,
      isSuccess: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const r = render(<ConnectModal client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    await flush();
    const status = r.root.findByProps({ testID: 'connect-modal-status' });
    expect(status.props.accessibilityLiveRegion).toBe('polite');
    expect(status.props.accessibilityLabel).toBe('Loading wallets');
  });

  it('labels the wallet rows for the reader', async () => {
    const r = render(<ConnectModal client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    await flush();
    const row = r.root.findByProps({ testID: 'wallet-row-console' });
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityLabel).toBe('Connect Console');
  });
});

describe('ConnectModal: connecting copy', () => {
  it('does not claim that the wallet app is being opened', async () => {
    // Never resolves, so the connecting state stays on screen.
    mockUseConnect.mockReturnValue({ connect: vi.fn(() => new Promise(() => {})), session: null, status: 'idle' });
    const r = render(<ConnectModal client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    await flush();

    await act(async () => {
      r.root.findByProps({ testID: 'wallet-row-console' }).props.onPress();
    });

    const text = JSON.stringify(r.toJSON());
    expect(text).toContain('Connecting to Console');
    // How the adapter reaches the wallet is its business; the modal must not assert an
    // app switch that may never happen.
    expect(text.toLowerCase()).not.toContain('opening the wallet app');
    expect(text).toContain('Waiting for the wallet to respond');
  });
});

describe('ConnectModal: flow', () => {
  it('closes on a successful connect', async () => {
    const onClose = vi.fn();
    mockUseConnect.mockReturnValue({ connect: vi.fn().mockResolvedValue({}), session: null, status: 'idle' });
    const r = render(<ConnectModal client={{} as never} theme={theme} visible onClose={onClose} />);
    await flush();

    await act(async () => {
      r.root.findByProps({ testID: 'wallet-row-console' }).props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the failure with a retry, and retrying reconnects the same wallet', async () => {
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error('user rejected'))
      .mockResolvedValueOnce({});
    mockUseConnect.mockReturnValue({ connect, session: null, status: 'idle' });
    const r = render(<ConnectModal client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    await flush();

    await act(async () => {
      r.root.findByProps({ testID: 'wallet-row-console' }).props.onPress();
    });
    expect(r.root.findAll((n) => n.props.testID === 'state-error').length).toBeGreaterThan(0);

    await act(async () => {
      r.root.findByProps({ testID: 'retry' }).props.onPress();
    });
    expect(connect).toHaveBeenCalledTimes(2);
    expect(connect).toHaveBeenLastCalledWith({ walletId: 'console' });
  });

  it('clears a previous failure when it is closed and reopened', async () => {
    mockUseConnect.mockReturnValue({
      connect: vi.fn().mockRejectedValue(new Error('user rejected')),
      session: null,
      status: 'idle',
    });
    const r = render(<ConnectModal client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    await flush();
    await act(async () => {
      r.root.findByProps({ testID: 'wallet-row-console' }).props.onPress();
    });
    expect(r.root.findAll((n) => n.props.testID === 'state-error').length).toBeGreaterThan(0);

    await act(async () => {
      r.update(<ConnectModal client={{} as never} theme={theme} visible={false} onClose={vi.fn()} />);
    });
    await act(async () => {
      r.update(<ConnectModal client={{} as never} theme={theme} visible onClose={vi.fn()} />);
    });

    // Back on the list rather than on the stale error.
    expect(r.root.findAll((n) => n.props.testID === 'state-error').length).toBe(0);
    expect(r.root.findAll((n) => n.props.testID === 'wallet-list').length).toBeGreaterThan(0);
  });
});

describe('ConnectModal: no props', () => {
  it('renders with neither client nor theme when both providers are present', async () => {
    const client = makeClient();
    const r = render(
      <PartyLayerProvider client={client}>
        <ThemeProvider theme="dark">
          <ConnectModal visible onClose={vi.fn()} />
        </ThemeProvider>
      </PartyLayerProvider>,
    );
    await flush();

    // It rendered, and it picked up the dark theme from the provider rather than a prop.
    const sheet = r.root.findByProps({ testID: 'wallet-modal' });
    expect(sheet).toBeTruthy();
    const darkBackground = toReactNativeTheme(themes.default.dark).colors.background;
    expect(
      r.root.findAll(
        (n) => (n.props.style as { backgroundColor?: string })?.backgroundColor === darkBackground,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('throws a message naming the provider when used with no client and no provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ConnectModal visible onClose={vi.fn()} />)).toThrow(/PartyLayerProvider/);
    spy.mockRestore();
  });
});
