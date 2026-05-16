import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Dev (./app/run.sh dev): Vite listens on APP_PORT (8000) and proxies backend routes to Django.
// Prod (./app/run.sh prod): no Vite — Django serves the built app on the same port.
const DJANGO = process.env.BACKEND_URL || 'http://localhost:8001';

const proxyCommon = {
  target: DJANGO,
  // Preserve Host: localhost:8000 so Auth0 callbacks match prod (same origin).
  changeOrigin: false,
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.APP_PORT) || 8000,
    strictPort: true,
    proxy: {
      '/api': proxyCommon,
      '/media': proxyCommon,
      '/ws': { ...proxyCommon, target: DJANGO.replace('http', 'ws'), ws: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './components'),
      '@contexts': path.resolve(__dirname, './contexts'),
      '@pages': path.resolve(__dirname, './pages'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'framer-motion': ['framer-motion'],
          'mui': ['@mui/material', '@mui/icons-material', '@mui/system', '@emotion/react', '@emotion/styled'],
          'icons': ['lucide-react', 'react-icons'],
        }
      }
    }
  }
})
