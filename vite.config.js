import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'configure-gzip-handling',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.endsWith('.gz')) {
            // Remove the .gz extension to get the original file type
            const originalUrl = req.url.slice(0, -3)
            const ext = path.extname(originalUrl)
            
            // Set correct headers for gzipped content
            res.setHeader('Content-Encoding', 'gzip')
            res.setHeader('Content-Type', ext === '.csv' ? 'text/csv' : 'application/octet-stream')
            
            // Serve the file directly
            const filePath = path.join(server.config.root, 'public', req.url)
            if (fs.existsSync(filePath)) {
              const content = fs.readFileSync(filePath)
              return res.end(content)
            }
          }
          next()
        })
      }
    }
  ],
  base: './', // Use relative paths for GitHub Pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Configure chunk size and asset handling
    chunkSizeWarningLimit: 2000, // 2MB
    rollupOptions: {
      output: {
        manualChunks: undefined,
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  server: {
    fs: {
      // Allow serving files from one level up (where public dir is)
      allow: ['..'],
      strict: false
    },
    // Increase payload size limit for dev server
    maxBodySize: '500mb'
  },
  // Configure asset handling
  assetsInclude: ['**/*.csv', '**/*.csv.gz', '**/*.parquet'],
  optimizeDeps: {
    exclude: ['*.csv', '*.csv.gz', '*.parquet'] // Don't try to optimize data files
  }
})