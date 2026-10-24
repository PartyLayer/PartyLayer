'use client';

/**
 * SynchronizerSwitcher: a presentational switcher for Canton synchronizers (the
 * networks a party can be on).
 *
 * Presentational (Model 2, like CostPreview): it renders a select over the options
 * the CONSUMER provides and reports the user's selection through the `onSwitch`
 * callback; it does NOT perform the switch itself, does NOT call any hook, and does
 * NOT reach the session store. The consumer supplies `options` and the current
 * `networkId` (e.g. from `usePartyState().networkId`) and handles `onSwitch` to
 * perform the actual network change.
 *
 * The Vue sibling emits a `switch` event; the React equivalent is the `onSwitch`
 * callback prop.
 *
 * When `options` is empty or absent, it renders nothing (mirrors CostPreview's
 * empty state).
 *
 * Theme-integrated via `useTheme()` (like CostPreview): the border, radius, font,
 * and text color all come from the theme.
 */

import { useTheme } from './theme';
import { useLocale } from './localization';

export interface SynchronizerOption {
  /** CAIP-2 network id, e.g. `canton:da-devnet`. */
  networkId: string;
  /** Optional human-readable label. Falls back to the networkId. */
  label?: string;
}

export interface SynchronizerSwitcherProps {
  /** The currently active network id (CAIP-2; a string, like `usePartyState().networkId`). */
  networkId?: string | null;
  /** The available synchronizers the consumer offers (Model 2: the consumer supplies them). */
  options?: SynchronizerOption[];
  /** Called with the synchronizer the user selected. The consumer performs the switch. */
  onSwitch?: (networkId: string) => void;
  /** Additional CSS class name (applied to the select). */
  className?: string;
  /** Additional inline styles (applied to the select). */
  style?: React.CSSProperties;
}

export function SynchronizerSwitcher({
  networkId,
  options,
  onSwitch,
  className,
  style,
}: SynchronizerSwitcherProps) {
  const theme = useTheme();
  const { t, locale, direction } = useLocale();

  // Render nothing when there are no options to switch between.
  if (!options || options.length === 0) {
    return null;
  }

  return (
    <select
      lang={locale}
      dir={direction}
      className={className}
      aria-label={t('synchronizer')}
      value={networkId ?? undefined}
      onChange={(event) => {
        // Presentational: report the selection; the consumer performs the switch.
        onSwitch?.(event.target.value);
      }}
      style={{
        padding: '6px 10px',
        borderRadius: theme.borderRadius,
        border: `1px solid ${theme.colors.border}`,
        fontSize: '13px',
        fontFamily: theme.fontFamily,
        color: theme.colors.text,
        backgroundColor: 'transparent',
        ...style,
      }}
    >
      {options.map((option) => (
        <option key={option.networkId} value={option.networkId}>
          {option.label ?? option.networkId}
        </option>
      ))}
    </select>
  );
}
