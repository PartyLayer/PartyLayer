#!/usr/bin/env node
/**
 * CantonConnect Registry CLI
 * 
 * Command-line tool for managing wallet registry.
 */

import { program } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import {
  readRegistry,
  writeRegistry,
  initRegistry,
  addWallet,
  updateWallet,
  removeWallet,
  incrementSequence,
  updatePublishedAt,
  createRegistry,
  getRegistryPath,
  getSignaturePath,
} from './registry';
import { signRegistry, writeSignature } from './sign';
import type { RegistryWalletEntry, RegistryChannel } from '@cantonconnect/registry-client';

program
  .name('cantonconnect-registry')
  .description('CLI tool for managing CantonConnect wallet registry')
  .version('0.1.0');

/**
 * Initialize registry structure
 */
program
  .command('init')
  .description('Initialize registry structure')
  .option('--channel <channel>', 'Channel to initialize', 'stable')
  .action((options) => {
    try {
      const channel = options.channel as RegistryChannel;
      if (channel !== 'stable' && channel !== 'beta') {
        console.error('Error: channel must be "stable" or "beta"');
        process.exit(1);
      }

      initRegistry(channel);
      console.log(`✅ Initialized ${channel} registry`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Add wallet
 */
program
  .command('add-wallet')
  .description('Add wallet to registry')
  .requiredOption('--channel <channel>', 'Channel (stable or beta)')
  .requiredOption('--walletId <id>', 'Wallet ID')
  .requiredOption('--name <name>', 'Wallet name')
  .requiredOption('--adapterPackage <pkg>', 'Adapter package name')
  .option('--adapterRange <range>', 'Adapter version range', '*')
  .option('--homepage <url>', 'Homepage URL')
  .option('--icon <url>', 'Icon URL')
  .option('--sign', 'Sign registry after adding')
  .option('--key <path>', 'Private key path (required if --sign)')
  .action(async (options) => {
    try {
      const channel = options.channel as RegistryChannel;
      if (channel !== 'stable' && channel !== 'beta') {
        console.error('Error: channel must be "stable" or "beta"');
        process.exit(1);
      }

      const registry = readRegistry(channel);

      const wallet: RegistryWalletEntry = {
        id: options.walletId,
        name: options.name,
        homepage: options.homepage,
        icon: options.icon,
        supportedNetworks: ['devnet', 'testnet', 'mainnet'],
        capabilities: {
          signMessage: false,
          signTransaction: false,
          submitTransaction: false,
          transactionStatus: false,
          switchNetwork: false,
          multiParty: false,
        },
        adapter: {
          type: options.adapterPackage,
        },
        sdkVersion: options.adapterRange,
      };

      addWallet(registry, wallet);
      incrementSequence(registry);
      updatePublishedAt(registry);
      writeRegistry(channel, registry);

      console.log(`✅ Added wallet "${options.walletId}" to ${channel}`);

      if (options.sign) {
        if (!options.key) {
          console.error('Error: --key required when using --sign');
          process.exit(1);
        }

        const registryJson = readFileSync(getRegistryPath(channel), 'utf-8');
        // Try to find corresponding public key
        const keyDir = dirname(options.key);
        const keyName = dirname(options.key).split('/').pop()?.replace('.key', '') || 'dev';
        const pubkeyPath = join(keyDir, `${keyName}.pub`);
        const { signature, fingerprint } = await signRegistry(
          registryJson,
          options.key,
          existsSync(pubkeyPath) ? pubkeyPath : undefined
        );
        writeSignature(channel, signature, fingerprint);
        console.log(`✅ Signed ${channel} registry`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Update wallet
 */
program
  .command('update-wallet')
  .description('Update wallet in registry')
  .requiredOption('--channel <channel>', 'Channel')
  .requiredOption('--walletId <id>', 'Wallet ID')
  .option('--name <name>', 'Wallet name')
  .option('--homepage <url>', 'Homepage URL')
  .action((options) => {
    try {
      const channel = options.channel as RegistryChannel;
      const registry = readRegistry(channel);

      const updates: Partial<RegistryWalletEntry> = {};
      if (options.name) updates.name = options.name;
      if (options.homepage) updates.homepage = options.homepage;

      updateWallet(registry, options.walletId, updates);
      incrementSequence(registry);
      updatePublishedAt(registry);
      writeRegistry(channel, registry);

      console.log(`✅ Updated wallet "${options.walletId}" in ${channel}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Remove wallet
 */
program
  .command('remove-wallet')
  .description('Remove wallet from registry')
  .requiredOption('--channel <channel>', 'Channel')
  .requiredOption('--walletId <id>', 'Wallet ID')
  .action((options) => {
    try {
      const channel = options.channel as RegistryChannel;
      const registry = readRegistry(channel);

      removeWallet(registry, options.walletId);
      incrementSequence(registry);
      updatePublishedAt(registry);
      writeRegistry(channel, registry);

      console.log(`✅ Removed wallet "${options.walletId}" from ${channel}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Bump sequence
 */
program
  .command('bump-sequence')
  .description('Increment sequence number')
  .requiredOption('--channel <channel>', 'Channel')
  .action((options) => {
    try {
      const channel = options.channel as RegistryChannel;
      const registry = readRegistry(channel);

      incrementSequence(registry);
      updatePublishedAt(registry);
      writeRegistry(channel, registry);

      console.log(`✅ Bumped sequence to ${registry.metadata.sequence} in ${channel}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Sign registry
 */
program
  .command('sign')
  .description('Sign registry')
  .requiredOption('--channel <channel>', 'Channel')
  .requiredOption('--key <path>', 'Private key path')
  .action(async (options) => {
    try {
      const channel = options.channel as RegistryChannel;
      const registryPath = getRegistryPath(channel);

      if (!existsSync(registryPath)) {
        console.error(`Error: Registry not found: ${registryPath}`);
        process.exit(1);
      }

      const registryJson = readFileSync(registryPath, 'utf-8');
      const { signature, fingerprint } = await signRegistry(registryJson, options.key);
      writeSignature(channel, signature, fingerprint);

      console.log(`✅ Signed ${channel} registry`);
      console.log(`   Fingerprint: ${fingerprint}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Verify registry
 */
program
  .command('verify')
  .description('Verify registry signature')
  .requiredOption('--channel <channel>', 'Channel')
  .requiredOption('--pubkey <path>', 'Public key path')
  .action(async (options) => {
    try {
      const { verifyRegistry } = await import('./verify');
      const isValid = await verifyRegistry(options.channel, options.pubkey);

      if (isValid) {
        console.log(`✅ Registry signature verified for ${options.channel}`);
      } else {
        console.error(`❌ Registry signature verification FAILED for ${options.channel}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Promote from beta to stable
 */
program
  .command('promote')
  .description('Promote registry from beta to stable')
  .requiredOption('--from <channel>', 'Source channel', 'beta')
  .requiredOption('--to <channel>', 'Target channel', 'stable')
  .option('--key <path>', 'Private key path (signs target after promotion)')
  .action(async (options) => {
    try {
      const from = options.from as RegistryChannel;
      const to = options.to as RegistryChannel;

      const sourceRegistry = readRegistry(from);
      const targetRegistry = createRegistry(to);

      // Copy wallets
      targetRegistry.wallets = [...sourceRegistry.wallets];
      incrementSequence(targetRegistry);
      updatePublishedAt(targetRegistry);
      writeRegistry(to, targetRegistry);

      console.log(`✅ Promoted ${sourceRegistry.wallets.length} wallets from ${from} to ${to}`);

      if (options.key) {
        const registryJson = readFileSync(getRegistryPath(to), 'utf-8');
        const keyDir = dirname(options.key);
        const keyBaseName = options.key.split('/').pop()?.replace('.key', '') || 'dev';
        const pubkeyPath = join(keyDir, `${keyBaseName}.pub`);
        const { signature, fingerprint } = await signRegistry(
          registryJson,
          options.key,
          existsSync(pubkeyPath) ? pubkeyPath : undefined
        );
        writeSignature(to, signature, fingerprint);
        console.log(`✅ Signed ${to} registry`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Print status
 */
program
  .command('print-status')
  .description('Print registry status')
  .requiredOption('--channel <channel>', 'Channel')
  .action((options) => {
    try {
      const channel = options.channel as RegistryChannel;
      const registry = readRegistry(channel);
      const sigPath = getSignaturePath(channel);
      const hasSignature = existsSync(sigPath);

      console.log(`Registry Status (${channel}):`);
      console.log(`  Published: ${registry.metadata.publishedAt}`);
      console.log(`  Sequence: ${registry.metadata.sequence}`);
      console.log(`  Wallets: ${registry.wallets.length}`);
      console.log(`  Signed: ${hasSignature ? 'Yes' : 'No'}`);

      if (registry.wallets.length > 0) {
        console.log('\nWallets:');
        for (const wallet of registry.wallets) {
          console.log(`  - ${wallet.id}: ${wallet.name}`);
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
