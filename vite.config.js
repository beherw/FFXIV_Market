import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/FFXIV_Market/' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('axios')) {
              return 'axios';
            }
            if (id.includes('opencc-js')) {
              return 'opencc';
            }
            if (id.includes('@msgpack/msgpack')) {
              return 'msgpack';
            }
            // Other node_modules go into vendor chunk
            return 'vendor';
          }
          // Teamcraft data chunks (large JSON files) - note: recipes.json no longer used
          if (id.includes('teamcraft_git') && (id.includes('tw-items.json') || id.includes('tw-item-descriptions.json'))) {
            return 'teamcraft-data';
          }
          // Services that import large data files
          if (id.includes('src/services/itemDatabase') || id.includes('src/services/recipeDatabase')) {
            return 'services-data';
          }
        }
      }
    },
    chunkSizeWarningLimit: 600
  },
  logLevel: 'info',
  customLogger: {
    info(msg) {
      // Filter out some verbose vite messages
      if (msg.includes('watching for file changes')) return;
      if (msg.includes('hmr update')) return;
      console.log(`[Vite] ${msg}`);
    },
    warn(msg) {
      console.warn(`[Vite] Warning: ${msg}`);
    },
    error(msg) {
      console.error(`[Vite] Error: ${msg}`);
    }
  }
})
