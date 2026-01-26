/**
 * Adapter Module Loader
 * 
 * Dynamically loads adapter modules (ESM/CJS safe)
 */

import type { WalletAdapter } from '@cantonconnect/core';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

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
      adapterPath = require.resolve(packageNameOrPath);
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require(adapterPath);
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
