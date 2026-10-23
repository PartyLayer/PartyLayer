'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type PartyLayerLocale = 'en' | 'tr';
export type PartyLayerDirection = 'ltr' | 'rtl';

const en = {
  connectWallet: 'Connect Wallet',
  connecting: 'Connecting...',
  connected: 'Connected',
  disconnect: 'Disconnect',
  signIn: 'Sign in',
  signingIn: 'Signing in...',
  signOut: 'Sign out of app',
  checkingSession: 'Checking session...',
  authenticationFailed: 'Sign-in failed: {reason}',
  copyAddress: 'Copy address',
  copied: 'Copied',
  account: 'Account {party}',
  walletAccount: 'Wallet account',
  back: 'Back',
  close: 'Close',
  searchWallets: 'Search wallets',
  loadingWallets: 'Loading wallets...',
  noWallets: 'No wallets found',
  installCompatible: 'Install a CIP-0103 compatible Canton wallet to get started.',
  noMatches: 'No wallets match “{query}”',
  guideTitle: 'New to Canton wallets?',
  guideText:
    'A wallet manages your Canton account and asks you to approve actions. Choose one from the list to connect this app. Your wallet handles approval and key management; PartyLayer never asks you to enter your private key or recovery phrase.',
  browseWallets: 'Browse wallets',
  openingWallet: 'Opening {wallet}...',
  confirmWallet: 'Confirm the connection in your wallet',
  cancel: 'Cancel',
  confirmExtension: 'Confirm the connection in your wallet extension',
  tryMobile: "Can't connect? Try mobile",
  timedOut: 'Connection timed out',
  extensionNoResponse:
    "The wallet extension didn't respond. You can try again or connect via mobile.",
  tryAgain: 'Try Again',
  connectMobile: 'Connect via Mobile',
  generatingQr: 'Generating QR code...',
  installExtension: 'Install browser extension',
  scanWallet: 'Scan with your Canton wallet',
  scanNamedWallet: 'Scan with {wallet} mobile app',
  openWallet: 'Open wallet',
  openNamedWallet: 'Open in {wallet}',
  readyWallet: '{wallet} is ready',
  authTimedOut: 'Authentication timed out',
  connectionFailed: 'Connection Failed',
  sendAuthExplanation:
    "This is a known intermittent issue with Send's authentication backend, not your dApp. Try again in a moment.",
  sendAuthNotice:
    'Send is intermittently unable to reach {host}. Click {retry} to retry, or check the Send status page for up-to-date service info.',
  visitSendStatus: 'Visit Send Status',
  allWallets: 'All Wallets',
  wrongNetwork: 'Wrong network',
  reconnect: 'Reconnect',
  networkMismatch:
    "Your wallet is on {actual}. This app requires {expected}. Switch your wallet's network, then reconnect.",
  networkDifferent:
    "Your wallet is on a different network than this app requires. Switch your wallet's network, then reconnect.",
  mobileWallet: '{wallet} is a mobile wallet',
  mobileWalletBody: '{wallet} has no browser extension. Open {wallet} on your phone to connect.',
  pairWallet: 'Pair with {wallet}',
  pairWalletBody:
    '{wallet} connects remotely by pairing. A pairing code appears when {wallet} is set up for this app; if none appeared, this app has not configured {wallet}.',
  notAvailable: '{wallet} is not available here',
  missingSdkBody:
    '{wallet} loads through its own SDK. Its absence is an app configuration issue, not something you can install.',
  missingHostedBody:
    '{wallet} connects through a hosted sign-in this app configures. Its absence is an app configuration issue, not something you can install.',
  missingPopupBody:
    "{wallet} is supplied by this app's configuration. Its absence is an app configuration issue, not something you can install.",
  missingConfigBody:
    '{wallet} is configured by this app. Its absence is an app configuration issue, not something you can install.',
  aboutWallet: 'About {wallet}',
  chooseWallet: 'Choose another wallet',
  walletNotFound: '{wallet} not found',
  extensionMissing:
    "The {wallet} browser extension isn't installed. Install it, then refresh this page to connect.",
  installWallet: 'Install {wallet}',
  notDetected: 'Wallet not detected. Please ensure it is installed and set up.',
  connectionTimeout: 'Connection timed out. Please try again.',
  cancelled: 'Connection was cancelled.',
  originDenied: 'This website is not authorized to connect.',
  extensionTransport: 'Browser Extension',
  extensionMobileTransport: 'Extension + Mobile',
  mobileTransport: 'Mobile wallet',
  popupTransport: 'Opens in a popup — nothing to install',
  remoteTransport: 'Connect from another device — nothing to install',
  scanTransport: 'Scan to connect — nothing to install',
  enterpriseTransport: 'Enterprise — configured by this app',
  cantonWallet: 'Canton wallet',
  native: 'CIP-0103 Native',
  available: 'Available',
  wallets: 'Wallets',
  estimatingCost: 'Estimating cost…',
  costError: 'Couldn’t load the cost:',
  confirmationRequest: 'Confirmation request',
  confirmationResponse: 'Confirmation response',
  total: 'Total',
  paid: 'Actual paid',
  submitting: 'Submitting transaction...',
  submitted: 'Transaction submitted',
  awaitingApproval: 'Approve the transaction in your wallet',
  txConfirmed: 'Transaction confirmed on the ledger',
  recentTransactions: 'Recent transactions',
  networkDevnet: 'Devnet',
  networkTestnet: 'Testnet',
  networkMainnet: 'Mainnet',
  accountNetwork: 'Network: {network}',
  tokenBalances: 'Token balances',
  loadingBalances: 'Loading balances...',
  balancesFailed: 'Balances unavailable: {reason}',
  noHoldings: 'No holdings returned for this account',
  availableBalance: 'Available: {amount}',
  lockedBalance: 'Locked: {amount}',
  switchNetworkInWallet: 'Switch to {network} in your wallet, then reconnect.',
  switchAccountInWallet: 'Change accounts or networks in your wallet. Reconnect if the wallet does not update this app.',
  txRejected: 'Transaction rejected',
  txUnknown: 'Transaction outcome unknown. Check the wallet or ledger before submitting again.',
  txFailed: 'Transaction failed: {reason}',
  unknownError: 'unknown error',
  synchronizer: 'Synchronizer',
  poweredBy: 'Powered by',
} as const;
type MessageKey = keyof typeof en;
const tr: Record<MessageKey, string> = {
  connectWallet: 'Cüzdan Bağla',
  connecting: 'Bağlanıyor...',
  connected: 'Bağlandı',
  disconnect: 'Bağlantıyı kes',
  signIn: 'Giriş yap',
  signingIn: 'Giriş yapılıyor...',
  signOut: 'Uygulamadan çıkış yap',
  checkingSession: 'Oturum kontrol ediliyor...',
  authenticationFailed: 'Giriş başarısız: {reason}',
  copyAddress: 'Adresi kopyala',
  copied: 'Kopyalandı',
  account: 'Hesap {party}',
  walletAccount: 'Cüzdan hesabı',
  back: 'Geri',
  close: 'Kapat',
  searchWallets: 'Cüzdan ara',
  loadingWallets: 'Cüzdanlar yükleniyor...',
  noWallets: 'Cüzdan bulunamadı',
  installCompatible: 'Başlamak için CIP-0103 uyumlu bir Canton cüzdanı yükleyin.',
  noMatches: '“{query}” ile eşleşen cüzdan yok',
  guideTitle: 'Canton cüzdanlarında yeni misiniz?',
  guideText:
    'Cüzdanınız, Canton hesabınızı yönetir ve işlemler için onayınızı ister. Bu uygulamaya bağlanmak için listeden bir cüzdan seçin. Onay ve anahtar yönetimi cüzdanınızda gerçekleşir; PartyLayer özel anahtarınızı veya kurtarma ifadenizi girmenizi istemez.',
  browseWallets: 'Cüzdanları görüntüle',
  openingWallet: '{wallet} açılıyor...',
  confirmWallet: 'Bağlantıyı cüzdanınızda onaylayın',
  cancel: 'İptal',
  confirmExtension: 'Bağlantıyı cüzdan eklentinizde onaylayın',
  tryMobile: 'Bağlanamıyor musunuz? Mobil cüzdanı deneyin',
  timedOut: 'Bağlantı zaman aşımına uğradı',
  extensionNoResponse:
    'Cüzdan eklentisi yanıt vermedi. Tekrar deneyebilir veya mobil cüzdanla bağlanabilirsiniz.',
  tryAgain: 'Tekrar dene',
  connectMobile: 'Mobil cüzdanla bağlan',
  generatingQr: 'QR kodu oluşturuluyor...',
  installExtension: 'Tarayıcı eklentisini yükle',
  scanWallet: 'Canton cüzdanınızla tarayın',
  scanNamedWallet: '{wallet} mobil uygulamasıyla tarayın',
  openWallet: 'Cüzdanı aç',
  openNamedWallet: '{wallet} ile aç',
  readyWallet: '{wallet} hazır',
  authTimedOut: 'Kimlik doğrulama zaman aşımına uğradı',
  connectionFailed: 'Bağlantı kurulamadı',
  sendAuthExplanation:
    'Send kimlik doğrulama hizmetinde zaman zaman bu sorun yaşanabiliyor. Biraz sonra tekrar deneyin.',
  sendAuthNotice:
    'Send bazen {host} hizmetine ulaşamıyor. Yeniden denemek için {retry} seçeneğini kullanın veya güncel hizmet bilgileri için Send durum sayfasını kontrol edin.',
  visitSendStatus: 'Send durum sayfasını aç',
  allWallets: 'Tüm cüzdanlar',
  wrongNetwork: 'Yanlış ağ',
  reconnect: 'Yeniden bağlan',
  networkMismatch:
    'Cüzdanınız {actual} ağında. Bu uygulama {expected} ağını gerektiriyor. Cüzdanınızdaki ağı değiştirip yeniden bağlanın.',
  networkDifferent:
    'Cüzdanınız bu uygulamanın gerektirdiğinden farklı bir ağda. Cüzdanınızdaki ağı değiştirip yeniden bağlanın.',
  mobileWallet: '{wallet} bir mobil cüzdandır',
  mobileWalletBody:
    '{wallet} için tarayıcı eklentisi yok. Bağlanmak için telefonunuzda {wallet} uygulamasını açın.',
  pairWallet: '{wallet} ile eşleştir',
  pairWalletBody:
    '{wallet} eşleştirme yoluyla bağlanır. Bu uygulamada {wallet} yapılandırılmışsa bir eşleştirme kodu görünür. Kod görünmüyorsa uygulamanın cüzdan yapılandırması eksiktir.',
  notAvailable: '{wallet} burada kullanılamıyor',
  missingSdkBody:
    "{wallet} kendi SDK'sı üzerinden yüklenir. Kullanılamaması uygulamanın yapılandırmasıyla ilgilidir; sizin yüklemeniz gereken bir eklenti yoktur.",
  missingHostedBody:
    '{wallet} bu uygulamanın yapılandırdığı bir giriş hizmetiyle bağlanır. Kullanılamaması uygulamanın yapılandırmasıyla ilgilidir; sizin yüklemeniz gereken bir eklenti yoktur.',
  missingPopupBody:
    '{wallet} bu uygulamanın yapılandırmasıyla sağlanır. Kullanılamaması uygulamanın yapılandırmasıyla ilgilidir; sizin yüklemeniz gereken bir eklenti yoktur.',
  missingConfigBody:
    '{wallet} bu uygulama tarafından yapılandırılır. Kullanılamaması uygulamanın yapılandırmasıyla ilgilidir; sizin yüklemeniz gereken bir eklenti yoktur.',
  aboutWallet: '{wallet} hakkında',
  chooseWallet: 'Başka bir cüzdan seç',
  walletNotFound: '{wallet} bulunamadı',
  extensionMissing:
    '{wallet} tarayıcı eklentisi yüklü değil. Eklentiyi yükleyip bağlanmak için sayfayı yenileyin.',
  installWallet: '{wallet} yükle',
  notDetected: 'Cüzdan algılanamadı. Yüklü ve kullanıma hazır olduğundan emin olun.',
  connectionTimeout: 'Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.',
  cancelled: 'Bağlantı iptal edildi.',
  originDenied: 'Bu web sitesinin bağlanma izni yok.',
  extensionTransport: 'Tarayıcı eklentisi',
  extensionMobileTransport: 'Eklenti + Mobil',
  mobileTransport: 'Mobil cüzdan',
  popupTransport: 'Açılır pencerede açılır — kurulum gerekmez',
  remoteTransport: 'Başka bir cihazdan bağlanır — kurulum gerekmez',
  scanTransport: 'Tarayarak bağlanır — kurulum gerekmez',
  enterpriseTransport: 'Kurumsal — bu uygulama tarafından yapılandırılır',
  cantonWallet: 'Canton cüzdanı',
  native: 'Yerel CIP-0103',
  available: 'Kullanılabilir',
  wallets: 'Cüzdanlar',
  estimatingCost: 'Ücret hesaplanıyor…',
  costError: 'Ücret yüklenemedi:',
  confirmationRequest: 'Onay isteği',
  confirmationResponse: 'Onay yanıtı',
  total: 'Toplam',
  paid: 'Ödenen tutar',
  submitting: 'İşlem gönderiliyor...',
  submitted: 'İşlem gönderildi',
  awaitingApproval: 'İşlemi cüzdanınızda onaylayın',
  txConfirmed: 'İşlem ledger üzerinde doğrulandı',
  recentTransactions: 'Son işlemler',
  networkDevnet: 'Devnet',
  networkTestnet: 'Testnet',
  networkMainnet: 'Mainnet',
  accountNetwork: 'Ağ: {network}',
  tokenBalances: 'Token bakiyeleri',
  loadingBalances: 'Bakiyeler yükleniyor...',
  balancesFailed: 'Bakiyeler alınamadı: {reason}',
  noHoldings: 'Bu hesap için varlık kaydı dönmedi',
  availableBalance: 'Kullanılabilir: {amount}',
  lockedBalance: 'Kilitli: {amount}',
  switchNetworkInWallet: 'Cüzdanınızda {network} ağına geçin ve yeniden bağlanın.',
  switchAccountInWallet: 'Hesabı veya ağı cüzdanınızdan değiştirin. Cüzdan uygulamayı güncellemezse yeniden bağlanın.',
  txRejected: 'İşlem reddedildi',
  txUnknown: 'İşlem sonucu bilinmiyor. Tekrar göndermeden önce cüzdanı veya ledger kaydını kontrol edin.',
  txFailed: 'İşlem başarısız: {reason}',
  unknownError: 'bilinmeyen hata',
  synchronizer: 'Senkronizatör',
  poweredBy: 'Altyapı:',
};

