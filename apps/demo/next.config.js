/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@partylayer/react',
    '@partylayer/sdk',
    '@partylayer/core',
    '@partylayer/registry-client',
    '@partylayer/adapter-console',
    '@partylayer/adapter-loop',
    '@partylayer/adapter-cantor8',
    '@partylayer/adapter-bron',
    '@partylayer/adapter-nightly',
    '@partylayer/provider',
  ],
  // Ensure ESM packages work correctly
  experimental: {
    esmExternals: 'loose',
  },
  // Webpack configuration to resolve workspace packages
  webpack: (config, { isServer }) => {
    // Resolve workspace packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@partylayer/react': path.resolve(__dirname, '../../packages/react'),
      '@partylayer/sdk': path.resolve(__dirname, '../../packages/sdk'),
      '@partylayer/core': path.resolve(__dirname, '../../packages/core'),
      '@partylayer/registry-client': path.resolve(__dirname, '../../packages/registry-client'),
      '@partylayer/adapter-console': path.resolve(__dirname, '../../packages/adapters/console'),
      '@partylayer/adapter-loop': path.resolve(__dirname, '../../packages/adapters/loop'),
      '@partylayer/adapter-cantor8': path.resolve(__dirname, '../../packages/adapters/cantor8'),
      '@partylayer/adapter-bron': path.resolve(__dirname, '../../packages/adapters/bron'),
      '@partylayer/adapter-nightly': path.resolve(__dirname, '../../packages/adapters/nightly'),
      '@partylayer/provider': path.resolve(__dirname, '../../packages/provider'),
    };

    return config;
  },
  // Environment variables
  env: {
    NEXT_PUBLIC_REGISTRY_URL: process.env.NEXT_PUBLIC_REGISTRY_URL || 'http://localhost:3001',
    NEXT_PUBLIC_REGISTRY_CHANNEL: process.env.NEXT_PUBLIC_REGISTRY_CHANNEL || 'stable',
    NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK || 'devnet',
  },
};

module.exports = nextConfig;
