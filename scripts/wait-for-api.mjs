const url = process.env.WAIT_FOR_API_URL ?? 'http://127.0.0.1:3001/api/health'
const maxAttempts = Number(process.env.WAIT_FOR_API_MAX ?? 45)

for (let i = 0; i < maxAttempts; i++) {
  try {
    const res = await fetch(url)
    if (res.ok) {
      console.log(`API lista: ${url}`)
      process.exit(0)
    }
  } catch {
    // API aún no disponible
  }
  await new Promise((r) => setTimeout(r, 1000))
}

console.error(`No se pudo conectar al API en ${url} tras ${maxAttempts}s`)
process.exit(1)
