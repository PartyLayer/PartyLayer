---
"@partylayer/adapter-starter": patch
---

Build with tsup, so the package is importable at all.

The exports map named `./dist/index.mjs`, but the build was two `tsc` passes that never emitted it. The first pass inherited `module: ESNext` from the root config and wrote ESM into `dist/*.js`; the second pass used the same module setting and the same `outDir`, so it rewrote those same files, and `tsc` does not emit `.mjs`. The result was that both entry conditions were broken: `import` resolved to a file that did not exist, and `require` resolved to a file that was ESM, carrying extensionless relative specifiers that Node cannot resolve. Both failed with ERR_MODULE_NOT_FOUND.

The package now builds with tsup, like every other adapter in this repository, which emits `dist/index.js` as CJS, `dist/index.mjs` as ESM and the declarations, exactly matching the existing exports map. `type: module` is removed so the CJS entry is genuinely CJS, and `files` narrows to `dist`. The starter is meant to be copied by wallet authors, so building it the way the real adapters are built also makes it a faithful template.
