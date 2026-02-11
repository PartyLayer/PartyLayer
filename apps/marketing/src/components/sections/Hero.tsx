import { Button } from '@/components/ui/Button';
import { cn } from '@/design/cn';

interface HeroProps {
  onOpenDemo: () => void;
}

export function Hero({ onOpenDemo }: HeroProps) {
  return (
    <section className="relative pt-20 pb-24 md:pt-28 md:pb-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full bg-brand-50 border border-brand-100">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-small font-medium text-fg">Now Open Source</span>
            </div>

            {/* Headline */}
            <h1 className="text-h1-mobile md:text-h1 text-fg text-balance mb-6">
              One SDK for every{' '}
              <span className="relative inline-block">
                <span className="relative z-10">Canton wallet</span>
                <span
                  className="absolute bottom-1 left-0 w-full h-3 bg-brand-100 -z-10"
                  style={{ transform: 'skewX(-3deg)' }}
                />
              </span>
              .
            </h1>

            {/* Subtitle */}
            <p className="text-body text-slate-600 max-w-lg mx-auto lg:mx-0 mb-8">
              WalletConnect-style integration for Canton — registry-backed, verified wallets,
              and a clean developer experience.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button
                variant="primary"
                size="lg"
                onClick={() => window.open('https://github.com/cayvox/PartyLayer', '_blank')}
                leftIcon={
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                }
              >
                View on GitHub
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => window.open('https://www.npmjs.com/package/@partylayer/sdk', '_blank')}
                leftIcon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331z" />
                  </svg>
                }
              >
                Install from npm
              </Button>
            </div>
          </div>

          {/* Device Preview */}
          <div className="relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Device Frame */}
              <div className={cn(
                'relative bg-bg rounded-xl border border-border shadow-card-hover overflow-hidden',
                'transform lg:rotate-1 hover:rotate-0 transition-transform duration-300'
              )}>
                {/* Browser Chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-muted border-b border-border">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="h-6 bg-bg rounded-md border border-border flex items-center px-3">
                      <span className="text-xs text-slate-400">yourapp.canton</span>
                    </div>
                  </div>
                </div>

                {/* Modal Preview */}
                <div className="p-6 bg-muted/30">
                  <div className="bg-bg rounded-lg border border-border shadow-modal p-5 max-w-sm mx-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-h3 text-fg">Connect Wallet</h3>
                      <div className="w-6 h-6 rounded-sm bg-muted flex items-center justify-center">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 6l8 8M14 6l-8 8" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-small text-slate-500 mb-4">
                      Select a wallet to connect to this dapp.
                    </p>

                    {/* Wallet List Preview */}
                    <div className="space-y-2">
                      {[
                        { name: 'Console Wallet', logo: '/wallets/console.png', verified: true, installed: true },
                        { name: '5N Loop', logo: '/wallets/loop.svg', verified: true, installed: false },
                        { name: 'Cantor8 (C8)', logo: '/wallets/cantor8.png', verified: true, installed: false },
                        { name: 'Bron', logo: '/wallets/bron.png', verified: true, installed: false },
                      ].map((wallet) => (
                        <button
                          key={wallet.name}
                          onClick={onOpenDemo}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-md border border-border',
                            'hover:bg-muted hover:border-slate-300',
                            'transition-all duration-hover',
                            'text-left cursor-pointer'
                          )}
                        >
                          <img
                            src={wallet.logo}
                            alt={`${wallet.name} logo`}
                            className="w-10 h-10 rounded-md"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-fg">{wallet.name}</span>
                              {wallet.verified && (
                                <span className="badge badge-verified">Verified</span>
                              )}
                            </div>
                          </div>
                          {wallet.installed && (
                            <span className="text-xs text-green-600 font-medium">Installed</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-brand-100 rounded-full blur-3xl opacity-60" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-brand-50 rounded-full blur-3xl opacity-80" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
