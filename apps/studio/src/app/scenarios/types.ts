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
}
