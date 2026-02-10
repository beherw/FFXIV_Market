import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Resolved TW JSON dir (newer of teamcraft vs tw_dataminer); run "npm run resolve-tw-json" before build
const TW_JSON_DIR = path.resolve(__dirname, '.tw-json')
const TC_TW_JSON_DIR = path.resolve(__dirname, 'teamcraft_git/libs/data/src/lib/json/tw')

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/FFXIV_Market/' : '/',
  plugins: [react()],
  resolve: {
    alias: [
      // Prefer resolved tw-*.json (by mtime) over teamcraft so deploy uses ours when newer
      { find: TC_TW_JSON_DIR, replacement: TW_JSON_DIR },
    ],
  },
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
          // Teamcraft / resolved TW data chunks (large JSON files)
          if ((id.includes('teamcraft_git') || id.includes('.tw-json')) && (id.includes('tw-items.json') || id.includes('tw-item-descriptions.json'))) {
            return 'teamcraft-data';
          }
          // Services that import large data files
          if (id.includes('src/services/itemDatabase') || id.includes('src/services/recipeDatabase')) {
            return 'services-data';
          }
        }
      }
    },
    // ObtainMethods + data deps are ~4.5MB; index/main bundle ~1.6MB. Avoid warning when code-split is already applied.
    chunkSizeWarningLimit: 5000
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
      // Suppress "dynamically imported ... but also statically imported ... will not move module" - known mixed-import pattern, no UX gain from refactor
      if (msg.includes('dynamically imported') && msg.includes('statically imported') && msg.includes('will not move module')) return;
      console.warn(`[Vite] Warning: ${msg}`);
    },
    error(msg) {
      console.error(`[Vite] Error: ${msg}`);
    }
  }
})
