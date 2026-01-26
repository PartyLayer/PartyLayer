import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  resolve: {
    // Resolve workspace packages from source (not dist)
    alias: {
      '@cantonconnect/react': path.resolve(__dirname, '../../packages/react/src'),
      '@cantonconnect/sdk': path.resolve(__dirname, '../../packages/sdk/src'),
      '@cantonconnect/core': path.resolve(__dirname, '../../packages/core/src'),
      '@cantonconnect/registry-client': path.resolve(__dirname, '../../packages/registry-client/src'),
      // Adapters are bundled in SDK but need aliases for source resolution
      '@cantonconnect/adapter-console': path.resolve(__dirname, '../../packages/adapters/console/src'),
      '@cantonconnect/adapter-loop': path.resolve(__dirname, '../../packages/adapters/loop/src'),
    },
    // Ensure Vite deduplicates React
    dedupe: ['react', 'react-dom'],
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['@cantonconnect/sdk', '@cantonconnect/react'],
  },
})
