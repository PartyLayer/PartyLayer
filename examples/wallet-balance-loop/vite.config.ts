import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
  },
  resolve: {
    alias: {
      '@partylayer/react': path.resolve(__dirname, '../../packages/react/src'),
      '@partylayer/sdk': path.resolve(__dirname, '../../packages/sdk/src'),
      '@partylayer/core': path.resolve(__dirname, '../../packages/core/src'),
      '@partylayer/registry-client': path.resolve(__dirname, '../../packages/registry-client/src'),
      '@partylayer/adapter-console': path.resolve(__dirname, '../../packages/adapters/console/src'),
      '@partylayer/adapter-loop': path.resolve(__dirname, '../../packages/adapters/loop/src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['@partylayer/sdk', '@partylayer/react'],
  },
})
