'use client';

import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>('desktop');

  useEffect(() => {
    const mqTablet = window.matchMedia('(min-width: 768px)');
    const mqDesktop = window.matchMedia('(min-width: 1025px)');

    const update = () => {
      if (mqDesktop.matches) setBp('desktop');
      else if (mqTablet.matches) setBp('tablet');
      else setBp('mobile');
    };

    update();
    mqTablet.addEventListener('change', update);
    mqDesktop.addEventListener('change', update);
    return () => {
      mqTablet.removeEventListener('change', update);
      mqDesktop.removeEventListener('change', update);
    };
  }, []);

  return bp;
}

/** Pick a value based on the current breakpoint */
export function responsive<T>(bp: Breakpoint, mobile: T, tablet: T, desktop: T): T {
  if (bp === 'mobile') return mobile;
  if (bp === 'tablet') return tablet;
  return desktop;
}
