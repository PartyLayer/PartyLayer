/**
 * SynchronizerSwitcher: a presentational switcher for Canton synchronizers (the
 * networks a party can be on).
 *
 * Presentational (Model 2, like CostPreview): it renders a select over the options
 * the CONSUMER provides and EMITS the user's selection; it does NOT perform the
 * switch itself, does NOT call any composable, and does NOT inject the session store.
 * The consumer supplies `options` and the current `networkId` (e.g. from
 * `usePartyState().networkId`) and handles the `switch` event to perform the actual
 * network change.
 *
 * Emits:
 *  - `switch` (networkId: string): the synchronizer the user selected.
 *
 * When `options` is empty or absent, it renders nothing (mirrors CostPreview's empty
 * state).
 *
 * Authored with `defineComponent` + `h` (no `.vue` SFC, no theme system), like
 * CostPreview. Theme-independent minimal styles; a consumer styles the root via
 * `class`/`style`, applied by Vue attribute fallthrough.
 */
import { defineComponent, h, type PropType } from 'vue';

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
}

export const SynchronizerSwitcher = defineComponent({
  name: 'SynchronizerSwitcher',
  props: {
    networkId: { type: String as PropType<string | null>, default: null },
    options: { type: Array as PropType<SynchronizerOption[]>, default: undefined },
  },
  emits: {
    switch: (networkId: string) => typeof networkId === 'string',
  },
  setup(props, { emit }) {
    return () => {
      const options = props.options;
      // Render nothing when there are no options to switch between.
      if (!options || options.length === 0) {
        return null;
      }

      return h(
        'select',
        {
          class: 'pl-synchronizer-switcher',
          'aria-label': 'Synchronizer',
          value: props.networkId ?? undefined,
          style: {
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '13px',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
            color: 'inherit',
            backgroundColor: 'transparent',
          },
          onChange: (event: Event) => {
            const next = (event.target as HTMLSelectElement).value;
            // Presentational: emit the selection; the consumer performs the switch.
            emit('switch', next);
          },
        },
        options.map((option) =>
          h(
            'option',
            { value: option.networkId, selected: option.networkId === props.networkId },
            option.label ?? option.networkId,
          ),
        ),
      );
    };
  },
});
