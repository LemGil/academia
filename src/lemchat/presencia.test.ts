import { describe, expect, it } from 'vitest'
import { MARGEN_PRESENCIA_MS, RegistroPresencia } from './presencia'

describe('presencia con caducidad', () => {
  it('un par se ve presente dentro del margen y caduca fuera de él', () => {
    const r = new RegistroPresencia()
    const t0 = 1_000_000
    r.tocar('ep1', 'Gil', t0, 'clave-gil')
    expect(r.presentes(t0 + 1000)).toHaveLength(1)
    expect(r.presentes(t0 + MARGEN_PRESENCIA_MS + 1)).toHaveLength(0)
    // El registro conserva la última vez (para «visto hace X»), no lo borra:
    expect(r.todos()).toHaveLength(1)
    expect(r.todos()[0].vistoEn).toBe(t0)
  })

  it('el saludo completa nombre y clave sin perder la última vez', () => {
    const r = new RegistroPresencia()
    r.tocar('ep1', 'desconocido', 100)
    r.tocar('ep1', '', 200, 'clave-x')
    const par = r.porEndpoint('ep1')
    expect(par?.clavePublica).toBe('clave-x')
    expect(par?.vistoEn).toBe(200)
    expect(r.porClave('clave-x', 300)?.endpointId).toBe('ep1')
  })

  it('olvidar retira al par al instante', () => {
    const r = new RegistroPresencia()
    r.tocar('ep1', 'Gil', 100)
    r.olvidar('ep1')
    expect(r.presentes(200)).toHaveLength(0)
    expect(r.todos()).toHaveLength(0)
  })
})
