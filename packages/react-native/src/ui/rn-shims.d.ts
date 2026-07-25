declare module 'react-native' {
  import type { ComponentType, ReactNode } from 'react';
  export interface ViewStyle { [key: string]: unknown }
  export interface TextStyle { [key: string]: unknown }
  export interface ImageStyle { [key: string]: unknown }
  export const View: ComponentType<{ style?: unknown; testID?: string; children?: ReactNode }>;
  export const Text: ComponentType<{ style?: unknown; testID?: string; numberOfLines?: number; children?: ReactNode }>;
  export const Image: ComponentType<{ source: { uri: string }; style?: unknown; testID?: string; onError?: () => void }>;
  export const ActivityIndicator: ComponentType<{ size?: 'small' | 'large' | number; color?: string; testID?: string }>;
  export interface PressableStateCallbackType { pressed: boolean }
  export const Pressable: ComponentType<{ onPress?: () => void; disabled?: boolean; style?: unknown | ((state: PressableStateCallbackType) => unknown); testID?: string; accessibilityRole?: string; accessibilityLabel?: string; children?: ReactNode | ((state: PressableStateCallbackType) => ReactNode) }>;
  export const Modal: ComponentType<{ visible: boolean; transparent?: boolean; animationType?: 'none' | 'slide' | 'fade'; onRequestClose?: () => void; testID?: string; children?: ReactNode }>;
  export const FlatList: ComponentType<{ data: readonly unknown[]; renderItem: (info: { item: unknown; index: number }) => ReactNode; keyExtractor?: (item: unknown, index: number) => string; testID?: string; style?: unknown; contentContainerStyle?: unknown }>;
  export const StyleSheet: { create<T extends Record<string, unknown>>(styles: T): T; readonly hairlineWidth: number };
}

declare module 'react-native-svg' {
  import type { ComponentType, ReactNode } from 'react';
  export interface SvgProps { width?: number | string; height?: number | string; viewBox?: string; fill?: string; stroke?: string; strokeWidth?: number; testID?: string; children?: ReactNode; style?: unknown }
  const Svg: ComponentType<SvgProps>;
  export default Svg;
  export const Path: ComponentType<{ d: string; fill?: string; stroke?: string; strokeWidth?: number; strokeLinecap?: string; strokeLinejoin?: string }>;
  export const Circle: ComponentType<{ cx: number | string; cy: number | string; r: number | string; fill?: string; stroke?: string; strokeWidth?: number }>;
  export const Rect: ComponentType<{ x?: number | string; y?: number | string; width: number | string; height: number | string; rx?: number | string; fill?: string }>;
  export const SvgUri: ComponentType<{ uri: string | null; width?: number | string; height?: number | string; onError?: () => void; testID?: string }>;
}
