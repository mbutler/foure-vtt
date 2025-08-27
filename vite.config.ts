import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [legacy({ targets: ['defaults', 'not IE 11'] })],
  root: 'public',
  publicDir: 'public',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/games': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/src': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'public/index.html'
    }
  }
})


