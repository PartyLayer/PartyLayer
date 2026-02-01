import { useState } from 'react';
import { cn } from '@/design/cn';

const faqItems = [
  {
    question: 'Is PartyLayer open source?',
    answer:
      'Yes! PartyLayer is fully open source under the MIT license. You can view the source code, submit issues, and contribute on GitHub. We believe in transparency and community-driven development.',
  },
  {
    question: 'How does registry verification work?',
    answer:
      'The wallet registry is a cryptographically signed JSON manifest containing metadata for each verified wallet. The SDK fetches this registry and validates signatures before displaying wallets to users. This prevents phishing attacks where malicious apps impersonate legitimate wallets.',
  },
  {
    question: 'Which networks are supported?',
    answer:
      'PartyLayer supports all Canton networks including mainnet, testnet, and devnet environments. The SDK automatically detects the connected network and adapts accordingly. Each wallet adapter handles network-specific connection logic.',
  },
  {
    question: 'What error codes should I handle?',
    answer:
      'Common error codes include WALLET_NOT_INSTALLED (wallet app not detected), SESSION_REJECTED (user declined connection), SESSION_EXPIRED (session timed out), and TRANSPORT_ERROR (communication failure). All errors are typed and documented in the SDK.',
  },
  {
    question: 'How is security tested?',
    answer:
      'We run comprehensive security testing including registry signature verification, session hijacking prevention, and transport layer security. The SDK includes built-in protections against common attack vectors. See our security checklist in the docs.',
  },
  {
    question: 'How do I add a new wallet to the registry?',
    answer:
      'Wallet providers can apply for registry inclusion by submitting a pull request to the PartyLayer repository. Requirements include implementing the standard adapter interface, passing conformance tests, and providing wallet metadata. See the wallet-provider-guide in our docs.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 border-t border-border">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-14">
          <h2 className="text-h2 text-fg mb-3">Frequently asked questions</h2>
          <p className="text-body text-slate-500">
            Everything you need to know about PartyLayer.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {faqItems.map((item, i) => {
            const isOpen = openIndex === i;

            return (
              <div
                key={i}
                className={cn(
                  'rounded-lg border overflow-hidden',
                  'transition-all duration-hover',
                  isOpen ? 'border-brand-500/30 bg-brand-50/30' : 'border-border bg-bg'
                )}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className={cn(
                    'w-full flex items-center justify-between p-5 text-left',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-inset'
                  )}
                  aria-expanded={isOpen}
                >
                  <span className="text-body font-medium text-fg pr-4">
                    {item.question}
                  </span>
                  <span
                    className={cn(
                      'flex-shrink-0 w-6 h-6 rounded-sm',
                      'flex items-center justify-center',
                      'bg-muted text-slate-500',
                      'transition-transform duration-hover',
                      isOpen && 'rotate-180'
                    )}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>

                <div
                  className={cn(
                    'overflow-hidden transition-all duration-modal ease-premium',
                    isOpen ? 'max-h-96' : 'max-h-0'
                  )}
                >
                  <div className="px-5 pb-5">
                    <p className="text-body text-slate-600">{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <p className="text-body text-slate-500">
            Still have questions?{' '}
            <a
              href="https://github.com/cayvox/PartyLayer/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-500 underline underline-offset-2"
            >
              Start a discussion on GitHub
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
