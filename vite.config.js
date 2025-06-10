import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for GitHub Pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Don't include large files in the build by default
    rollupOptions: {
      external: (id) => {
        // Exclude large CSV/Parquet files from the build
        if (id.includes('.csv') || id.includes('.parquet')) {
          console.log('Excluding large file from build:', id);
          return false; // Actually include them but warn
        }
        return false;
      }
    }
  },
  server: {
    fs: {
      // Allow serving files from public directory
      allow: ['..']
    }
  }
})