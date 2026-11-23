import { describe, expect, it } from 'vitest'
import { puedePmoPersonal, puedePmoPortafolio } from './pmoPermisos.js'

describe('puedePmoPersonal', () => {
  it('permite con *', () => {
    expect(puedePmoPersonal(['*'])).toBe(true)
  })

  it('permite con pmo:personal o proyectos:ver o dashboard:ver', () => {
    expect(puedePmoPersonal(['pmo:personal'])).toBe(true)
    expect(puedePmoPersonal(['proyectos:ver'])).toBe(true)
    expect(puedePmoPersonal(['dashboard:ver'])).toBe(true)
  })

  it('niega sin permisos relevantes', () => {
    expect(puedePmoPersonal([])).toBe(false)
    expect(puedePmoPersonal(['gastos:ver'])).toBe(false)
  })
})

describe('puedePmoPortafolio', () => {
  it('permite con * o pmo:portafolio o proyectos:ver-todos', () => {
    expect(puedePmoPortafolio(['*'])).toBe(true)
    expect(puedePmoPortafolio(['pmo:portafolio'])).toBe(true)
    expect(puedePmoPortafolio(['proyectos:ver-todos'])).toBe(true)
  })

  it('niega con solo permiso personal', () => {
    expect(puedePmoPortafolio(['pmo:personal'])).toBe(false)
  })
})
