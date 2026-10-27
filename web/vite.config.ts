import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const logic = fileURLToPath(new URL('../supabase/functions/_shared/logic', import.meta.url));

export default defineConfig({
  resolve: { alias: { '@logic': logic } },
  server: { fs: { allow: ['..'] } },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'DINEAMITE',
        short_name: 'DINEAMITE',
        description: 'Tonight’s dinner, decided together.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F8F5F0',
        theme_color: '#F8F5F0',
        // Android can share links straight into the importer (iOS has no web share target).
        share_target: { action: '/recipes/new', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'] },
      devOptions: { enabled: false },
    }),
  ],
});
