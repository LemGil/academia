import { describe, expect, it } from 'vitest'
import { crearIdentidad } from './identidad'
import { crearSelloTexto, leerSello, selloEsValido } from './sello'

describe('sello del encuentro', () => {
  it('el maestro genera y el alumno verifica: sello válido para su academia', () => {
    const maestro = crearIdentidad('LemGil Apóstol')
    const texto = crearSelloTexto('lemgil-14', maestro)
    const sello = leerSello(texto)
    expect(sello).not.toBeNull()
    expect(sello!.academiaId).toBe('lemgil-14')
    expect(selloEsValido(sello!, maestro.clavePublica)).toBe(true)
  })

  it('cada generación es un encuentro distinto (marca única)', () => {
    const maestro = crearIdentidad('LemGil Apóstol')
    const a = leerSello(crearSelloTexto('lemgil-14', maestro))!
    const b = leerSello(crearSelloTexto('lemgil-14', maestro))!
    expect(a.encuentro).not.toBe(b.encuentro)
  })

  it('un impostor no puede sellar: su firma no es la del maestro de confianza', () => {
    const maestro = crearIdentidad('LemGil Apóstol')
    const impostor = crearIdentidad('Impostor')
    const sello = leerSello(crearSelloTexto('lemgil-14', impostor))!
    expect(selloEsValido(sello, maestro.clavePublica)).toBe(false)
  })

  it('sin maestro de confianza registrado, ningún sello vale', () => {
    const maestro = crearIdentidad('LemGil Apóstol')
    const sello = leerSello(crearSelloTexto('lemgil-14', maestro))!
    expect(selloEsValido(sello, null)).toBe(false)
  })

  it('un sello manipulado (otra academia con la misma firma) no verifica', () => {
    const maestro = crearIdentidad('LemGil Apóstol')
    const sello = leerSello(crearSelloTexto('lemgil-14', maestro))!
    const manipulado = { ...sello, academiaId: 'lemgil-99' }
    expect(selloEsValido(manipulado, maestro.clavePublica)).toBe(false)
  })

  it('texto que no es un sello → null', () => {
    expect(leerSello('hola, no soy un sello')).toBeNull()
    expect(leerSello('')).toBeNull()
    expect(leerSello('lemsello1:@@@')).toBeNull()
  })
})
