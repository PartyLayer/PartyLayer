import { Card, CardContent } from '@/components/ui/Card';
import { wallets, type WalletId } from '@/design/tokens';

interface WalletGridProps {
  installedWallets: WalletId[];
  onWalletClick: (walletId: WalletId) => void;
}

export function WalletGrid({ installedWallets, onWalletClick }: WalletGridProps) {
  return (
    <section id="wallets" className="py-20 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-14">
          <h2 className="text-h2 text-fg mb-3">Supported wallets</h2>
          <p className="text-body text-slate-500 max-w-xl mx-auto">
            All verified wallets in the Canton ecosystem, unified behind a single interface.
          </p>
        </div>

        {/* Wallet Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {wallets.map((wallet) => {
            const isInstalled = installedWallets.includes(wallet.id);

            return (
              <Card
                key={wallet.id}
                variant="default"
                hoverable
                className="cursor-pointer h-full"
                onClick={() => onWalletClick(wallet.id)}
              >
                <CardContent className="flex flex-col h-full">
                  {/* Logo */}
                  <div className="w-14 h-14 rounded-lg mb-4 overflow-hidden">
                    <img
                      src={wallet.logo}
                      alt={`${wallet.name} logo`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Name & Badges */}
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-h3 text-fg">{wallet.name}</h3>
                    <span className="badge badge-verified">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                      Verified
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-small text-slate-500 mb-3">
                    {wallet.description}
                  </p>

                  {/* Meta — pinned to the bottom so cards equalize regardless of copy length */}
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs text-slate-400">{wallet.transport}</span>
                    {isInstalled ? (
                      <span className="badge badge-installed">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Installed
                      </span>
                    ) : (
                      <span className="badge badge-not-installed">Not installed</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Registry Note */}
        <div className="mt-10 text-center">
          <p className="text-small text-slate-500">
            Wallet providers can apply for registry inclusion.{' '}
            <a
              href="https://github.com/PartyLayer/PartyLayer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-500 underline underline-offset-2"
            >
              Learn more →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
