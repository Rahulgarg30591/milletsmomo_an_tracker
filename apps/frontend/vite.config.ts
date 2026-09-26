import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const API_PROXY_TARGET = process.env.VITE_API_PROXY || 'http://localhost:7071';

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
        // Excluded from precache, not from the build: xlsx (~277 kB) and
        // recharts (~366 kB) are admin-only, so precaching them made every
        // staff phone download ~640 kB it never executes. They are fetched on
        // demand and then runtime-cached below.
        globIgnores: ['**/vendor-xlsx-*.js', '**/vendor-charts-*.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/assets\/vendor-(xlsx|charts)-.*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'heavy-vendor-chunks',
              expiration: { maxAgeSeconds: 86400 * 30, maxEntries: 8 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|gif|ico|woff2?)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'static-assets', expiration: { maxAgeSeconds: 86400 * 30 } },
          },
          // Matched on the path: a RegExp is tested against the full URL, so the
          // old /^\/api\/menu/ never matched and the menu was never cached.
          // Stale-while-revalidate serves the cached menu at once (and offline)
          // and refreshes it, so price changes reach phones on the next open.
          // Other API responses are deliberately not cached by the worker:
          // they are per-user and the device may be shared.
          {
            urlPattern: ({ url }) => url.pathname === '/api/menu',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'menu-data',
              expiration: { maxAgeSeconds: 86400 * 7 },
              cacheableResponse: { statuses: [200] },
            },
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
          // Kept a named chunk so the precache exclusion can match it by name.
          'vendor-xlsx': ['xlsx'],
          // lucide-react is left out on purpose: as one chunk it forced every
          // icon any page uses onto the first screen; unchunked, each route
          // gets only its own icons.
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
  // The dev server and `vite preview` both forward /api to the backend. The
  // target is configurable so the browser tests can run their own backend on
  // another port without colliding with a development one.
  server: { proxy: { '/api': API_PROXY_TARGET } },
  preview: { proxy: { '/api': API_PROXY_TARGET } },
});