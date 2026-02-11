import { useState } from 'react';
import { cn } from '@/design/cn';
import { Logo } from './Logo';
import { Button } from './ui/Button';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Wallets', href: '#wallets' },
  { label: 'Quickstart', href: '#quickstart' },
  { label: 'FAQ', href: '#faq' },
];

export function Nav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      className={cn(
        'sticky top-0 z-40',
        'bg-bg/80 backdrop-blur-lg border-b border-border'
      )}
    >
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Logo size="md" />

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'text-small font-medium text-slate-600',
                'hover:text-fg transition-colors duration-hover'
              )}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open('https://www.npmjs.com/package/@partylayer/sdk', '_blank')}
          >
            npm
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://github.com/cayvox/PartyLayer', '_blank')}
            leftIcon={
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            }
          >
            GitHub
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => window.open('#quickstart', '_self')}
          >
            Get Started
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className={cn(
            'md:hidden p-2 rounded-md',
            'hover:bg-muted transition-colors duration-hover',
            'focus:outline-none focus:ring-2 focus:ring-brand-500/40'
          )}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            {mobileMenuOpen ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6l-12 12" />
            ) : (
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-bg animate-slide-up">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  'block py-2 text-body font-medium text-slate-600',
                  'hover:text-fg transition-colors'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-border space-y-2">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => window.open('#quickstart', '_self')}
              >
                Get Started
              </Button>
              <Button
                variant="outline"
                size="md"
                className="w-full"
                onClick={() => window.open('https://github.com/cayvox/PartyLayer', '_blank')}
              >
                GitHub
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
