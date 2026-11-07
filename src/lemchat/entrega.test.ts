import { describe, expect, it } from 'vitest'
import { crearSobrePaquete, decidirEntrega, leerSobre, sobreEsAutentico } from './entrega'
import { crearIdentidad } from './identidad'

const PAQUETE = JSON.stringify({
  tipo: 'paquete-academia',
  formato: 1,
  generada: '2026-11-06',
  academia: {
    id: 'lemgil-14',
    numero: 'Nº 14',
    titulo: 'Descodificando la Prueba',
    autor: 'LemGil Apóstol',
    codigos: [
      { id: 'lemgil-14-c1', titulo: 'Código 1', subtitulo: '', cuerpo: 'Texto del código.' },
    ],
    cierre: '',
  },
})

describe('entrega firmada de paquetes', () => {
  const maestro = crearIdentidad('LemGil Apóstol')

  it('sobre bien firmado por el maestro → archivar, con la academia validada', () => {
    const sobre = crearSobrePaquete(PAQUETE, 'lemgil-14', maestro.clavePublica, maestro.clavePrivada)
    expect(sobreEsAutentico(sobre)).toBe(true)
    const decision = decidirEntrega(JSON.stringify(sobre), maestro.clavePublica)
    expect(decision.accion).toBe('archivar')
    if (decision.accion === 'archivar') {
      expect(decision.academia.id).toBe('lemgil-14')
      expect(decision.academia.codigos).toHaveLength(1)
    }
  })

  it('sin maestro agregado todavía → a revisar, nunca archivar en silencio', () => {
    const sobre = crearSobrePaquete(PAQUETE, 'lemgil-14', maestro.clavePublica, maestro.clavePrivada)
    expect(decidirEntrega(JSON.stringify(sobre), null).accion).toBe('revisar')
  })

  it('firmado por OTRA llave → a revisar', () => {
    const otro = crearIdentidad('Impostor')
    const sobre = crearSobrePaquete(PAQUETE, 'lemgil-14', otro.clavePublica, otro.clavePrivada)
    expect(decidirEntrega(JSON.stringify(sobre), maestro.clavePublica).accion).toBe('revisar')
  })

  it('paquete alterado después de firmar → la firma no verifica → a revisar', () => {
    const sobre = crearSobrePaquete(PAQUETE, 'lemgil-14', maestro.clavePublica, maestro.clavePrivada)
    const tocado = { ...sobre, paqueteTexto: sobre.paqueteTexto.replace('Prueba', 'Falsa') }
    expect(sobreEsAutentico(tocado)).toBe(false)
    expect(decidirEntrega(JSON.stringify(tocado), maestro.clavePublica).accion).toBe('revisar')
  })

  it('basura o paquete dañado → rechazar', () => {
    expect(decidirEntrega('no es json', maestro.clavePublica).accion).toBe('rechazar')
    expect(decidirEntrega('{"tipo":"otra-cosa"}', maestro.clavePublica).accion).toBe('rechazar')
    const sobreMalo = crearSobrePaquete('{"academia":123}', 'lemgil-14', maestro.clavePublica, maestro.clavePrivada)
    expect(decidirEntrega(JSON.stringify(sobreMalo), maestro.clavePublica).accion).toBe('rechazar')
  })

  it('el id del sobre no coincide con el del paquete → rechazar', () => {
    const sobre = crearSobrePaquete(PAQUETE, 'lemgil-99', maestro.clavePublica, maestro.clavePrivada)
    // La firma cubre el id declarado; aun así el paquete dentro dice lemgil-14.
    expect(decidirEntrega(JSON.stringify(sobre), maestro.clavePublica).accion).toBe('rechazar')
  })

  it('leerSobre tolera entradas dañadas', () => {
    expect(leerSobre('')).toBeNull()
    expect(leerSobre('{}')).toBeNull()
    expect(leerSobre('{"tipo":"paquete-lemchat","formato":2}')).toBeNull()
  })
})
