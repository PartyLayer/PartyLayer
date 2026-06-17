/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@partylayer/react',
    '@partylayer/sdk',
    '@partylayer/core',
    '@partylayer/registry-client',
    '@partylayer/provider',
    '@partylayer/session',
  ],
  // Ensure ESM packages work correctly
  experimental: {
    esmExternals: 'loose',
  },
  // Webpack configuration to resolve workspace packages
  webpack: (config, { dev }) => {
    // Use memory cache in dev to prevent stale chunk errors after file edits
    if (dev) {
      config.cache = { type: 'memory' };
    }

    // Resolve workspace packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@partylayer/react': path.resolve(__dirname, '../../packages/react'),
      '@partylayer/sdk': path.resolve(__dirname, '../../packages/sdk'),
      '@partylayer/core': path.resolve(__dirname, '../../packages/core'),
      '@partylayer/registry-client': path.resolve(__dirname, '../../packages/registry-client'),
      '@partylayer/provider': path.resolve(__dirname, '../../packages/provider'),
      '@partylayer/session': path.resolve(__dirname, '../../packages/session'),
    };

    return config;
  },
};

module.exports = nextConfig;
