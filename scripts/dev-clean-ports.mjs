import { execSync } from 'child_process'

const ports = (process.env.DEV_CLEAN_PORTS ?? '3001,5173,5174').split(',').map((p) => p.trim())
const pids = new Set()

for (const port of ports) {
  if (!port) continue
  try {
    const out = execSync(`netstat -ano | findstr ":${port}" | findstr LISTENING`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    for (const line of out.split('\n')) {
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid)
    }
  } catch {
    // Sin procesos en ese puerto
  }
}

if (pids.size === 0) {
  console.log('Puertos libres:', ports.join(', '))
  process.exit(0)
}

for (const pid of pids) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
    console.log(`Detenido proceso ${pid} (puertos ${ports.join(', ')})`)
  } catch {
    // Ya terminado
  }
}
