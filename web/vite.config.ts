import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_PATH || '/',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    // Allows access via Tailscale MagicDNS hostnames (e.g. host.tail914724.ts.net)
    // for testing the dev server from other devices on the tailnet.
    allowedHosts: ['.ts.net'],
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
})
