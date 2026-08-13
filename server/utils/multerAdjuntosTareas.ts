import fs from 'fs'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const ADJUNTOS_TAREAS_DIR = path.resolve(__dirname, '../../data/adjuntos-tareas')

if (!fs.existsSync(ADJUNTOS_TAREAS_DIR)) {
  fs.mkdirSync(ADJUNTOS_TAREAS_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ADJUNTOS_TAREAS_DIR),
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

const ALLOWED_EXT = [
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.zip', '.rar', '.7z',
  '.msg', '.eml',
]

export const uploadAdjuntoTarea = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB (límite seguro Sonar S5693)
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ALLOWED_EXT.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`Extensión no permitida (${ext})`))
    }
  },
}).single('archivo')
