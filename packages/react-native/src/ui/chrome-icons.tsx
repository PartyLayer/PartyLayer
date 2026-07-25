/**
 * The small set of chrome icons the core connect flow needs: close, back, error, and a
 * spinner. Built with react-native-svg, except the spinner which uses React Native's
 * ActivityIndicator. The remaining web chrome icons are deferred (see the README).
 */
import { ActivityIndicator } from 'react-native';
import { getSvgComponents } from './svg-loader';

/** A loading spinner (React Native's ActivityIndicator; no svg needed). */
export function Spinner({ color, size = 'small' }: { color: string; size?: 'small' | 'large' | number }) {
  return <ActivityIndicator testID="spinner" color={color} size={size} />;
}

/** A close (X) icon. */
export function CloseIcon({ color, size = 20 }: { color: string; size?: number }) {
  const { Svg, Path } = getSvgComponents();
  return (
    <Svg testID="icon-close" width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6 L18 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M18 6 L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** A back (chevron left) icon. */
export function BackIcon({ color, size = 20 }: { color: string; size?: number }) {
  const { Svg, Path } = getSvgComponents();
  return (
    <Svg testID="icon-back" width={size} height={size} viewBox="0 0 24 24">
      <Path d="M15 5 L8 12 L15 19" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** An error (exclamation in a circle) icon. */
export function ErrorIcon({ color, size = 32 }: { color: string; size?: number }) {
  const { Svg, Path } = getSvgComponents();
  return (
    <Svg testID="icon-error" width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2 A10 10 0 1 0 12 22 A10 10 0 1 0 12 2 Z"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
      <Path d="M12 7 L12 13" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 16.5 L12 17" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
