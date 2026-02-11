import { cn } from '@/design/cn';

export interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Negative margins compensate for the transparent padding in the SVG
 * (viewBox 0 0 1920 1080, content area ~y:392-683, x:239-1668).
 */
const sizeStyles = {
  sm: 'h-[96px] -my-[35px] -ml-[9px]',
  md: 'h-[132px] -my-[48px] -ml-[13px]',
  lg: 'h-[180px] -my-[66px] -ml-[18px]',
};

export function Logo({ className, size = 'md' }: LogoProps) {
  return (
    <a
      href="/"
      className={cn(
        'inline-flex items-center',
        'hover:opacity-80 transition-opacity duration-hover',
        className
      )}
    >
      <img
        src="/partylayer.xyz.svg"
        alt="PartyLayer"
        className={sizeStyles[size]}
        draggable={false}
      />
    </a>
  );
}
