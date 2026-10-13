import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig(({ command, mode }) => {
  const fileEnv = loadEnv(mode, __dirname, 'VITE_')
  const apiUrl = process.env.VITE_API_URL || fileEnv.VITE_API_URL

  if (command === 'build' && !apiUrl) {
    throw new Error(
      'VITE_API_URL is required for builds so the bundle never falls back to /api.\n' +
        'Set it per environment in Vercel: Preview -> dev API, Production -> prod API.'
    )
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectRegister: 'script-defer',
        injectManifest: { injectionPoint: undefined },
        manifest: {
          name: 'Bolão Brasileirão',
          short_name: 'Bolão',
          lang: 'pt-BR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#0f172a',
          theme_color: '#0f172a',
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    base: process.env.VITE_BASE_PATH || '/',
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      host: true,
      allowedHosts: ['.ts.net'],
      proxy: {
        '/api': {
          target: apiUrl || 'http://localhost:3333',
          changeOrigin: true,
        },
      },
    },
  }
})
