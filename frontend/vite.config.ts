import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 80,
    strictPort: true,
    // Proxy only routes that must reach the backend through Docker networking.
    // API calls go direct from the browser to http://localhost:8080 (no proxy needed).
    proxy: {
      // Tracking route — phishing click links (e.g. /t/abc123)
      '/t/': {
        target: 'http://backend:8080',
        changeOrigin: true,
      },
      // Phishing form submission — cloned page forms POST here
      '/p/': {
        target: 'http://backend:8080',
        changeOrigin: true,
      },
      // Static clone assets — CSS/JS/images for cloned landing pages
      '/static/': {
        target: 'http://backend:8080',
        changeOrigin: true,
      },
      // Landing page preview — served in iframes
      '/landing-pages/preview/': {
        target: 'http://backend:8080',
        changeOrigin: true,
      },
      // Event tracking — phishing target interactions
      '/events': {
        target: 'http://backend:8080',
        changeOrigin: true,
      },
      // Legacy /api/events path used by DB-seeded landing page templates
      '/api/events': {
        target: 'http://backend:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
  },
});
