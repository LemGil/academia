// Contenido de enseñanzas incluido en la APK (src/contenido/academias.json).
// Generado con: npm run contenido
// Desde la v1.3 el catálogo visible es dinámico: a estas academias incluidas
// se suman (o las reemplazan) los paquetes importados en el teléfono.
// Ver paquetes.ts.
import datos from '../contenido/academias.json'

export interface Codigo {
  id: string
  titulo: string
  subtitulo: string
  cuerpo: string
}

export interface Academia {
  id: string
  numero: string
  titulo: string
  codigos: Codigo[]
  cierre: string
}

interface PaqueteIncluido {
  version: string
  generada: string
  academias: Academia[]
}

const paquete = datos as PaqueteIncluido

export const VERSION_CONTENIDO = paquete.version
export const FECHA_CONTENIDO = paquete.generada
/** Academias que viajan dentro de la APK (base del catálogo). */
export const ACADEMIAS_INCLUIDAS: Academia[] = paquete.academias

export function totalCodigos(lista: Academia[]): number {
  return lista.reduce((n, a) => n + a.codigos.length, 0)
}
