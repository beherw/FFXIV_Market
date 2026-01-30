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
            // Other node_modules go into vendor chunk
            return 'vendor';
          }
          // Teamcraft data chunks (large JSON files)
          if (id.includes('teamcraft_git') && (id.includes('tw-items.json') || id.includes('tw-recipes.json') || id.includes('tw-item-descriptions.json'))) {
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
  }
})
