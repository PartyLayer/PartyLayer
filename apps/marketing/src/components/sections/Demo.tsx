import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

interface DemoProps {
  /** Open the REAL @partylayer/react connect modal (mounted in App). */
  onConnect: () => void;
}

/**
 * Live connect demo. The "Connect Wallet" button opens the REAL PartyLayer
 * modal (the same one the SDK ships) — real registry-backed detection, real
 * wallet order, real WalletConnect QR, real network-safety. No simulation.
 */
export function Demo({ onConnect }: DemoProps) {
  return (
    <section className="py-20 border-t border-border">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-h2 text-fg mb-3">Try it live</h2>
          <p className="text-body text-slate-500 max-w-xl mx-auto">
            The same connect modal your dApp ships — real wallet detection,
            registry-backed verification, and a live WalletConnect QR.
          </p>
        </div>

        <Card variant="default">
          <CardContent>
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-brand-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-brand-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
                  />
                </svg>
              </div>
              <h4 className="text-h3 text-fg mb-2">Your dApp</h4>
              <p className="text-small text-slate-500 mb-6 max-w-sm">
                Open the connect modal to see real wallet discovery. No Canton
                wallet? You&apos;ll get a scannable WalletConnect QR — exactly
                what your users see.
              </p>

              <Button variant="primary" size="lg" onClick={onConnect}>
                Connect Wallet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
