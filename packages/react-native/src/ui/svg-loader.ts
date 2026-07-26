/**
 * Access to react-native-svg for the "./ui" entrypoint.
 *
 * react-native-svg is imported statically, so a bundler (Metro on web and native)
 * includes it. The "./ui" entrypoint genuinely cannot render without it, so this is
 * correct: a consumer who has not installed it gets a bundler resolution error at build
 * time, which is earlier and clearer than a runtime crash. The headless "." entrypoint
 * never imports this module, so it never needs react-native-svg.
 *
 * `__setSvgComponentsForTest` is an internal test seam (not exported from the ui
 * entrypoint) so tests can inject mock components.
 */
import type { ComponentType } from 'react';
import Svg, { Path, Rect, SvgUri } from 'react-native-svg';

/** The subset of react-native-svg the ui uses. */
export interface SvgComponents {
  Svg: ComponentType<Record<string, unknown>>;
  Path: ComponentType<Record<string, unknown>>;
  Rect: ComponentType<Record<string, unknown>>;
  SvgUri: ComponentType<Record<string, unknown>>;
}

const fromImport: SvgComponents = {
  Svg: Svg as SvgComponents['Svg'],
  Path: Path as SvgComponents['Path'],
  Rect: Rect as SvgComponents['Rect'],
  SvgUri: SvgUri as SvgComponents['SvgUri'],
};

let override: SvgComponents | null = null;

/** Test seam: inject a mock react-native-svg, or `null` to reset. Not public API. */
export function __setSvgComponentsForTest(components: SvgComponents | null): void {
  override = components;
}

/**
 * Get the react-native-svg components (from the static import, or the test override).
 */
export function getSvgComponents(): SvgComponents {
  if (override) return override;
  if (typeof fromImport.SvgUri === 'undefined') {
    throw new Error(
      'react-native-svg is required by @partylayer/react-native/ui to render SVG wallet ' +
        'logos and icons. Install it as a peer dependency (react-native-svg), or use only the ' +
        'headless "." entrypoint.',
    );
  }
  return fromImport;
}
