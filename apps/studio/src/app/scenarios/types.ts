// Shared scenario shape (wagmi/RainbowKit-style: one Sandpack shell, parametrized
// per scenario). Mirrors connectScenario's existing export — no invented fields.
export interface StudioScenario {
  /** Display title. */
  title?: string;
  /** Sandpack files map (visible + hidden). */
  files: Record<string, { code: string; active?: boolean; hidden?: boolean; readOnly?: boolean }>;
  /** Published deps Sandpack's bundler resolves. */
  dependencies: Record<string, string>;
  /** File shown in the editor (default '/App.tsx'). */
  activeFile?: string;
  /**
   * Sandpack template (e.g. 'react-ts' | 'vue' | 'vanilla-ts'). Optional —
   * defaults to 'react-ts' so every existing scenario (none set it) is
   * unchanged. Used by the framework-toggle scenario to run the SAME connect
   * demo in React / Vue / Vanilla.
   */
  template?: string;
  /**
   * Hide the mock-driver panel for this scenario. Optional — defaults to false
   * so existing scenarios keep the driver. Set by the framework variants, whose
   * vue/vanilla file layouts don't carry the driver's '/studio-mock-config.ts'.
   */
  hideMockDriver?: boolean;
}
