// Sello del encuentro presencial (v1.7): la conclusión de una academia
// no la da la lectura, la da el encuentro con el Maestro.
//
// En el encuentro, el teléfono del maestro genera un código (QR o texto)
// firmado con su llave: { tipo:'sello-encuentro', academiaId, encuentro,
// emitido, claveMaestro, firma }. El alumno lo escanea en la pantalla de
// la academia y la app verifica la firma contra su maestro de confianza
// antes de darla por concluida. Sin internet, en persona.
//
// El mismo sello sirve para todos los presentes en ese encuentro (la
// asistencia es la presencia); el maestro genera uno fresco cada vez
// (la marca `encuentro` cambia), así un código viejo no se reutiliza
// encuentro tras encuentro.

import { firmarTexto, verificarTexto } from './identidad'
import { base64UrlABytes, bytesABase64Url, bytesATexto, idAleatorio, textoABytes } from './util'
import type { Identidad } from './tipos'

export interface SelloEncuentro {
  tipo: 'sello-encuentro'
  formato: 1
  academiaId: string
  /** Marca única del encuentro (fecha + aleatorio): uno por encuentro. */
  encuentro: string
  emitido: number
  claveMaestro: string
  firma: string
}

const PREFIJO = 'lemsello1:'

/** Lo que se firma: la academia y la marca del encuentro, nada más. */
export function textoFirmadoSello(academiaId: string, encuentro: string): string {
  return `lemchat-sello-v1|${academiaId}|${encuentro}`
}

export function crearSelloTexto(academiaId: string, identidad: Identidad): string {
  const encuentro = idAleatorio('encuentro')
  const sello: SelloEncuentro = {
    tipo: 'sello-encuentro',
    formato: 1,
    academiaId,
    encuentro,
    emitido: Date.now(),
    claveMaestro: identidad.clavePublica,
    firma: firmarTexto(identidad.clavePrivada, textoFirmadoSello(academiaId, encuentro)),
  }
  return PREFIJO + bytesABase64Url(textoABytes(JSON.stringify(sello)))
}

/** Lee un código de sello (del QR o pegado como texto). null si no lo es. */
export function leerSello(texto: string): SelloEncuentro | null {
  try {
    const limpio = texto.trim()
    const cuerpo = limpio.startsWith(PREFIJO) ? limpio.slice(PREFIJO.length) : limpio
    const datos = JSON.parse(bytesATexto(base64UrlABytes(cuerpo))) as Partial<SelloEncuentro>
    if (
      !datos ||
      datos.tipo !== 'sello-encuentro' ||
      datos.formato !== 1 ||
      typeof datos.academiaId !== 'string' ||
      !datos.academiaId ||
      typeof datos.encuentro !== 'string' ||
      !datos.encuentro ||
      typeof datos.claveMaestro !== 'string' ||
      typeof datos.firma !== 'string'
    ) {
      return null
    }
    return datos as SelloEncuentro
  } catch {
    return null
  }
}

/** El sello vale solo si lo firmó EL maestro de confianza de este teléfono. */
export function selloEsValido(sello: SelloEncuentro, claveMaestroConfiable: string | null): boolean {
  if (!claveMaestroConfiable) return false
  if (sello.claveMaestro !== claveMaestroConfiable) return false
  return verificarTexto(
    sello.claveMaestro,
    sello.firma,
    textoFirmadoSello(sello.academiaId, sello.encuentro),
  )
}
