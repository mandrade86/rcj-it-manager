import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        timeout: 90_000,
        proxyTimeout: 90_000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.warn('[vite proxy]', err.message)
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(
                JSON.stringify({
                  error:
                    'API no disponible (502). Ejecuta: npm run dev:clean && npm run dev',
                }),
              )
            }
          })
        },
      },
    },
  },
})
