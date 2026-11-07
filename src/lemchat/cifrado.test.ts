import { describe, expect, it } from 'vitest'
import { crearIdentidad } from './identidad'
import { abrir, sellar } from './cifrado'

describe('cifrado extremo a extremo', () => {
  it('el destinatario abre lo sellado para él, en los dos sentidos', () => {
    const lem = crearIdentidad('Lem')
    const gil = crearIdentidad('Gil')
    const sellado = sellar(lem.clavePrivada, gil.clavePublica, 'Dios te bendiga, hermano')
    expect(abrir(gil.clavePrivada, lem.clavePublica, sellado)).toBe('Dios te bendiga, hermano')
    const respuesta = sellar(gil.clavePrivada, lem.clavePublica, 'Amén')
    expect(abrir(lem.clavePrivada, gil.clavePublica, respuesta)).toBe('Amén')
  })

  it('un tercero no puede abrir el mensaje', () => {
    const lem = crearIdentidad('Lem')
    const gil = crearIdentidad('Gil')
    const luis = crearIdentidad('Luis')
    const sellado = sellar(lem.clavePrivada, gil.clavePublica, 'solo para Gil')
    expect(abrir(luis.clavePrivada, lem.clavePublica, sellado)).toBeNull()
    // Ni siquiera fingiendo ser el remitente equivocado:
    expect(abrir(gil.clavePrivada, luis.clavePublica, sellado)).toBeNull()
  })

  it('lo alterado no abre', () => {
    const lem = crearIdentidad('Lem')
    const gil = crearIdentidad('Gil')
    const sellado = sellar(lem.clavePrivada, gil.clavePublica, 'íntegro')
    const tocado = sellado.slice(0, -2) + (sellado.endsWith('AA') ? 'BB' : 'AA')
    expect(abrir(gil.clavePrivada, lem.clavePublica, tocado)).toBeNull()
    expect(abrir(gil.clavePrivada, lem.clavePublica, 'basura')).toBeNull()
  })
})
