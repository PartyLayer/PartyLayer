/**
 * @fivenorth/loop-sdk ships its own type declarations as of 0.13.x
 * (see the package's `exports["."].types` → dist/index.d.ts). The adapter now
 * consumes those real types directly, so this file intentionally declares
 * nothing. It is kept as a pointer; a `declare module '@fivenorth/loop-sdk'`
 * block here would merge with (and conflict against) the package's own exports.
 *
 * The provider type is not re-exported by name from the SDK root, so the adapter
 * derives it from `loop.init`'s `onAccept` parameter. `Account` and the
 * structured error classes ARE exported from the root and are imported directly.
 */
export {};
