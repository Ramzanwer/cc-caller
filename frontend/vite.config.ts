import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: null,
      registerType: 'prompt',
      pwaAssets: {
        disabled: false,
        config: true
      },
      manifest: {
        name: 'cc-caller',
        short_name: 'cc-caller',
        description: 'Receive calls from Claude Code',
        theme_color: '#1e1b4b',
        background_color: '#0b1020',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      // Note: runtime caching is handled by the injected SW (injectManifest strategy).
    })
  ],
  server: {
    port: 3000,
    open: true
  }
});
