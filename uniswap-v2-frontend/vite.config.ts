import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // To exclude specific polyfills, add them to this list
      exclude: [
        'fs', // Excludes the polyfill for 'fs' and 'node:fs'
      ],
      // Whether to polyfill specific globals
      globals: {
        Buffer: true, // Enables the Buffer polyfill
        global: true, // Enables the global polyfill
        process: true, // Enables the process polyfill
      },
    }),
  ],
  define: {
    'process.env': {}
  },
  resolve: {
    alias: {
      // Add any needed aliases
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@heroicons/react', 'react-icons/fa'],
    exclude: [],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  build: {
    target: 'esnext',
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  server: {
    hmr: true,
    watch: {
      usePolling: true
    },
    force: true
  }
})
