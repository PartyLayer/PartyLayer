/**
 * PartyAvatar: a presentational avatar for a Canton party.
 *
 * Presentational (Model 2 spirit, like CostPreview): it receives the party id as a
 * PROP and renders a deterministic visual. It does NOT call any composable, does NOT
 * inject the session store, and does NOT reach any service. The consumer owns the
 * state (e.g. from `usePartyState().party`) and passes it in.
 *
 * Pure and deterministic: the avatar is a pure function of the party string. The
 * circle color is derived from a simple hash of the party id, and the label is a
 * short derived form (or `formatLabel`). The same party id always yields the same
 * color and label. NO external avatar service, NO randomness.
 *
 * Authored with `defineComponent` + `h` (no `.vue` SFC, no theme system), like
 * CostPreview. Theme-independent minimal styles; a consumer styles the root via
 * `class`/`style`, applied by Vue attribute fallthrough.
 */
import { defineComponent, h, type PropType, type VNodeChild } from 'vue';

export interface PartyAvatarProps {
  /** The party id (Canton's address analog; a string, like `usePartyState().party`). */
  party?: string | null;
  /** Avatar diameter in px. Defaults to 32. */
  size?: number;
  /** Optional label formatter. When omitted, a short derived form of the party is shown. */
  formatLabel?: (party: string) => VNodeChild;
}

/** Deterministic hue (0-359) derived from the party string. */
function hashHue(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

/** Short derived label: the first two alphanumeric characters, uppercased. */
function defaultInitials(party: string): string {
  const cleaned = party.replace(/[^a-zA-Z0-9]/g, '');
  return (cleaned.slice(0, 2) || party.slice(0, 2)).toUpperCase();
}

export const PartyAvatar = defineComponent({
  name: 'PartyAvatar',
  props: {
    party: { type: String as PropType<string | null>, default: null },
    size: { type: Number, default: 32 },
    formatLabel: { type: Function as PropType<(party: string) => VNodeChild>, default: undefined },
  },
  setup(props) {
    return () => {
      const party = props.party;
      // Render nothing when there is no party (mirrors CostPreview's empty state).
      if (party == null || party === '') {
        return null;
      }

      const size = props.size;
      const hue = hashHue(party);
      const label: VNodeChild = props.formatLabel ? props.formatLabel(party) : defaultInitials(party);

      return h(
        'div',
        {
          class: 'pl-party-avatar',
          title: party,
          'aria-label': `Party ${party}`,
          style: {
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            backgroundColor: `hsl(${hue}, 60%, 45%)`,
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${Math.round(size * 0.4)}px`,
            fontWeight: 600,
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
            lineHeight: '1',
            userSelect: 'none',
          },
        },
        [label],
      );
    };
  },
});
