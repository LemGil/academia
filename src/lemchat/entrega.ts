// La entrega firmada de enseñanzas (diseño §3): el ÚNICO puente entre
// LemChat y la biblioteca.
//
// Un paquete de academia viaja dentro de un «sobre LemChat» firmado por
// el maestro. La regla no se negocia:
//   - Firma válida de la llave del maestro → el paquete se archiva solo
//     en la biblioteca (por el camino de importación que la app ya tiene)
//     y el estudiante ve el aviso.
//   - Sin firma, firma inválida o firmante desconocido → el paquete se
//     ofrece como archivo a revisar; JAMÁS se instala en silencio.
//   - Sobre o paquete dañados → se rechaza con el motivo.
//
// Este módulo decide; el servicio ejecuta el archivado. Decidir es puro
// y se prueba sin teléfono.

import { validarPaquete } from '../academia/paquetes'
import type { Academia } from '../academia/contenido'
import { firmarTexto, verificarTexto } from './identidad'

export interface SobrePaquete {
  tipo: 'paquete-lemchat'
  formato: 1
  /** Id de la academia que va dentro (ej. «lemgil-14»). */
  academiaId: string
  /** El paquete .json EXACTO que la app ya importa hoy, como texto. */
  paqueteTexto: string
  /** Clave pública Ed25519 del maestro que firma. */
  claveMaestro: string
  /** Firma Ed25519 (base64url) sobre el texto firmado canónico. */
  firma: string
  emitido: string
}

/** Lo que se firma: el id y el texto exacto del paquete. Cambiar una
 *  sola letra del paquete invalida la firma. */
export function textoFirmadoPaquete(academiaId: string, paqueteTexto: string): string {
  return `lemchat-paquete-v1|${academiaId}|${paqueteTexto}`
}

export function crearSobrePaquete(
  paqueteTexto: string,
  academiaId: string,
  claveMaestro: string,
  clavePrivadaMaestro: string,
): SobrePaquete {
  return {
    tipo: 'paquete-lemchat',
    formato: 1,
    academiaId,
    paqueteTexto,
    claveMaestro,
    firma: firmarTexto(clavePrivadaMaestro, textoFirmadoPaquete(academiaId, paqueteTexto)),
    emitido: new Date().toISOString(),
  }
}

export function sobreEsAutentico(sobre: SobrePaquete): boolean {
  return verificarTexto(
    sobre.claveMaestro,
    sobre.firma,
    textoFirmadoPaquete(sobre.academiaId, sobre.paqueteTexto),
  )
}

export function leerSobre(texto: string): SobrePaquete | null {
  try {
    const datos = JSON.parse(texto) as Partial<SobrePaquete>
    if (!datos || datos.tipo !== 'paquete-lemchat' || datos.formato !== 1) return null
    if (typeof datos.academiaId !== 'string' || typeof datos.paqueteTexto !== 'string') return null
    if (typeof datos.claveMaestro !== 'string' || typeof datos.firma !== 'string') return null
    return datos as SobrePaquete
  } catch {
    return null
  }
}

export type DecisionEntrega =
  | { accion: 'archivar'; academia: Academia; sobre: SobrePaquete }
  | { accion: 'revisar'; motivo: string; sobre: SobrePaquete }
  | { accion: 'rechazar'; motivo: string }

export function decidirEntrega(
  textoSobre: string,
  claveMaestroConfiable: string | null,
): DecisionEntrega {
  const sobre = leerSobre(textoSobre)
  if (!sobre) return { accion: 'rechazar', motivo: 'el sobre no es un paquete LemChat válido' }
  if (!claveMaestroConfiable) {
    return {
      accion: 'revisar',
      motivo: 'aún no tienes agregado al maestro: el paquete queda a revisar',
      sobre,
    }
  }
  if (sobre.claveMaestro !== claveMaestroConfiable) {
    return { accion: 'revisar', motivo: 'lo firma otra llave, no la del maestro agregado', sobre }
  }
  if (!sobreEsAutentico(sobre)) {
    return { accion: 'revisar', motivo: 'la firma no verifica: el paquete pudo ser alterado', sobre }
  }
  try {
    const academia = validarPaquete(sobre.paqueteTexto)
    if (academia.id !== sobre.academiaId) {
      return { accion: 'rechazar', motivo: 'el id del sobre no coincide con el del paquete' }
    }
    return { accion: 'archivar', academia, sobre }
  } catch (e) {
    return { accion: 'rechazar', motivo: e instanceof Error ? e.message : 'paquete inválido' }
  }
}
