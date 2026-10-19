// Contenido de enseñanzas incluido en la APK (src/contenido/academias.json).
// Generado con: npm run contenido
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

interface Paquete {
  version: string
  generada: string
  academias: Academia[]
}

const paquete = datos as Paquete

export const VERSION_CONTENIDO = paquete.version
export const FECHA_CONTENIDO = paquete.generada
export const ACADEMIAS: Academia[] = paquete.academias

export function totalCodigos(): number {
  return ACADEMIAS.reduce((n, a) => n + a.codigos.length, 0)
}

export function buscarCodigo(id: string): { academia: Academia; codigo: Codigo } | null {
  for (const a of ACADEMIAS) {
    const c = a.codigos.find((x) => x.id === id)
    if (c) return { academia: a, codigo: c }
  }
  return null
}
