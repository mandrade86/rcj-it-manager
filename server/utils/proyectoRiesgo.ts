import { differenceInCalendarDays } from 'date-fns'

export type RiesgoProyecto = {
  nivel: 'Alto' | 'Medio' | 'Bajo' | 'Sin fecha'
  motivo: string
  color: string
}

export type ProyectoRiesgoInput = {
  estado: string
  fecha_inicio?: Date | string | null
  fecha_fin?: Date | string | null
  porcentaje_avance?: number
  createdAt?: Date | string | null
}

export type TareaRiesgoInput = {
  estado: string
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function toDate(raw: Date | string): Date {
  if (raw instanceof Date) return raw
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

const COLOR_ALTO = '#C00000'
const COLOR_MEDIO = '#F59E0B'
const COLOR_BAJO = '#70AD47'
const COLOR_SIN_FECHA = '#6B7280'

/**
 * Calcula el nivel de riesgo de un proyecto según fechas, avance y tareas bloqueadas.
 */
export function calcularRiesgo(
  proyecto: ProyectoRiesgoInput,
  tareas: TareaRiesgoInput[],
): RiesgoProyecto {
  const avance = proyecto.porcentaje_avance ?? 0
  const { estado } = proyecto

  if (estado === 'Completado' || estado === 'Cancelado') {
    return { nivel: 'Bajo', motivo: estado, color: COLOR_BAJO }
  }

  if (estado === 'Bloqueado') {
    return { nivel: 'Alto', motivo: 'Proyecto bloqueado', color: COLOR_ALTO }
  }

  if (proyecto.fecha_fin == null || proyecto.fecha_fin === '') {
    return {
      nivel: 'Sin fecha',
      motivo: 'Sin fecha de fin definida',
      color: COLOR_SIN_FECHA,
    }
  }

  const hoy = new Date()
  const fin = toDate(proyecto.fecha_fin)
  const diasRestantes = differenceInCalendarDays(fin, hoy)

  if (diasRestantes < 0 && avance < 100) {
    return {
      nivel: 'Alto',
      motivo: `Venció hace ${Math.abs(diasRestantes)} días con ${avance}% completado`,
      color: COLOR_ALTO,
    }
  }

  const inicioRaw = proyecto.fecha_inicio ?? proyecto.createdAt ?? hoy
  const inicio = toDate(inicioRaw)
  const diasTranscurridos = differenceInCalendarDays(hoy, inicio)
  const duracionTotal = Math.max(1, differenceInCalendarDays(fin, inicio))
  const avanceEsperado = clamp((diasTranscurridos / duracionTotal) * 100, 0, 100)
  const gap = avanceEsperado - avance
  const tareasBloqueadas = tareas.filter((t) => t.estado === 'Bloqueado').length

  if (gap > 25) {
    return {
      nivel: 'Alto',
      motivo: `Avance ${Math.round(gap)}% por debajo del esperado`,
      color: COLOR_ALTO,
    }
  }
  if (tareasBloqueadas >= 2) {
    return {
      nivel: 'Alto',
      motivo: `${tareasBloqueadas} tareas bloqueadas`,
      color: COLOR_ALTO,
    }
  }
  if (diasRestantes <= 7) {
    return {
      nivel: 'Alto',
      motivo:
        diasRestantes <= 0
          ? `Vence hoy con ${avance}% completado`
          : `Vence en ${diasRestantes} días`,
      color: COLOR_ALTO,
    }
  }

  if (gap > 10) {
    return {
      nivel: 'Medio',
      motivo: `Avance ${Math.round(gap)}% por debajo del esperado`,
      color: COLOR_MEDIO,
    }
  }
  if (tareasBloqueadas >= 1) {
    return {
      nivel: 'Medio',
      motivo: `${tareasBloqueadas} tarea${tareasBloqueadas === 1 ? '' : 's'} bloqueada${tareasBloqueadas === 1 ? '' : 's'}`,
      color: COLOR_MEDIO,
    }
  }
  if (diasRestantes <= 21) {
    return {
      nivel: 'Medio',
      motivo: `Vence en ${diasRestantes} días`,
      color: COLOR_MEDIO,
    }
  }

  return {
    nivel: 'Bajo',
    motivo: 'Proyecto dentro de lo esperado',
    color: COLOR_BAJO,
  }
}
