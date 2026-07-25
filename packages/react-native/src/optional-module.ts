/**
 * Best-effort loader for an optional peer module.
 *
 * The React Native modules are peer dependencies the app installs, not bundled here.
 * When a factory is called with no explicit module, it tries to load one. The `require`
 * reference is read through a variable so a bundler does not try to resolve the id at
 * build time, and it is guarded so a pure ESM runtime (no `require`) simply returns
 * null and the caller reports a clear error.
 */
export function loadOptionalModule<T>(id: string, pick: (mod: unknown) => T | undefined): T | null {
  try {
    const req = (typeof require === 'function' ? require : null) as ((moduleId: string) => unknown) | null;
    if (!req) return null;
    const mod = req(id);
    return pick(mod) ?? null;
  } catch {
    return null;
  }
}
