// Política de vías (v1.7.2): internet manda; la cercanía solo trabaja
// cuando internet no responde (en modo automático).
import { describe, expect, it } from 'vitest'
import { decidirCercania } from './cercania'

describe('decidirCercania', () => {
  it('auto + internet ok: la cercanía no gira (se apaga si estaba)', () => {
    expect(decidirCercania('auto', 'ok', false)).toBe('nada')
    expect(decidirCercania('auto', 'ok', true)).toBe('detener')
  })

  it('auto + internet caído: la cercanía es la vía (se enciende)', () => {
    expect(decidirCercania('auto', 'error', false)).toBe('iniciar')
    expect(decidirCercania('auto', 'error', true)).toBe('nada')
  })

  it('auto + buzón sin configurar: no hay internet posible, cercanía', () => {
    expect(decidirCercania('auto', 'sin-configurar', false)).toBe('iniciar')
    expect(decidirCercania('auto', 'sin-configurar', true)).toBe('nada')
  })

  it('siempre: encendida haya o no internet', () => {
    expect(decidirCercania('siempre', 'ok', false)).toBe('iniciar')
    expect(decidirCercania('siempre', 'error', false)).toBe('iniciar')
    expect(decidirCercania('siempre', 'ok', true)).toBe('nada')
  })

  it('nunca: apagada siempre', () => {
    expect(decidirCercania('nunca', 'error', true)).toBe('detener')
    expect(decidirCercania('nunca', 'error', false)).toBe('nada')
    expect(decidirCercania('nunca', 'ok', false)).toBe('nada')
  })
})
