/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@cantonconnect/react',
    '@cantonconnect/sdk',
    '@cantonconnect/core',
    '@cantonconnect/registry-client',
    '@cantonconnect/adapter-console',
    '@cantonconnect/adapter-loop',
    '@cantonconnect/adapter-cantor8',
    '@cantonconnect/adapter-bron',
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
      '@cantonconnect/react': path.resolve(__dirname, '../../packages/react'),
      '@cantonconnect/sdk': path.resolve(__dirname, '../../packages/sdk'),
      '@cantonconnect/core': path.resolve(__dirname, '../../packages/core'),
      '@cantonconnect/registry-client': path.resolve(__dirname, '../../packages/registry-client'),
      '@cantonconnect/adapter-console': path.resolve(__dirname, '../../packages/adapters/console'),
      '@cantonconnect/adapter-loop': path.resolve(__dirname, '../../packages/adapters/loop'),
      '@cantonconnect/adapter-cantor8': path.resolve(__dirname, '../../packages/adapters/cantor8'),
      '@cantonconnect/adapter-bron': path.resolve(__dirname, '../../packages/adapters/bron'),
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
