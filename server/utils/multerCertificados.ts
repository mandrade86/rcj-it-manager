import fs from 'fs'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const CERTS_DIR = path.resolve(__dirname, '../../data/certificados')

if (!fs.existsSync(CERTS_DIR)) {
  fs.mkdirSync(CERTS_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CERTS_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now()
    const ext = path.extname(file.originalname)
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9_\-]/gi, '_')
      .slice(0, 60)
    cb(null, `${ts}_${base}${ext}`)
  },
})

export const uploadCertificado = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos PDF, PNG o JPG'))
    }
  },
}).single('certificado')