type Parameters = Record<string, string | number>;
function translator(locale: PartyLayerLocale) {
  const messages = locale === 'tr' ? tr : en;
  return (key: MessageKey, values?: Parameters): string =>
    messages[key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      String(values?.[name] ?? placeholder)
    );
}

interface LocaleContextValue {
  locale: PartyLayerLocale;
  direction: PartyLayerDirection;
  t: ReturnType<typeof translator>;
}
const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  direction: 'ltr',
  t: translator('en'),
});

export interface PartyLayerLocaleProviderProps {
  /** UI language. English/Turkish language tags are supported; others fall back to English. */
  locale?: string;
  /** Text/layout direction for an app embedded in an RTL page. Defaults to ltr. */
  direction?: PartyLayerDirection;
  children: ReactNode;
}

/** Deterministic on the server and client: no browser-language guess or global DOM mutation. */
export function PartyLayerLocaleProvider({
  locale = 'en',
  direction = 'ltr',
  children,
}: PartyLayerLocaleProviderProps) {
  const resolved: PartyLayerLocale = locale.toLowerCase().split(/[-_]/)[0] === 'tr' ? 'tr' : 'en';
  const value = useMemo(
    () => ({ locale: resolved, direction, t: translator(resolved) }),
    [resolved, direction]
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Internal UI hook. Applications retain ownership of their content translations. */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
export type Translate = LocaleContextValue['t'];
