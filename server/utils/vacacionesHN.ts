/**
 * Cálculo de derechos de vacaciones según el Código del Trabajo de Honduras.
 *
 * Artículo 346 — Días hábiles de vacaciones por año cumplido de servicio
 * continuo con el mismo patrono:
 *
 *   Después de 1 año de servicio:  10 días hábiles
 *   Después de 2 años:             12 días hábiles
 *   Después de 3 años:             15 días hábiles
 *   Después de 4 años en adelante: 20 días hábiles
 *
 * Las vacaciones se gozan en días HÁBILES (lunes a viernes; sábados, domingos
 * y feriados nacionales no se cuentan).
 *
 * Notas:
 *   - El derecho se devenga al cumplir el año (artículo 345). Si el colaborador
 *     no ha cumplido el primer año, los días ganados son proporcionales pero
 *     legalmente solo pueden gozarse cuando se cumpla el año.
 *   - Si la empresa permite vacaciones proporcionales antes del año, se puede
 *     usar `diasProporcionalesAnioActual` como referencia.
 */

export type DiasPorAnio =
  | { antiguedadAnios: 0 | 1; dias: 10 }
  | { antiguedadAnios: 2; dias: 12 }
  | { antiguedadAnios: 3; dias: 15 }
  | { antiguedadAnios: 4; dias: 20 }

/**
 * Devuelve los días hábiles de derecho según los años cumplidos al patrono.
 *
 * @param aniosCumplidos años COMPLETOS de servicio (entero, piso). Si es 0
 *   (no ha cumplido el primer año todavía) devuelve 10 como base proyectada.
 */
export function diasDerechoPorAntiguedad(aniosCumplidos: number): number {
  const a = Math.max(0, Math.floor(aniosCumplidos))
  if (a >= 4) return 20
  if (a === 3) return 15
  if (a === 2) return 12
  // 0 o 1 año cumplido → 10 días (al cumplir el primer año los recibe)
  return 10
}

export type VacacionesCalculo = {
  fechaIngreso: string | null
  fechaCorte: string
  aniosServicio: number
  mesesServicio: number
  diasDerechoPorAnioActual: number
  /** Días devengados proporcionalmente desde el último aniversario hasta la fecha de corte. */
  diasProporcionalesAnioActual: number
  /**
   * Días totales acumulados según la ley desde el ingreso (suma de los
   * derechos de cada año cumplido + proporcional del año en curso).
   */
  diasAcumuladosTotales: number
  /** Días registrados como tomados/gozados a la fecha de corte. */
  diasGozados: number
  /** Días que el empleado puede tomar = acumulados − gozados. */
  diasDisponibles: number
  /** Fecha en la que cumplirá el próximo aniversario laboral. */
  proximoAniversario: string | null
  /** Días que recibirá en su próximo aniversario. */
  proximoDerecho: number
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addYears(d: Date, n: number): Date {
  const x = new Date(d)
  x.setFullYear(x.getFullYear() + n)
  return x
}

/**
 * Suma de derechos completos por cada año cumplido (en orden creciente).
 * Año 1: 10 / Año 2: 12 / Año 3: 15 / Año 4+: 20.
 */
function sumaDerechosAniosCompletos(aniosCompletos: number): number {
  if (aniosCompletos <= 0) return 0
  let total = 0
  for (let i = 1; i <= aniosCompletos; i++) {
    if (i === 1) total += 10
    else if (i === 2) total += 12
    else if (i === 3) total += 15
    else total += 20
  }
  return total
}

export function calcularVacacionesHN(
  fechaIngreso: Date | string | null | undefined,
  fechaCorte: Date | string = new Date(),
  diasGozados = 0,
): VacacionesCalculo {
  const corte = startOfDay(typeof fechaCorte === 'string' ? new Date(fechaCorte) : fechaCorte)

  if (!fechaIngreso) {
    return {
      fechaIngreso: null,
      fechaCorte: corte.toISOString(),
      aniosServicio: 0,
      mesesServicio: 0,
      diasDerechoPorAnioActual: 0,
      diasProporcionalesAnioActual: 0,
      diasAcumuladosTotales: 0,
      diasGozados,
      diasDisponibles: 0,
      proximoAniversario: null,
      proximoDerecho: 10,
    }
  }

  const ingreso = startOfDay(typeof fechaIngreso === 'string' ? new Date(fechaIngreso) : fechaIngreso)

  // Antigüedad
  const msDia = 24 * 60 * 60 * 1000
  const diasServicio = Math.max(0, Math.floor((corte.getTime() - ingreso.getTime()) / msDia))
  const aniosServicio = Math.floor(diasServicio / 365.25)
  const mesesServicio = Math.floor((diasServicio % 365.25) / 30.4375)

  // Próximo aniversario laboral
  let proximoAniv = addYears(ingreso, aniosServicio + 1)
  if (proximoAniv.getTime() <= corte.getTime()) {
    proximoAniv = addYears(ingreso, aniosServicio + 2)
  }

  // Días por año actual (año en curso entre aniversarios)
  // Durante el año 1 (todavía no cumple el primer aniversario) el derecho que
  // recibirá al cumplir el año es de 10 días.
  const proximoDerecho = diasDerechoPorAntiguedad(aniosServicio + 1)
  const diasDerechoPorAnioActual = proximoDerecho

  // Proporcional del año en curso
  const ultimoAniv = aniosServicio === 0 ? ingreso : addYears(ingreso, aniosServicio)
  const diasDesdeUltimoAniv = Math.max(
    0,
    Math.floor((corte.getTime() - ultimoAniv.getTime()) / msDia),
  )
  const fraccionAnio = Math.min(1, diasDesdeUltimoAniv / 365.25)
  const diasProporcionalesAnioActual = Math.round(diasDerechoPorAnioActual * fraccionAnio * 100) / 100

  // Acumulado total (años completos + proporcional del año en curso)
  const acumuladoCompleto = sumaDerechosAniosCompletos(aniosServicio)
  const diasAcumuladosTotales = Math.round((acumuladoCompleto + diasProporcionalesAnioActual) * 100) / 100

  const diasDisponibles = Math.max(0, Math.round((diasAcumuladosTotales - diasGozados) * 100) / 100)

  return {
    fechaIngreso: ingreso.toISOString(),
    fechaCorte: corte.toISOString(),
    aniosServicio,
    mesesServicio,
    diasDerechoPorAnioActual,
    diasProporcionalesAnioActual,
    diasAcumuladosTotales,
    diasGozados,
    diasDisponibles,
    proximoAniversario: proximoAniv.toISOString(),
    proximoDerecho,
  }
}

/**
 * Cuenta días HÁBILES entre dos fechas (lun-vie). Inclusive en ambos extremos.
 * Útil para validar/calcular los días que un periodo de vacaciones consumió.
 *
 * Nota: no descuenta feriados nacionales — en el formulario el usuario puede
 * ajustar manualmente si una semana incluye un feriado.
 */
export function diasHabilesEntre(desde: Date | string, hasta: Date | string): number {
  const a = startOfDay(typeof desde === 'string' ? new Date(desde) : desde)
  const b = startOfDay(typeof hasta === 'string' ? new Date(hasta) : hasta)
  if (b.getTime() < a.getTime()) return 0
  let dias = 0
  const cursor = new Date(a)
  while (cursor.getTime() <= b.getTime()) {
    const dow = cursor.getDay() // 0=dom, 6=sáb
    if (dow !== 0 && dow !== 6) dias++
    cursor.setDate(cursor.getDate() + 1)
  }
  return dias
}
