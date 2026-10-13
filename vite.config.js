import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Il form-funzione serve solo per questo: bare `process.env` qui dentro
  // NON include .env/.env.local (Vite li carica dopo aver letto il config),
  // va letto esplicitamente con loadEnv (terzo argomento '' = tutte le
  // variabili, non solo quelle con prefisso VITE_).
  const env = loadEnv(mode, process.cwd(), '')
  return {
    define: {
      // Versione dell'app (da package.json), mostrata in Impostazioni.
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    // Sviluppo: /api/ va al frontend Docker (nginx -> PocketBase interno), avviato
    // con `docker compose up -d`; VITE_DEV_API per usare un altro indirizzo
    // (vedi .env.local, non committato).
    server: {
      proxy: {
        '/api': env.VITE_DEV_API || 'http://localhost:8973',
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'MyJournal — Diario personale',
          short_name: 'MyJournal',
          description: 'Diario personale: mese, giorno e note con umore e immagini.',
          lang: 'it',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#dbd1bd',
          theme_color: '#dbd1bd',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
          // API e admin UI di PocketBase sono sulla stessa origin dell'app
          // (proxy nginx): non devono mai ricevere la pagina index.html.
          navigateFallbackDenylist: [/^\/api\//, /^\/_\//, /^\/mood-lab\.html/],
          // Le altre chiamate API di PocketBase non passano dalla cache del
          // service worker: i dati offline stanno in IndexedDB (src/lib/cache.js).
          runtimeCaching: [
            // Miniature delle immagini: prima dalla cache locale (riempita da
            // src/lib/prefetch.js), così le foto si vedono anche con poca rete.
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/api/files/') &&
                url.searchParams.get('thumb') === '300x300',
              handler: 'CacheFirst',
              options: {
                cacheName: 'myjournal-thumbs-v2',
                // solo risposte "vere" (200): quelle opache (status 0) il browser
                // le conteggia ~7 MB l'una, gonfiando lo spazio usato.
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
  }
})
