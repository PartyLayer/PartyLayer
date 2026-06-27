'use client';

/**
 * WalletModal — Premium wallet selection modal for Canton dApps.
 *
 * Premium quality wallet selection experience:
 *   - Multi-state flow: idle -> connecting -> success -> error
 *   - RainbowKit-style dual-transport connect (extension + QR/mobile)
 *   - Smooth backdrop blur + scale animations
 *   - Dynamic wallet icons with graceful fallback
 *   - CIP-0103 native wallet priority display
 *   - Full dark/light theme support
 *
 * Uses existing hooks (useWallets, useConnect, useRegistryStatus) under the hood.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallets, useConnect, useRegistryStatus } from './hooks';
import { useTheme } from './theme';
import { useWalletIcons, useWalletOrder, resolveWalletIcon } from './kit';
import type { WalletInfo } from '@partylayer/sdk';
import { isCip0103Native } from '@partylayer/sdk';
import type { WalletIconMap } from './kit';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Optional callback fired with the new session id once a wallet connects.
   * The modal already self-closes via `onClose` on success, and the session is
   * observable via hooks (`useSession`/`useAccount`), so wiring this is only
   * needed if you want the session id directly at connect time.
   */
  onConnect?: (sessionId: string) => void;
  /** Custom wallet icon URLs (merged with PartyLayerKit context) */
  walletIcons?: WalletIconMap;
  /**
   * Wallet ids in display order; wallets not listed fall to the end. Sorts
   * within the CIP-0103 Native / Available sections, preserving the section
   * structure. When omitted, the discovered order is preserved (default).
   */
  walletOrder?: readonly string[];
}

type ModalView = 'list' | 'connecting' | 'success' | 'error' | 'not-installed' | 'network-mismatch';

/**
 * Sub-view for the connecting state when a wallet supports dual transport
 * (extension + mobile). Follows the RainbowKit/WalletConnect industry pattern.
 */
type ConnectPhase =
  | 'default'           // Standard connecting (non-dual-transport wallets)
  | 'extension'         // Waiting for extension approval
  | 'extension-timeout' // Extension timed out, offer retry + mobile fallback
  | 'qr';              // Showing QR code for mobile wallet scanning

/** Timeout for extension connection before showing fallback (ms) */
const EXTENSION_TIMEOUT_MS = 15_000;

/** ID of the DOM element injected by Console SDK for QR code display */
const SDK_QR_CONTAINER_ID = 'console-wallet-connect-placeholder';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Predicate for the canonical "CIP-0103 NATIVE" section.
 *
 * Pure registry decision (Prompt 7.6 simplification): a wallet is
 * native iff its registry entry has `cip0103.native === true`. No more
 * runtime detection, no more synthetic generic entries, no more
 * `metadata.source === 'native-cip0103'` runtime promotion. The picker
 * is now a static directory; transport-specific install probing happens
 * at connect time inside each adapter.
 */
function isNativeWallet(wallet: WalletInfo): boolean {
  return isCip0103Native(wallet);
}

/** Normalize a wallet id for order matching (case-insensitive, strip cip0103: prefix). */
function normalizeWalletId(id: string): string {
  return id.replace(/^cip0103:/, '').toLowerCase();
}

/**
 * Stable sort of wallets by an explicit `walletOrder` (ids in display order).
 * Wallets whose id isn't listed keep their relative order at the end. Returns a
 * new array; the input is untouched.
 */
function sortByWalletOrder(items: readonly WalletInfo[], order: readonly string[]): WalletInfo[] {
  const normalized = order.map(normalizeWalletId);
  const rank = (id: string) => {
    const i = normalized.indexOf(normalizeWalletId(id));
    return i === -1 ? normalized.length : i;
  };
  return [...items].sort((a, b) => rank(a.walletId) - rank(b.walletId));
}

/**
 * True when an error originates from Send's auth backend timing out.
 * Uses the typed `SendAuthTimeoutError` class identity AND a structural
 * fallback (details.cause) so the modal can offer a graceful retry
 * affordance even if the error tunnels through a wrapper that loses
 * `instanceof`.
 */
function isSendAuthTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  if ((err as { name?: unknown }).name === 'SendAuthTimeoutError') return true;
  const details = (err as { details?: unknown }).details;
  if (details && typeof details === 'object') {
    return (details as { cause?: unknown }).cause === 'send-auth-timeout';
  }
  return false;
}

/** Check if a wallet supports both browser extension and mobile transports */
function isDualTransportWallet(wallet: WalletInfo): boolean {
  const caps = wallet.capabilities;
  const hasExtension = caps.includes('injected');
  const hasMobile = caps.includes('deeplink') || caps.includes('remoteSigner');
  return hasExtension && hasMobile;
}

/**
 * Pure-remote / QR-only wallet: NO browser extension, reached only via a
 * remote signer / mobile transport (e.g. WalletConnect). These deliver a
 * pairing URI at connect time (via `onDisplayUri`) which the modal renders as
 * a QR / deep-link itself — they have no `#console-wallet-connect-placeholder`
 * DOM injection. (Wallets whose own SDK draws the QR simply never emit a URI,
 * so the QR view is only entered once a URI actually arrives.)
 */
function isPureRemoteWallet(wallet: WalletInfo): boolean {
  const caps = wallet.capabilities;
  if (caps.includes('injected')) return false;
  return (
    caps.includes('remoteSigner') || caps.includes('deeplink') || caps.includes('popup')
  );
}

