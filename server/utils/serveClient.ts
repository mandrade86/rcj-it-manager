import fs from 'fs'
import path from 'path'
import type { Express } from 'express'
import express from 'express'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist')

/** Sirve el build de Vite y fallback SPA (React Router). */
export function mountClientApp(app: Express): boolean {
  if (!fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    return false
  }
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }))
  // No devolver index.html para /assets/* (evita 500/MIME raro si falta un chunk)
  app.get(/^\/assets\/.+/, (_req, res) => {
    res.status(404).type('text/plain').send('Asset no encontrado. Vuelva a desplegar con --build.')
  })
  app.get(/^(?!\/api\/)(?!\/assets\/).*/, (_req, res, next) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'), (err) => {
      if (err) next(err)
    })
  })
  return true
}
