/**
 * Adapter Module Loader
 * 
 * Dynamically loads adapter modules (ESM/CJS safe)
 */

import { createRequire } from 'module';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

import type { WalletAdapter } from '@partylayer/core';

// This package builds to ESM (type: module), where the `require` global is
// undefined — a bare `require(...)`/`require.resolve(...)` throws at runtime
// (and would hit esbuild's `__require` shim in bundled consumers). Use a real
// Node require created from this module's URL instead.
const nodeRequire = createRequire(import.meta.url);

/**
 * Load adapter from package or path
 */
export async function loadAdapter(
  packageNameOrPath: string
): Promise<WalletAdapter> {
  let adapterPath: string;

  // Check if it's a path
  if (packageNameOrPath.startsWith('.') || packageNameOrPath.startsWith('/')) {
    adapterPath = resolve(packageNameOrPath);
  } else {
    // Try to resolve as package
    try {
      adapterPath = nodeRequire.resolve(packageNameOrPath);
    } catch {
      throw new Error(`Cannot resolve adapter: ${packageNameOrPath}`);
    }
  }

  // Try to load as ESM first
  try {
    const moduleUrl = pathToFileURL(adapterPath).href;
    const module = await import(moduleUrl);
    
    // Look for default export or named export
    const adapter = module.default || module[Object.keys(module)[0]];
    
    if (!adapter) {
      throw new Error('No adapter export found');
    }

    // If it's a class, instantiate it
    if (typeof adapter === 'function') {
      return new adapter();
    }

    return adapter as WalletAdapter;
  } catch (err) {
    // Fallback to CJS
    try {
      const module = nodeRequire(adapterPath);
      const adapter = module.default || module[Object.keys(module)[0]];
      
      if (!adapter) {
        throw new Error('No adapter export found');
      }

      if (typeof adapter === 'function') {
        return new adapter();
      }

      return adapter as WalletAdapter;
    } catch (cjsErr) {
      throw new Error(
        `Failed to load adapter: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
