'use client';

import { useEffect, useRef, type RefObject } from 'react';

/** Current, visible controls: re-query after searches and view transitions. */
function controls(panel: HTMLElement): HTMLElement[] {
  return Array.from(
    panel.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')
  ).filter((element) => {
    if (
      element.tabIndex < 0 ||
      element.matches(':disabled') ||
      element.closest('[hidden], [inert], [aria-hidden="true"]')
    )
      return false;
    for (
      let node: HTMLElement | null = element;
      node && node !== panel;
      node = node.parentElement
    ) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  });
}

/** Keep keyboard navigation inside our panel without intercepting vendor overlays. */
export function useDialogFocus(
  ref: RefObject<HTMLElement>,
  open: boolean,
  view: string,
  onClose: () => void
): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const panel = ref.current;
    if (!open || !panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (controls(panel)[0] ?? panel).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const items = controls(panel);
        const first = items[0];
        const last = items[items.length - 1];
        if (!first) {
          event.preventDefault();
          panel.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === panel)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === panel)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    panel.addEventListener('keydown', onKeyDown);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      // A vendor may have opened its own approval surface. Do not steal its focus.
      if (
        previous?.isConnected &&
        (panel.contains(document.activeElement) || document.activeElement === document.body)
      ) {
        previous.focus();
      }
    };
  }, [open, ref]);

  useEffect(() => {
    const panel = ref.current;
    if (open && panel && document.activeElement === document.body) {
      (controls(panel)[0] ?? panel).focus();
    }
  }, [open, view, ref]);
}
