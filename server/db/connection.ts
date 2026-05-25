import mongoose from 'mongoose'

const DEFAULT_URI = 'mongodb://127.0.0.1:27017/rcj_it_manager'

const CONNECT_RETRIES = Number(process.env.MONGODB_CONNECT_RETRIES ?? 30)
const CONNECT_DELAY_MS = Number(process.env.MONGODB_CONNECT_DELAY_MS ?? 2000)

export async function connectDb(uri = process.env.MONGODB_URI ?? DEFAULT_URI) {
  mongoose.set('strictQuery', true)
  let lastErr: unknown
  for (let attempt = 1; attempt <= CONNECT_RETRIES; attempt++) {
    try {
      await mongoose.connect(uri)
      if (attempt > 1) {
        console.log(`MongoDB conectado (intento ${attempt})`)
      }
      return
    } catch (err) {
      lastErr = err
      if (attempt < CONNECT_RETRIES) {
        console.warn(
          `MongoDB no disponible (${attempt}/${CONNECT_RETRIES}), reintento en ${CONNECT_DELAY_MS}ms…`,
        )
        await new Promise((r) => setTimeout(r, CONNECT_DELAY_MS))
      }
    }
  }
  throw lastErr
}

export async function disconnectDb() {
  await mongoose.disconnect()
}
