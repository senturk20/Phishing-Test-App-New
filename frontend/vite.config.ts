import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    proxy: {
      // Tracking route (phishing click links)
      '/t/': {
        target: 'http://backend:8080',
        changeOrigin: true,
      },
      // Landing page preview (iframe)
      '/api/landing-pages/preview/': {
        target: 'http://backend:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Static clone assets
      '/static/': {
        target: 'http://backend:8080',
        changeOrigin: true,
      },
      // Phishing form submission
      '/api/p/': {
        target: 'http://backend:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // All other API calls
      '/api/': {
        target: 'http://backend:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    port: 4173,
  },
});
