/**
 * Guarded access to react-native-svg.
 *
 * react-native-svg is an OPTIONAL peer: the headless "." entrypoint never needs it,
 * only the "./ui" components do (to render SVG wallet logos and the chrome icons). It
 * is loaded lazily so a consumer that installs it gets it, and a consumer that forgot
 * gets a clear developer error rather than an opaque crash.
 *
 * `__setSvgComponentsForTest` is an internal test seam (not exported from the ui
 * entrypoint) so the SVG path can be exercised with the module mocked.
 */
import type { ComponentType } from 'react';
import { loadOptionalModule } from '../optional-module';

/** The subset of react-native-svg the ui uses. */
export interface SvgComponents {
  Svg: ComponentType<Record<string, unknown>>;
  Path: ComponentType<Record<string, unknown>>;
  Rect: ComponentType<Record<string, unknown>>;
  SvgUri: ComponentType<Record<string, unknown>>;
}

let override: SvgComponents | null = null;
let cached: SvgComponents | null | undefined;

/** Test seam: inject a mock react-native-svg, or `null` to reset. Not public API. */
export function __setSvgComponentsForTest(components: SvgComponents | null): void {
  override = components;
  cached = undefined;
}

/**
 * Get the react-native-svg components, throwing a clear developer error when the
 * optional peer is not installed.
 */
export function getSvgComponents(): SvgComponents {
  if (override) return override;
  if (cached === undefined) {
    const mod = loadOptionalModule<Record<string, unknown>>('react-native-svg', (m) => m as Record<string, unknown>);
    cached = mod
      ? {
          Svg: mod.default as SvgComponents['Svg'],
          Path: mod.Path as SvgComponents['Path'],
          Rect: mod.Rect as SvgComponents['Rect'],
          SvgUri: mod.SvgUri as SvgComponents['SvgUri'],
        }
      : null;
  }
  if (!cached || typeof cached.SvgUri === 'undefined') {
    throw new Error(
      'react-native-svg is required by @partylayer/react-native/ui to render SVG wallet ' +
        'logos and icons. Install it as a peer dependency (react-native-svg), or use only the ' +
        'headless "." entrypoint.',
    );
  }
  return cached;
}
