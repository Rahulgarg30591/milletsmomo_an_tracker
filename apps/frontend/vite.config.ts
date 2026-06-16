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
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|gif|ico)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'images' },
          },
          {
            urlPattern: /^\/api\/menu/,
            handler: 'CacheFirst',
            options: { cacheName: 'menu-data', expiration: { maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /^\/api\/orders/,
            handler: 'NetworkFirst',
            options: { cacheName: 'orders-data', expiration: { maxAgeSeconds: 300 } },
          },
          {
            urlPattern: /^\/api\/admin/,
            handler: 'NetworkFirst',
            options: { cacheName: 'admin-data', expiration: { maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:7071',
    },
  },
});
