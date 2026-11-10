// Contenido de enseñanzas incluido en la APK (src/contenido/academias.json).
// Generado con: npm run contenido
//
// Desde la v1.4 la app se INSTALA VACÍA: no trae ninguna academia dentro.
// El contenido llega solo por paquetes importados en el teléfono
// (ver paquetes.ts): el estudiante importa las academias que desee o las
// que su maestro le asigne, y puede borrarlas. ACADEMIAS_INCLUIDAS queda
// como base (hoy vacía) por si alguna edición futura incluye contenido.
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
  /** Maestro/ministerio autor de la enseñanza (opcional; los paquetes
   *  generados por LemWriter lo traen — permite que en un mismo teléfono
   *  convivan academias de distintos pastores sin chocar). */
  autor?: string
  /** Nivel de la Academia al que pertenece (ej. «NIVEL I: FUNDAMENTOS»),
   *  con su orden. Lo trae el paquete desde LemWriter (v1.7); los paquetes
   *  viejos no lo traen y se agrupan en «Sin nivel asignado». */
  nivel?: string
  nivelOrden?: number
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
