import { useEffect, useState } from 'react';

/**
 * Return a debounced copy of `value` that only updates after `ms` of no change. Used to hold
 * off the live cost estimate while the amount is still being typed, so a network call fires
 * once typing settles rather than on every keystroke (F1).
 */
export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
