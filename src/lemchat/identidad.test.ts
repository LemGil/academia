import { describe, expect, it } from 'vitest'
import {
  clavePublicaDe,
  codigoDeContacto,
  crearIdentidad,
  firmar,
  leerCodigoDeContacto,
  verificar,
} from './identidad'
import { base64UrlABytes, bytesABase64Url, bytesAHex, textoABytes } from './util'

describe('identidad Ed25519', () => {
  it('cumple el vector oficial RFC 8032 (clave, pública y firma de mensaje vacío)', () => {
    const semillaHex = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60'
    const publicaHex = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a'
    const firmaHex =
      'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155' +
      '5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b'
    const privada = bytesABase64Url(Buffer.from(semillaHex, 'hex'))
    expect(bytesAHex(base64UrlABytes(clavePublicaDe(privada)))).toBe(publicaHex)
    expect(bytesAHex(base64UrlABytes(firmar(privada, new Uint8Array(0))))).toBe(firmaHex)
  })

  it('firmar y verificar: ida y vuelta, y rechaza lo alterado', () => {
    const yo = crearIdentidad('Lem')
    const firma = firmar(yo.clavePrivada, textoABytes('hola'))
    expect(verificar(yo.clavePublica, firma, textoABytes('hola'))).toBe(true)
    expect(verificar(yo.clavePublica, firma, textoABytes('hola!'))).toBe(false)
    expect(verificar(yo.clavePublica, 'firma-basura', textoABytes('hola'))).toBe(false)
    expect(verificar('clave-basura', firma, textoABytes('hola'))).toBe(false)
  })

  it('código de contacto: ida y vuelta, con y sin marca de maestro', () => {
    const maestro = crearIdentidad('LemGil Apóstol')
    const codigo = codigoDeContacto(maestro, true)
    expect(leerCodigoDeContacto(codigo)).toEqual({
      nombre: 'LemGil Apóstol',
      clavePublica: maestro.clavePublica,
      esMaestro: true,
    })
    const normal = codigoDeContacto(maestro)
    expect(leerCodigoDeContacto(normal)?.esMaestro).toBe(false)
  })

  it('código de contacto: la basura no entra', () => {
    expect(leerCodigoDeContacto('')).toBeNull()
    expect(leerCodigoDeContacto('lemchat1:%%%')).toBeNull()
    expect(leerCodigoDeContacto('otra-cosa')).toBeNull()
  })
})

describe('código del maestro impreso por el script (forma antigua)', () => {
  it('acepta el campo «maestro: true» de los códigos ya repartidos', () => {
    const maestro = crearIdentidad('LemGil Apóstol')
    const antiguo =
      'lemchat1:' +
      bytesABase64Url(
        textoABytes(
          JSON.stringify({
            nombre: maestro.nombre,
            clavePublica: maestro.clavePublica,
            maestro: true,
          }),
        ),
      )
    expect(leerCodigoDeContacto(antiguo)).toEqual({
      nombre: 'LemGil Apóstol',
      clavePublica: maestro.clavePublica,
      esMaestro: true,
    })
  })
})
