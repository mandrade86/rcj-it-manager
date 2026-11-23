import { describe, expect, it } from 'vitest'
import { detectarIntent } from './pmoIntents.js'

describe('detectarIntent', () => {
  it('vacío o ayuda → ayuda', () => {
    expect(detectarIntent('').intent).toBe('ayuda')
    expect(detectarIntent('ayuda').intent).toBe('ayuda')
    expect(detectarIntent('help').intent).toBe('ayuda')
  })

  it('portafolio / jefatura', () => {
    expect(detectarIntent('ver portafolio').intent).toBe('portafolio_resumen')
    expect(detectarIntent('resumen jefatura').intent).toBe('portafolio_resumen')
  })

  it('riesgos y atrasados', () => {
    expect(detectarIntent('mis riesgos').intent).toBe('personal_riesgos')
    expect(detectarIntent('tareas atrasadas').intent).toBe('personal_atrasados')
    expect(detectarIntent('vencidos').intent).toBe('personal_atrasados')
  })

  it('proyecto por código', () => {
    const r = detectarIntent('proyecto INV-001')
    expect(r.intent).toBe('proyecto_detalle')
    expect(r.query?.toLowerCase()).toContain('inv')
  })

  it('resumen personal', () => {
    expect(detectarIntent('resumen').intent).toBe('personal_resumen')
    expect(detectarIntent('hola').intent).toBe('personal_resumen')
  })

  it('desconocido', () => {
    expect(detectarIntent('xyz no tiene sentido').intent).toBe('desconocido')
  })
})