function getErrorMessage(error: Error): string {
  const code = 'code' in error ? (error as { code: string }).code : '';
  switch (code) {
    case 'WALLET_NOT_INSTALLED':
      return 'Wallet not detected. Please ensure it is installed and set up.';
    case 'TIMEOUT':
      return 'Connection timed out. Please try again.';
    case 'USER_REJECTED':
      return 'Connection was cancelled.';
    case 'ORIGIN_NOT_ALLOWED':
      return 'This website is not authorized to connect.';
    case 'NETWORK_MISMATCH': {
      const e = error as { expected?: string; actual?: string };
      if (e.actual && e.expected) {
        return `Your wallet is on ${e.actual}. This app requires ${e.expected}. Switch your wallet's network, then reconnect.`;
      }
      return error.message;
    }
    default:
      return error.message;
  }
}

/** Generate a stable gradient from wallet name for avatar fallback */
function nameToGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 65%, 55%), hsl(${h2}, 65%, 45%))`;
}

/** Known wallet install/website URLs as fallback */
const KNOWN_WALLET_URLS: Record<string, string> = {
  console: 'https://consolewallet.io',
  loop: 'https://loop.5n.app',
  cantor8: 'https://cantor8.io',
  bron: 'https://bron.dev',
  nightly: 'https://nightly.app',
  send: 'https://cantonwallet.com',
};

function getWalletUrl(wallet: WalletInfo): string | null {
  if (wallet.website) return wallet.website;
  const id = String(wallet.walletId).replace(/^cip0103:/, '');
  for (const [key, url] of Object.entries(KNOWN_WALLET_URLS)) {
    if (id.toLowerCase().includes(key)) return url;
  }
  if (wallet.docs?.length > 0) return wallet.docs[0];
  return null;
}

function getWalletTransportLabel(wallet: WalletInfo): string {
  // Prompt 7.6: no longer short-circuits to "Ready" for native wallets.
  // Every wallet now reports its static transport family — derived purely
  // from the registry's capabilities array — so the picker reads as a
  // directory, not a status board.
  const hasInjected = wallet.capabilities.includes('injected');
  const hasDeeplink = wallet.capabilities.includes('deeplink');
  const hasRemoteSigner = wallet.capabilities.includes('remoteSigner');
  if (hasInjected && (hasDeeplink || hasRemoteSigner)) return 'Extension + Mobile';
  if (hasInjected) return 'Browser Extension';
  if (wallet.capabilities.includes('popup')) return 'Scan to connect';
  if (hasDeeplink) return 'Mobile wallet';
  if (hasRemoteSigner) return 'Enterprise';
  return wallet.capabilities.slice(0, 3).join(', ');
}

/**
 * Extract the QR code SVG from the Console SDK's injected DOM container
 * and hide the SDK's container so we can display the QR in our own modal.
 */
function extractSdkQrCode(): { svgHtml: string; deepLinkUrl: string | null } | null {
  const container = document.getElementById(SDK_QR_CONTAINER_ID);
  if (!container) return null;

  // Extract SVG
  const svg = container.querySelector('svg');
  if (!svg) return null;

  // Extract deep link URL from any button/anchor with consolewallet.io
  let deepLinkUrl: string | null = null;
  const links = Array.from(container.querySelectorAll('a, button'));
  for (let i = 0; i < links.length; i++) {
    const el = links[i];
    const href = (el as HTMLAnchorElement).href || el.getAttribute('data-href') || '';
    if (href.includes('consolewallet.io/wallet-connect')) {
      deepLinkUrl = href;
      break;
    }
  }
  // Fallback: look for child anchors with consolewallet href
  if (!deepLinkUrl) {
    const anchors = container.querySelectorAll('a[href*="consolewallet"]');
    if (anchors.length > 0) {
      deepLinkUrl = (anchors[0] as HTMLAnchorElement).href;
    }
  }

  return { svgHtml: svg.outerHTML, deepLinkUrl };
}

/** Cleanup: remove SDK's injected QR container if present */
function removeSdkQrContainer() {
  const container = document.getElementById(SDK_QR_CONTAINER_ID);
  if (container) {
    container.remove();
  }
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function CloseIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ArrowIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function BackIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function CheckIcon({ size = 32, color = '#10B981' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ErrorXIcon({ size = 32, color = '#EF4444' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function ShieldIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function DownloadIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ExternalLinkIcon({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function QrCodeIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="8" height="8" rx="1" />
      <rect x="14" y="2" width="8" height="8" rx="1" />
      <rect x="2" y="14" width="8" height="8" rx="1" />
      <rect x="14" y="14" width="4" height="4" rx="0.5" />
      <line x1="22" y1="14" x2="22" y2="18" />
      <line x1="18" y1="22" x2="22" y2="22" />
    </svg>
  );
}

function SmartphoneIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function RefreshIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function ClockIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ─── Wallet Icon Component ───────────────────────────────────────────────────

function ModalWalletIcon({
  wallet,
  size = 48,
  iconUrl,
}: {
  wallet: WalletInfo;
  size?: number;
  iconUrl: string | null;
}) {
  const [imgError, setImgError] = useState(false);
  const radius = size >= 44 ? '12px' : '10px';

  if (iconUrl && !imgError) {
    return (
      <img
        src={iconUrl}
        alt={wallet.name}
        onError={() => setImgError(true)}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: radius,
          flexShrink: 0,
          objectFit: 'cover',
        }}
      />
    );
  }

  // Gradient avatar fallback
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: radius,
        background: nameToGradient(wallet.name),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontSize: `${Math.round(size * 0.38)}px`,
        fontWeight: 700,
        flexShrink: 0,
        textShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }}
    >
      {wallet.name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WalletModal({
  isOpen,
  onClose,
  onConnect,
  walletIcons: propIcons,
  walletOrder: propWalletOrder,
}: WalletModalProps) {
  const { wallets, isLoading } = useWallets();
  const { connect, error, reset: resetConnect } = useConnect();
  const { status: registryStatus } = useRegistryStatus();
  const theme = useTheme();

  let contextIcons: WalletIconMap = {};
  try { contextIcons = useWalletIcons(); } catch { /* no Kit context */ }

  // Merge prop icons over context icons
  const walletIcons: WalletIconMap = { ...contextIcons, ...propIcons };

  // Wallet display-order override: prop takes precedence over Kit context.
  let contextWalletOrder: readonly string[] | undefined;
  try { contextWalletOrder = useWalletOrder(); } catch { /* no Kit context */ }
  const walletOrder = propWalletOrder ?? contextWalletOrder;

  const [view, setView] = useState<ModalView>('list');
  const [selectedWallet, setSelectedWallet] = useState<WalletInfo | null>(null);
  const [mismatchInfo, setMismatchInfo] = useState<{ expected: string; actual: string } | null>(null);
  const [closing, setClosing] = useState(false);
  const [connectError, setConnectError] = useState<Error | null>(null);

  // Dual-transport connect state (RainbowKit-style flow)
  const [connectPhase, setConnectPhase] = useState<ConnectPhase>('default');
  const [qrSvgHtml, setQrSvgHtml] = useState<string | null>(null);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Cleanup MutationObserver and timeout
  const cleanupConnectResources = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    removeSdkQrContainer();
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setView('list');
      setSelectedWallet(null);
      setClosing(false);
      setConnectPhase('default');
      setQrSvgHtml(null);
      setDeepLinkUrl(null);
      cleanupConnectResources();
    }
  }, [isOpen, cleanupConnectResources]);

  // Cleanup on unmount
  useEffect(() => cleanupConnectResources, [cleanupConnectResources]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Transition to error/not-installed view when connect fails
  useEffect(() => {
    if (error && view === 'connecting') {
      setConnectError(error);
      cleanupConnectResources();
      const code = 'code' in error ? (error as { code: string }).code : '';
      if (code === 'WALLET_NOT_INSTALLED' && !isDualTransportWallet(selectedWallet!)) {
        // For dual-transport wallets, don't show "not installed" — show QR fallback instead
        setView('not-installed');
      } else if (code === 'WALLET_NOT_INSTALLED' && isDualTransportWallet(selectedWallet!)) {
        // Extension not found for dual-transport → switch to QR phase
        setConnectPhase('qr');
        setConnectError(null);
      } else {
        setView('error');
      }
    }
  }, [error, view, selectedWallet, cleanupConnectResources]);

  const handleClose = useCallback(() => {
    cleanupConnectResources();
    resetConnect();
    setView('list');
    setSelectedWallet(null);
    setConnectError(null);
    setConnectPhase('default');
    setQrSvgHtml(null);
    setDeepLinkUrl(null);
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 150);
  }, [onClose, resetConnect, cleanupConnectResources]);

  /**
   * Start a MutationObserver that watches for the Console SDK's QR code
   * DOM injection. When detected, extracts the QR SVG and transitions
   * the modal to the QR view.
   */
  const startQrObserver = useCallback(() => {
    // Check if QR is already in DOM (SDK might have injected before observer started)
    const existing = extractSdkQrCode();
    if (existing) {
      setQrSvgHtml(existing.svgHtml);
      setDeepLinkUrl(existing.deepLinkUrl);
      setConnectPhase('qr');
      return;
    }

    const observer = new MutationObserver(() => {
      const result = extractSdkQrCode();
      if (result) {
        setQrSvgHtml(result.svgHtml);
        setDeepLinkUrl(result.deepLinkUrl);
        setConnectPhase('qr');
        observer.disconnect();
        observerRef.current = null;
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    observerRef.current = observer;
  }, []);

  /**
   * Receives a pairing/display URI from the adapter (e.g. a WalletConnect `wc:`
   * URI) during connect, renders it as a QR in the modal, and keeps the raw URI
   * as a mobile deep-link. Only adapters that emit a URI (WalletConnect) trigger
   * this; everything else keeps its existing flow.
   */
  const handleDisplayUri = useCallback(async (uri: string) => {
    setDeepLinkUrl(uri);
    setConnectPhase('qr');
    try {
      const QRCode = await import('qrcode');
      const svg = await QRCode.toString(uri, { type: 'svg', margin: 1, width: 240 });
      setQrSvgHtml(svg);
    } catch {
      // Keep the "Generating QR code..." spinner; the deep-link still works.
    }
  }, []);

  const handleWalletClick = useCallback(async (wallet: WalletInfo) => {
    setSelectedWallet(wallet);
    setConnectError(null);
    setView('connecting');
    setQrSvgHtml(null);
    setDeepLinkUrl(null);

    const isDual = isDualTransportWallet(wallet);
    const connectOptions: {
      walletId: typeof wallet.walletId;
      preferInstalled: boolean;
      onDisplayUri?: (uri: string) => void;
    } = {
      walletId: wallet.walletId,
      preferInstalled: true,
    };

    if (isDual) {
      // Dual-transport wallet: start extension flow with timeout + QR observer
      // (Console SDK injects its QR into #console-wallet-connect-placeholder).
      setConnectPhase('extension');

      // Watch for SDK's QR DOM injection (signals extension not found)
      startQrObserver();

      // Start timeout for extension flow
      timeoutRef.current = setTimeout(() => {
        // Only trigger timeout if we're still in extension phase
        setConnectPhase((current) => {
          if (current === 'extension') return 'extension-timeout';
          return current;
        });
      }, EXTENSION_TIMEOUT_MS);
    } else {
      setConnectPhase('default');
      // QR-only / remote-signer wallets (e.g. WalletConnect): when the adapter
      // emits a pairing URI, render the QR in-modal. Wallets that drive their
      // own QR never call onDisplayUri, so their flow is unchanged.
      connectOptions.onDisplayUri = handleDisplayUri;
    }

    const session = await connect(connectOptions);

    cleanupConnectResources();

    if (session) {
      // 'guard'/'off' policy: connect succeeds but the wallet is on the wrong
      // network → show the switch-network state instead of success.
      if (session.networkMismatch) {
        setMismatchInfo(session.networkMismatch);
        setView('network-mismatch');
      } else {
        setView('success');
        setTimeout(() => {
          onConnect?.(session.sessionId);
          onClose();
        }, 800);
      }
    }
    // If session is null, the useConnect hook's error state will trigger
    // the useEffect above to route to the appropriate error view ('strict'
    // policy throws NetworkMismatchError → handled there via getErrorMessage).
  }, [connect, onConnect, onClose, startQrObserver, cleanupConnectResources, handleDisplayUri]);

  const handleRetry = useCallback(() => {
    if (selectedWallet) {
      handleWalletClick(selectedWallet);
    }
  }, [selectedWallet, handleWalletClick]);

  const handleSwitchToMobile = useCallback(() => {
    // Cancel current connect and restart with QR flow
    resetConnect();
    setConnectPhase('qr');
    setConnectError(null);

    if (!selectedWallet) return;

    // Start observer before connecting (SDK will inject QR)
    startQrObserver();

    // Reconnect — the adapter in combined mode will show QR if extension is unresponsive
    // We start a fresh connect; the observer will capture the QR
    (async () => {
      const session = await connect({
        walletId: selectedWallet.walletId,
        preferInstalled: false,
      });

      cleanupConnectResources();

      if (session) {
        if (session.networkMismatch) {
          setMismatchInfo(session.networkMismatch);
          setView('network-mismatch');
        } else {
          setView('success');
          setTimeout(() => {
            onConnect?.(session.sessionId);
            onClose();
          }, 800);
        }
      }
    })();
  }, [selectedWallet, connect, resetConnect, onConnect, onClose, startQrObserver, cleanupConnectResources]);

  const handleBackToList = useCallback(() => {
    cleanupConnectResources();
    resetConnect();
    setView('list');
    setSelectedWallet(null);
    setConnectPhase('default');
    setQrSvgHtml(null);
    setDeepLinkUrl(null);
  }, [resetConnect, cleanupConnectResources]);

  if (!isOpen && !closing) return null;

  // Split wallets
  // Split into sections first, then (optionally) order WITHIN each section by
  // `walletOrder` — preserving the section structure. Default: discovered order.
  const nativeWalletsRaw = wallets.filter(isNativeWallet);
  const registryWalletsRaw = wallets.filter((w) => !isNativeWallet(w));
  const nativeWallets = walletOrder ? sortByWalletOrder(nativeWalletsRaw, walletOrder) : nativeWalletsRaw;
  const registryWallets = walletOrder ? sortByWalletOrder(registryWalletsRaw, walletOrder) : registryWalletsRaw;

  const isDark = theme.mode === 'dark';

  // ─── Styles ──────────────────────────────────────────────────────────

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlay,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    opacity: closing ? 0 : 1,
    transition: 'opacity 150ms',
  };

  const panelStyle: React.CSSProperties = {
    backgroundColor: theme.colors.background,
    borderRadius: '16px',
    width: '480px',
    maxWidth: '94vw',
    maxHeight: '85vh',
    overflow: 'hidden',
    fontFamily: theme.fontFamily,
    color: theme.colors.text,
    boxShadow: isDark
      ? '0 8px 32px rgba(0,0,0,0.5), 0 24px 80px rgba(0,0,0,0.4)'
      : '0 8px 32px rgba(15,23,42,0.12), 0 24px 80px rgba(15,23,42,0.08)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'}`,
    animation: !closing ? 'pl-panel-enter 250ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards' : undefined,
    transform: closing ? 'scale(0.95)' : undefined,
    opacity: closing ? 0 : undefined,
    transition: closing ? 'transform 150ms, opacity 150ms' : undefined,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
  };

  const closeBtnBase: React.CSSProperties = {
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: theme.colors.surface,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 150ms',
    flexShrink: 0,
  };

  const closeBtnStyle: React.CSSProperties = { ...closeBtnBase, width: '32px' };
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';

  const primaryBtnStyle: React.CSSProperties = {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '10px',
    backgroundColor: theme.colors.primary,
    color: '#0B0F1A',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: theme.fontFamily,
    transition: 'all 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  };

  const ghostBtnStyle: React.CSSProperties = {
    padding: '10px 20px',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '10px',
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: theme.fontFamily,
    transition: 'all 150ms',
  };

  const linkStyle: React.CSSProperties = {
    fontSize: '12px',
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    fontFamily: theme.fontFamily,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'color 150ms',
  };

  // ─── Back + Close Header ─────────────────────────────────────────────

  const renderSubHeader = (backAction: () => void) => (
    <div style={headerStyle}>
      <button
        onClick={backAction}
        style={{ ...closeBtnBase, width: 'auto', padding: '0 10px', gap: '4px' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
      >
        <BackIcon size={14} color={theme.colors.textSecondary} />
        <span style={{ fontSize: '12px', color: theme.colors.textSecondary, fontWeight: 500 }}>Back</span>
      </button>
      <button
        onClick={handleClose}
        style={closeBtnStyle}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
        aria-label="Close"
      >
        <CloseIcon size={16} color={theme.colors.textSecondary} />
      </button>
    </div>
  );

  // ─── Wallet Card Renderer ──────────────────────────────────────────

  const renderWalletItem = (wallet: WalletInfo) => {
    const isNative = isNativeWallet(wallet);
    const iconUrl = resolveWalletIcon(wallet.walletId, walletIcons, wallet.icons?.sm);

    return (
      <button
        key={wallet.walletId}
        onClick={() => handleWalletClick(wallet)}
        disabled={view === 'connecting'}
        style={{
          width: '100%',
          padding: '14px 18px',
          border: `1px solid ${isNative
            ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)')
            : theme.colors.border}`,
          borderRadius: '12px',
          cursor: view === 'connecting' ? 'wait' : 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          backgroundColor: isNative
            ? (isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.03)')
            : theme.colors.surface,
          color: theme.colors.text,
          fontFamily: theme.fontFamily,
          transition: 'all 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.transform = 'translateY(-1px)';
          el.style.boxShadow = isDark
            ? '0 4px 12px rgba(0,0,0,0.3)'
            : '0 4px 12px rgba(15,23,42,0.08)';
          el.style.borderColor = isNative
            ? (isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)')
            : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.15)');
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = 'none';
          el.style.borderColor = isNative
            ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)')
            : theme.colors.border;
        }}
      >
        <ModalWalletIcon wallet={wallet} size={48} iconUrl={iconUrl} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '15px', color: theme.colors.text }}>
              {wallet.name}
            </span>
            {isNative && (
              <span
                title={
                  wallet.cip0103?.evidence
                    ? `CIP-0103 native — evidence: ${wallet.cip0103.evidence}`
                    : 'CIP-0103 native'
                }
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#FFFFFF',
                  borderRadius: '5px',
                  fontWeight: 600,
                  letterSpacing: '0.3px',
                  lineHeight: '14px',
                  cursor: wallet.cip0103?.evidence ? 'help' : 'default',
                }}
              >
                CIP-0103
              </span>
            )}
            {wallet.metadata?.beta === 'true' && (
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                background: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.12)',
                color: isDark ? '#fbbf24' : '#b45309',
                border: `1px solid ${isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.25)'}`,
                borderRadius: '5px',
                fontWeight: 600,
                letterSpacing: '0.3px',
                lineHeight: '14px',
              }}>
                Beta
              </span>
            )}
          </div>
          {/*
            Prompt 7.6: status indicators removed entirely. The picker is
            now a registry-driven static directory — install / connect
            state is decided by the adapter at click-time, not pre-shown
            in the row. The transport-label line stays (it's static
            registry-derived metadata: "Browser Extension" / "Mobile
            wallet" / "Enterprise" etc.) so users still get a hint of
            HOW the wallet connects.
          */}
          <div style={{
            fontSize: '12px',
            color: theme.colors.textSecondary,
            marginTop: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {getWalletTransportLabel(wallet)}
          </div>
        </div>

        <ArrowIcon size={16} color={theme.colors.textSecondary} />
      </button>
    );
  };

  // ─── Section Header ────────────────────────────────────────────────

  const renderSectionHeader = (title: string, count: number, dotColor: string) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 0 8px',
    }}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: dotColor,
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: '11px',
        fontWeight: 600,
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {title}
      </span>
      <span style={{
        fontSize: '11px',
        color: theme.colors.textSecondary,
        opacity: 0.6,
      }}>
        {count}
      </span>
      <div style={{
        flex: 1,
        height: '1px',
        backgroundColor: theme.colors.border,
      }} />
    </div>
  );

  // ─── Views ─────────────────────────────────────────────────────────

  const renderListView = () => (
    <>
      {/* Header */}
      <div style={headerStyle}>
        <h2 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: 700,
          color: theme.colors.text,
          letterSpacing: '-0.01em',
        }}>
          Connect Wallet
        </h2>
        <button
          onClick={handleClose}
          style={closeBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
          aria-label="Close"
        >
          <CloseIcon size={16} color={theme.colors.textSecondary} />
        </button>
      </div>

      {/* Content */}
      <div style={{
        padding: '0 24px 20px',
        maxHeight: 'calc(85vh - 140px)',
        overflowY: 'auto',
      }}>
        {isLoading ? (
          // Prompt 7.6: spinner now only covers the registry HTTP fetch
          // (which can briefly delay the very first modal open). All
          // runtime detection that previously contributed to this loading
          // window has been removed.
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: `3px solid ${theme.colors.border}`,
              borderTop: `3px solid ${theme.colors.primary}`,
              borderRadius: '50%',
              animation: 'partylayer-spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <div style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
              Loading wallets...
            </div>
          </div>
        ) : wallets.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: theme.colors.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <ShieldIcon size={24} color={theme.colors.textSecondary} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: theme.colors.text, marginBottom: '8px' }}>
              No wallets found
            </div>
            <div style={{ fontSize: '13px', color: theme.colors.textSecondary, lineHeight: 1.5 }}>
              Install a CIP-0103 compatible Canton wallet to get started.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* CIP-0103 Native */}
            {nativeWallets.length > 0 && (
              <>
                {renderSectionHeader('CIP-0103 Native', nativeWallets.length, '#6366f1')}
                {nativeWallets.map(renderWalletItem)}
              </>
            )}

            {/* Registry */}
            {registryWallets.length > 0 && (
              <>
                {nativeWallets.length > 0 && <div style={{ height: '8px' }} />}
                {renderSectionHeader(
                  nativeWallets.length > 0 ? 'Available' : 'Wallets',
                  registryWallets.length,
                  theme.colors.primary,
                )}
                {registryWallets.map(renderWalletItem)}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '14px 24px 18px',
        borderTop: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
      }}>
        <ShieldIcon size={12} color={theme.colors.textSecondary} />
        <span style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
          CIP-0103 compliant
        </span>
        {registryStatus?.verified && (
          <>
            <span style={{ fontSize: '11px', color: theme.colors.textSecondary }}>·</span>
            <span style={{ fontSize: '11px', color: theme.colors.success }}>Verified</span>
          </>
        )}
      </div>
    </>
  );

  // ─── Connecting View ───────────────────────────────────────────────

  const renderConnectingView = () => {
    if (!selectedWallet) return null;

    // Route to the appropriate sub-view based on connect phase
    if (connectPhase === 'extension') return renderExtensionPhase();
    if (connectPhase === 'extension-timeout') return renderTimeoutPhase();
    if (connectPhase === 'qr') return renderQrPhase();

    // Default: standard connecting view for non-dual-transport wallets
    return renderDefaultConnecting();
  };

  /** Standard connecting spinner (for wallets without dual transport) */
  const renderDefaultConnecting = () => {
    if (!selectedWallet) return null;
    const iconUrl = resolveWalletIcon(selectedWallet.walletId, walletIcons, selectedWallet.icons?.sm);

    return (
      <>
        {renderSubHeader(handleBackToList)}

        <div style={{ padding: '24px 32px 40px', textAlign: 'center' }}>
          {/* Animated ring around icon */}
          <div style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            margin: '0 auto 24px',
          }}>
            <div style={{
              position: 'absolute',
              inset: '-6px',
              borderRadius: '18px',
              border: `3px solid ${theme.colors.border}`,
              borderTopColor: theme.colors.primary,
              animation: 'partylayer-spin 1.2s linear infinite',
            }} />
            <div style={{
              position: 'relative',
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              overflow: 'hidden',
            }}>
              <ModalWalletIcon wallet={selectedWallet} size={80} iconUrl={iconUrl} />
            </div>
          </div>

          <div style={{
            fontSize: '17px',
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: '8px',
          }}>
            Opening {selectedWallet.name}
          </div>
          <div style={{
            fontSize: '14px',
            color: theme.colors.textSecondary,
            lineHeight: 1.5,
            marginBottom: '32px',
          }}>
            Confirm the connection in your wallet
          </div>

          <button
            onClick={handleBackToList}
            style={ghostBtnStyle}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Cancel
          </button>
        </div>
      </>
    );
  };

  /**
   * Extension connect phase: waiting for user to approve in browser extension.
   * Shows spinner with "Confirm in your wallet extension" message and
   * a fallback link to switch to mobile QR flow.
   */
  const renderExtensionPhase = () => {
    if (!selectedWallet) return null;
    const iconUrl = resolveWalletIcon(selectedWallet.walletId, walletIcons, selectedWallet.icons?.sm);

    return (
      <>
        {renderSubHeader(handleBackToList)}

        <div style={{ padding: '24px 32px 36px', textAlign: 'center' }}>
          {/* Animated ring around icon */}
          <div style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            margin: '0 auto 24px',
          }}>
            <div style={{
              position: 'absolute',
              inset: '-6px',
              borderRadius: '18px',
              border: `3px solid ${theme.colors.border}`,
              borderTopColor: theme.colors.primary,
              animation: 'partylayer-spin 1.2s linear infinite',
            }} />
            <div style={{
              position: 'relative',
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              overflow: 'hidden',
            }}>
              <ModalWalletIcon wallet={selectedWallet} size={80} iconUrl={iconUrl} />
            </div>
          </div>

          <div style={{
            fontSize: '17px',
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: '8px',
          }}>
            Opening {selectedWallet.name}...
          </div>
          <div style={{
            fontSize: '14px',
            color: theme.colors.textSecondary,
            lineHeight: 1.5,
            marginBottom: '28px',
          }}>
            Confirm the connection in your wallet extension
          </div>

          <button
            onClick={handleBackToList}
            style={ghostBtnStyle}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Cancel
          </button>

          {/* Mobile fallback link */}
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={handleSwitchToMobile}
              style={linkStyle}
              onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textSecondary; }}
            >
              <SmartphoneIcon size={12} color="currentColor" />
              Can&apos;t connect? Try mobile
              <ArrowIcon size={10} color="currentColor" />
            </button>
          </div>
        </div>
      </>
    );
  };

  /**
   * Timeout phase: extension didn't respond within EXTENSION_TIMEOUT_MS.
   * Shows timeout message with retry + mobile fallback buttons.
   */
  const renderTimeoutPhase = () => {
    if (!selectedWallet) return null;
    const iconUrl = resolveWalletIcon(selectedWallet.walletId, walletIcons, selectedWallet.icons?.sm);

    return (
      <>
        {renderSubHeader(handleBackToList)}

        <div style={{ padding: '16px 32px 36px', textAlign: 'center' }}>
          <div style={{
            position: 'relative',
            width: '64px',
            height: '64px',
            margin: '0 auto 20px',
          }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '14px', overflow: 'hidden', opacity: 0.7 }}>
              <ModalWalletIcon wallet={selectedWallet} size={64} iconUrl={iconUrl} />
            </div>
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: theme.colors.warning,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `3px solid ${theme.colors.background}`,
            }}>
              <ClockIcon size={11} color="#FFFFFF" />
            </div>
          </div>

          <div style={{
            fontSize: '17px',
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: '8px',
          }}>
            Connection timed out
          </div>
          <div style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
            lineHeight: 1.6,
            maxWidth: '300px',
            margin: '0 auto 24px',
          }}>
            The wallet extension didn&apos;t respond. You can try again or connect via mobile.
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={handleRetry}
              style={primaryBtnStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.primary;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <RefreshIcon size={13} color="#0B0F1A" />
              {' '}Try Again
            </button>

            <button
              onClick={handleSwitchToMobile}
              style={ghostBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <QrCodeIcon size={14} color="currentColor" />
              {' '}Connect via Mobile
            </button>
          </div>
        </div>
      </>
    );
  };

  /**
   * QR code phase: shows the QR code for mobile wallet scanning.
   * QR SVG is extracted from the Console SDK's injected DOM.
   * Also shows deep link button for mobile browsers and install link.
   */
  const renderQrPhase = () => {
    if (!selectedWallet) return null;
    const iconUrl = resolveWalletIcon(selectedWallet.walletId, walletIcons, selectedWallet.icons?.sm);
    const installUrl = getWalletUrl(selectedWallet);
    // Generic (WalletConnect / QR-only) entries are wallet-agnostic: the same
    // QR works with any Canton WC wallet, so don't name a specific wallet.
    const isGenericRemote = isPureRemoteWallet(selectedWallet);
    const scanCopy = isGenericRemote
      ? 'Scan with your Canton wallet'
      : `Scan with ${selectedWallet.name} mobile app`;
    const openCopy = isGenericRemote ? 'Open wallet' : `Open in ${selectedWallet.name}`;

    return (
      <>
        {renderSubHeader(handleBackToList)}

        <div style={{ padding: '0 32px 32px', textAlign: 'center' }}>
          {/* Wallet name + icon row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '20px',
          }}>
            <ModalWalletIcon wallet={selectedWallet} size={28} iconUrl={iconUrl} />
            <span style={{ fontSize: '16px', fontWeight: 600, color: theme.colors.text }}>
              {selectedWallet.name}
            </span>
          </div>

          {/* QR Code container */}
          <div style={{
            width: '260px',
            height: '260px',
            margin: '0 auto 16px',
            borderRadius: '16px',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            border: `1px solid ${theme.colors.border}`,
          }}>
            {qrSvgHtml ? (
              <div
                dangerouslySetInnerHTML={{ __html: qrSvgHtml }}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            ) : (
              /* Loading state while waiting for SDK to generate QR */
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: `3px solid ${theme.colors.border}`,
                  borderTop: `3px solid ${theme.colors.primary}`,
                  borderRadius: '50%',
                  animation: 'partylayer-spin 0.8s linear infinite',
                  margin: '0 auto 12px',
                }} />
                <div style={{ fontSize: '13px', color: theme.colors.textSecondary }}>
                  Generating QR code...
                </div>
              </div>
            )}
          </div>

          <div style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
            marginBottom: '20px',
          }}>
            {scanCopy}
          </div>

          {/* Deep link button for mobile browsers */}
          {deepLinkUrl && (
            <a
              href={deepLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                ...primaryBtnStyle,
                textDecoration: 'none',
                marginBottom: '12px',
              }}
            >
              <SmartphoneIcon size={14} color="#0B0F1A" />
              {openCopy}
            </a>
          )}

          {/* Install extension link */}
          {installUrl && (
            <div style={{ marginTop: '4px' }}>
              <a
                href={installUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...linkStyle,
                  textDecoration: 'none',
                }}
              >
                <DownloadIcon size={11} color="currentColor" />
                Install browser extension
                <ExternalLinkIcon size={10} color="currentColor" />
              </a>
            </div>
          )}
        </div>
      </>
    );
  };

  // ─── Success View ──────────────────────────────────────────────────

  const renderSuccessView = () => {
    if (!selectedWallet) return null;
    const iconUrl = resolveWalletIcon(selectedWallet.walletId, walletIcons, selectedWallet.icons?.sm);

    return (
      <>
        <div style={headerStyle}>
          <div />
          <button onClick={handleClose} style={closeBtnStyle} aria-label="Close">
            <CloseIcon size={16} color={theme.colors.textSecondary} />
          </button>
        </div>

        <div style={{
          padding: '24px 32px 40px',
          textAlign: 'center',
          animation: 'pl-success-pop 300ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}>
          <div style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            margin: '0 auto 20px',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              overflow: 'hidden',
            }}>
              <ModalWalletIcon wallet={selectedWallet} size={80} iconUrl={iconUrl} />
            </div>
            {/* Success badge */}
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: theme.colors.success,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `3px solid ${theme.colors.background}`,
            }}>
              <CheckIcon size={14} color="#FFFFFF" />
            </div>
          </div>

          <div style={{
            fontSize: '17px',
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: '6px',
          }}>
            Connected
          </div>
          <div style={{ fontSize: '14px', color: theme.colors.success }}>
            {selectedWallet.name} is ready
          </div>
        </div>
      </>
    );
  };

  // ─── Error View ────────────────────────────────────────────────────

  const renderErrorView = () => {
    if (!selectedWallet) return null;
    const iconUrl = resolveWalletIcon(selectedWallet.walletId, walletIcons, selectedWallet.icons?.sm);
    const surfacedError = connectError || error;
    const isAuthTimeout = isSendAuthTimeoutError(surfacedError);
    const helpUrl = (() => {
      if (!isAuthTimeout || !surfacedError) return 'https://cantonwallet.com';
      const details = (surfacedError as unknown as { details?: { helpUrl?: unknown } }).details;
      if (details && typeof details === 'object' && typeof details.helpUrl === 'string') {
        return details.helpUrl;
      }
      return 'https://cantonwallet.com';
    })();

    // Amber-toned palette for the auth-timeout case — reads as "external
    // hiccup, please retry" rather than the red "fatal failure" tone we
    // use for unrecognised connection errors.
    const badgeColor = isAuthTimeout ? '#F59E0B' : theme.colors.error;

    return (
      <>
        {renderSubHeader(handleBackToList)}

        <div style={{ padding: '16px 32px 32px', textAlign: 'center' }}>
          <div style={{
            position: 'relative',
            width: '64px',
            height: '64px',
            margin: '0 auto 20px',
            opacity: 0.7,
          }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '14px', overflow: 'hidden' }}>
              <ModalWalletIcon wallet={selectedWallet} size={64} iconUrl={iconUrl} />
            </div>
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: badgeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `3px solid ${theme.colors.background}`,
            }}>
              <ErrorXIcon size={12} color="#FFFFFF" />
            </div>
          </div>

          <div style={{
            fontSize: '17px',
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: '8px',
          }}>
            {isAuthTimeout ? 'Authentication timed out' : 'Connection Failed'}
          </div>

          {surfacedError && (
            <div style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              lineHeight: 1.5,
              maxWidth: '320px',
              margin: '0 auto 16px',
            }}>
              {isAuthTimeout
                ? "This is a known intermittent issue with Send's authentication backend, not your dApp. Try again in a moment."
                : getErrorMessage(surfacedError)}
            </div>
          )}

          {isAuthTimeout && (
            <div
              role="status"
              style={{
                margin: '0 auto 20px',
                maxWidth: '320px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: isDark ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${isDark ? 'rgba(245,158,11,0.30)' : 'rgba(245,158,11,0.25)'}`,
                color: isDark ? '#fbbf24' : '#92400E',
                fontSize: '12px',
                lineHeight: 1.5,
                textAlign: 'left',
              }}
            >
              Send is intermittently unable to reach{' '}
              <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11px' }}>
                auth.cantonwallet.com
              </code>
              . Click <strong>Try Again</strong> to retry, or check the Send status page for
              up-to-date service info.
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleRetry}
              style={primaryBtnStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.primary;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Try Again
            </button>
            {isAuthTimeout && (
              <a
                href={helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...ghostBtnStyle, textDecoration: 'none', display: 'inline-block' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                Visit Send Status
              </a>
            )}
            <button
              onClick={handleBackToList}
              style={ghostBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              All Wallets
            </button>
          </div>
        </div>
      </>
    );
  };

  // ─── Network Mismatch View ─────────────────────────────────────────

  const renderNetworkMismatchView = () => {
    const iconUrl = selectedWallet
      ? resolveWalletIcon(selectedWallet.walletId, walletIcons, selectedWallet.icons?.sm)
      : null;
    return (
      <>
        {renderSubHeader(handleBackToList)}
        <div style={{ padding: '16px 32px 32px', textAlign: 'center' }}>
          {selectedWallet && (
            <div style={{ width: '64px', height: '64px', borderRadius: '14px', overflow: 'hidden', margin: '0 auto 20px', opacity: 0.85 }}>
              <ModalWalletIcon wallet={selectedWallet} size={64} iconUrl={iconUrl} />
            </div>
          )}
          <div style={{ fontSize: '17px', fontWeight: 600, color: theme.colors.text, marginBottom: '8px' }}>
            Wrong network
          </div>
          <div style={{ fontSize: '13px', color: theme.colors.textSecondary, lineHeight: 1.5, maxWidth: '320px', margin: '0 auto 20px' }}>
            {mismatchInfo
              ? `Your wallet is on ${mismatchInfo.actual}. This app requires ${mismatchInfo.expected}. Switch your wallet's network, then reconnect.`
              : "Your wallet is on a different network than this app requires. Switch your wallet's network, then reconnect."}
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleRetry}
              style={primaryBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primaryHover; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primary; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Reconnect
            </button>
            <button
              onClick={handleBackToList}
              style={ghostBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              All Wallets
            </button>
          </div>
        </div>
      </>
    );
  };

  // ─── Not Installed View ────────────────────────────────────────────

  const renderNotInstalledView = () => {
    if (!selectedWallet) return null;
    const iconUrl = resolveWalletIcon(selectedWallet.walletId, walletIcons, selectedWallet.icons?.sm);
    const installUrl = getWalletUrl(selectedWallet);

    return (
      <>
        {renderSubHeader(handleBackToList)}

        <div style={{ padding: '16px 32px 36px', textAlign: 'center' }}>
          {/* Wallet icon with download badge */}
          <div style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            margin: '0 auto 24px',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              overflow: 'hidden',
              opacity: 0.85,
            }}>
              <ModalWalletIcon wallet={selectedWallet} size={80} iconUrl={iconUrl} />
            </div>
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: theme.colors.warning,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `3px solid ${theme.colors.background}`,
            }}>
              <DownloadIcon size={13} color="#FFFFFF" />
            </div>
          </div>

          <div style={{
            fontSize: '17px',
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: '8px',
          }}>
            {selectedWallet.name} not found
          </div>

          <div style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
            lineHeight: 1.6,
            maxWidth: '300px',
            margin: '0 auto 28px',
          }}>
            {selectedWallet.name} doesn&apos;t appear to be installed. Install it and refresh this page to connect.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
            {installUrl && (
              <a
                href={installUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 28px',
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: theme.colors.primary,
                  color: '#0B0F1A',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: theme.fontFamily,
                  textDecoration: 'none',
                  transition: 'all 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = theme.colors.primaryHover;
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = theme.colors.primary;
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                <DownloadIcon size={15} color="#0B0F1A" />
                Install {selectedWallet.name}
                <ExternalLinkIcon size={11} color="#0B0F1A" />
              </a>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleRetry}
                style={{ ...ghostBtnStyle, fontSize: '13px' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                Try Again
              </button>
              <button
                onClick={handleBackToList}
                style={{ ...ghostBtnStyle, fontSize: '13px' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                All Wallets
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div
      style={overlayStyle}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Connect Wallet"
    >
      <div
        ref={modalRef}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {view === 'list' && renderListView()}
        {view === 'connecting' && renderConnectingView()}
        {view === 'success' && renderSuccessView()}
        {view === 'error' && renderErrorView()}
        {view === 'network-mismatch' && renderNetworkMismatchView()}
        {view === 'not-installed' && renderNotInstalledView()}
      </div>

      <style>{`
        @keyframes partylayer-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pl-panel-enter {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pl-success-pop {
          0% { transform: scale(0.9); opacity: 0; }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
        /* Hide Console SDK's injected QR/connector modal — we extract its
           content and render in our own modal. Using off-screen positioning
           instead of display:none so the SDK can fully render its DOM
           (QR SVG, connector buttons) before we extract them. */
        #${SDK_QR_CONTAINER_ID} {
          opacity: 0 !important;
          pointer-events: none !important;
          position: fixed !important;
          top: -9999px !important;
          left: -9999px !important;
        }
      `}</style>
    </div>
  );
}
