import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-32.png'],
      manifest: {
        id: '/',
        name: 'ASSIGNA',
        short_name: 'ASSIGNA',
        description: 'Automated class scheduling for Gordon College.',
        lang: 'en',
        categories: ['education', 'productivity'],
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#16a34a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: [
          '**/gordon college building-*.png',
          '**/ASSIGNAV2-*.png'
        ],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // 8 MiB — our bundle has grown > 4 MiB
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallbackDenylist: [
          /^\/__\//,
          /^\/robots\.txt$/,
          /^\/sitemap\.xml$/,
          /^\/google[a-z0-9]+\.html$/
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com/,
            handler: 'NetworkFirst',
            options: { cacheName: 'firestore-cache' }
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ],
  assetsInclude: ['**/*.xlsx'],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})