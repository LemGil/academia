// Identidad LemChat: Ed25519 en el dispositivo, sin cuentas (diseño §4).
// Firmar y verificar se usa para dos cosas: autenticar cada fila del buzón
// y — lo decisivo — decidir si un paquete de enseñanza se archiva solo
// (solo si lo firmó la llave del maestro).

import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2'
import { base64UrlABytes, bytesABase64Url, textoABytes } from './util'
import type { Identidad } from './tipos'

// noble ed25519 en modo síncrono (la app y las pruebas lo usan así).
ed.etc.sha512Sync = (...mensajes) => sha512(ed.etc.concatBytes(...mensajes))

export function generarClavePrivada(): string {
  return bytesABase64Url(ed.utils.randomPrivateKey())
}

export function clavePublicaDe(clavePrivadaB64: string): string {
  return bytesABase64Url(ed.getPublicKey(base64UrlABytes(clavePrivadaB64)))
}

export function crearIdentidad(nombre: string): Identidad {
  const clavePrivada = generarClavePrivada()
  return {
    nombre: nombre.trim(),
    clavePrivada,
    clavePublica: clavePublicaDe(clavePrivada),
    creadaEn: Date.now(),
  }
}

/** Firma datos arbitrarios; devuelve la firma en base64url. */
export function firmar(clavePrivadaB64: string, datos: Uint8Array): string {
  return bytesABase64Url(ed.sign(datos, base64UrlABytes(clavePrivadaB64)))
}

export function firmarTexto(clavePrivadaB64: string, texto: string): string {
  return firmar(clavePrivadaB64, textoABytes(texto))
}

/** Verificación que nunca lanza: firma o clave dañada = falso. */
export function verificar(clavePublicaB64: string, firmaB64: string, datos: Uint8Array): boolean {
  try {
    return ed.verify(base64UrlABytes(firmaB64), datos, base64UrlABytes(clavePublicaB64))
  } catch {
    return false
  }
}

export function verificarTexto(clavePublicaB64: string, firmaB64: string, texto: string): boolean {
  return verificar(clavePublicaB64, firmaB64, textoABytes(texto))
}

export function esClavePublicaValida(clavePublicaB64: string): boolean {
  try {
    return base64UrlABytes(clavePublicaB64).length === 32
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Código de contacto: lo que viaja dentro del QR y también pegado como texto.
// Formato: «lemchat1:» + base64url(JSON { nombre, clave, maestro? })
// ---------------------------------------------------------------------------

const PREFIJO_CODIGO = 'lemchat1:'

export interface DatosContacto {
  nombre: string
  clavePublica: string
  esMaestro: boolean
}

export function codigoDeContacto(identidad: Identidad, esMaestro = false): string {
  const datos: DatosContacto = {
    nombre: identidad.nombre,
    clavePublica: identidad.clavePublica,
    esMaestro,
  }
  return PREFIJO_CODIGO + bytesABase64Url(textoABytes(JSON.stringify(datos)))
}

export function leerCodigoDeContacto(texto: string): DatosContacto | null {
  try {
    const limpio = texto.trim()
    if (!limpio.startsWith(PREFIJO_CODIGO)) return null
    const datos = JSON.parse(
      new TextDecoder().decode(base64UrlABytes(limpio.slice(PREFIJO_CODIGO.length))),
    ) as Partial<DatosContacto>
    if (!datos || typeof datos.nombre !== 'string' || !datos.nombre.trim()) return null
    if (typeof datos.clavePublica !== 'string' || !esClavePublicaValida(datos.clavePublica)) return null
    return {
      nombre: datos.nombre.trim(),
      clavePublica: datos.clavePublica,
      // El script de llaves del maestro imprimió al principio códigos con
      // el campo «maestro» en vez de «esMaestro»: se aceptan las dos
      // formas para que esos códigos ya repartidos marquen al maestro.
      esMaestro:
        datos.esMaestro === true ||
        (datos as Record<string, unknown>).maestro === true,
    }
  } catch {
    return null
  }
}
