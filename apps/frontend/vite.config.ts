import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategy: 'generateSW',
      includeAssets: ['favicon.ico', 'icons/*.png', 'robots.txt'],
      manifest: {
        name: 'Millets Momo - Order Tracker',
        short_name: 'Millets Momo',
        description: 'Daily order tracking for the Millets Momo cart',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F0F4F1',
        theme_color: '#1B6B3A',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|gif|ico|woff2?)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'static-assets', expiration: { maxAgeSeconds: 86400 * 30 } },
          },
          {
            urlPattern: /^\/api\/menu/,
            handler: 'CacheFirst',
            options: { cacheName: 'menu-data', expiration: { maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /^\/api\/(orders|supply|admin|closing-stock)/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-data', expiration: { maxAgeSeconds: 300 }, networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': ['@mui/material', '@emotion/react', '@emotion/styled'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-motion': ['framer-motion'],
          'vendor-charts': ['recharts'],
          'vendor-xlsx': ['xlsx'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    target: 'es2020',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:7071',
    },
  },
});