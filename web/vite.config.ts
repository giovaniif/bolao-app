import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
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
    plugins: [react(), tailwindcss()],
    base: process.env.VITE_BASE_PATH || '/',
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      // Bind all interfaces (not just loopback) so the dev server is reachable
      // over Tailscale from other devices on the tailnet.
      host: true,
      // Allows access via Tailscale MagicDNS hostnames (e.g. host.tail914724.ts.net)
      // for testing the dev server from other devices on the tailnet.
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
