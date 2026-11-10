// Niveles, estados y desbloqueo (v1.7) — lógica pura, sin almacenamiento.
//
// El modelo de formación de LemGil:
// - El catálogo se organiza por NIVELES; un nivel se abre solo cuando
//   TODAS las academias de los niveles anteriores presentes en el
//   teléfono están CONCLUIDAS.
// - El avance no se quita: un nivel desbloqueado queda desbloqueado
//   aunque después llegue una academia nueva a un nivel anterior (por
//   eso los desbloqueos se guardan y esta función devuelve la unión).
// - Ninguna academia se concluye leyendo: al 100 % de leídos y
//   practicados queda «lista para el encuentro», y solo el sello del
//   encuentro presencial con el Maestro la concluye.
// - Las academias sin nivel (paquetes viejos) forman su propio grupo,
//   siempre abierto, y no bloquean ni desbloquean niveles.

import type { Academia } from './contenido'

export interface Conclusion {
  /** Fecha ISO del encuentro en que se selló. */
  fecha: string
  /** Marca del encuentro (la que trae el sello firmado). */
  encuentro: string
}

export interface DatosProgreso {
  leidos: ReadonlySet<string>
  practicados: ReadonlySet<string>
  concluidas: ReadonlyMap<string, Conclusion>
  /** Órdenes de nivel desbloqueados y guardados (el avance no se quita). */
  desbloqueados: ReadonlySet<number>
}

export type EstadoAcademia = 'bloqueada' | 'en-curso' | 'lista-encuentro' | 'concluida'

export const NOMBRE_SIN_NIVEL = 'Sin nivel asignado'

/** Orden de nivel de una academia; las que no traen van al final. */
export function ordenDeNivel(a: Academia): number | null {
  return typeof a.nivelOrden === 'number' && Number.isFinite(a.nivelOrden)
    ? Math.trunc(a.nivelOrden)
    : null
}

export function nombreDeNivel(a: Academia): string {
  return a.nivel?.trim() ? a.nivel : NOMBRE_SIN_NIVEL
}

export interface ProgresoAcademia {
  total: number
  nLeidos: number
  nPracticados: number
  /** true si todos los códigos están leídos Y practicados. */
  completa: boolean
}

export function progresoAcademia(a: Academia, datos: DatosProgreso): ProgresoAcademia {
  const total = a.codigos.length
  const nLeidos = a.codigos.filter((c) => datos.leidos.has(c.id)).length
  const nPracticados = a.codigos.filter((c) => datos.practicados.has(c.id)).length
  return {
    total,
    nLeidos,
    nPracticados,
    completa: total > 0 && nLeidos === total && nPracticados === total,
  }
}

export function estadoAcademia(
  a: Academia,
  datos: DatosProgreso,
  nivelDesbloqueado: boolean,
): EstadoAcademia {
  if (datos.concluidas.has(a.id)) return 'concluida'
  if (!nivelDesbloqueado) return 'bloqueada'
  return progresoAcademia(a, datos).completa ? 'lista-encuentro' : 'en-curso'
}

export interface GrupoNivel {
  /** Orden del nivel; null para el grupo «Sin nivel asignado». */
  orden: number | null
  nombre: string
  academias: Academia[]
  desbloqueado: boolean
}

export interface CatalogoPorNiveles {
  grupos: GrupoNivel[]
  /** Unión de los desbloqueos guardados con los que el catálogo actual
   *  acaba de ganar: lo que la app debe guardar (el avance no se quita). */
  desbloqueadosResultantes: Set<number>
}

/** Agrupa el catálogo por nivel y calcula qué niveles están abiertos. */
export function agruparPorNiveles(
  academias: Academia[],
  datos: DatosProgreso,
): CatalogoPorNiveles {
  const porOrden = new Map<number, Academia[]>()
  const sinNivel: Academia[] = []
  for (const a of academias) {
    const orden = ordenDeNivel(a)
    if (orden === null) sinNivel.push(a)
    else {
      const lista = porOrden.get(orden) ?? []
      lista.push(a)
      porOrden.set(orden, lista)
    }
  }
  const ordenes = [...porOrden.keys()].sort((x, y) => x - y)
  const resultantes = new Set<number>(datos.desbloqueados)
  const grupos: GrupoNivel[] = []
  // La cadena: el primer nivel presente está abierto; cada siguiente se
  // abre si ya estaba guardado como desbloqueado o si TODAS las academias
  // de los niveles anteriores presentes están concluidas.
  let anterioresConcluidas = true
  ordenes.forEach((orden, i) => {
    const delNivel = porOrden.get(orden)!
    const desbloqueado = i === 0 || resultantes.has(orden) || anterioresConcluidas
    if (desbloqueado) resultantes.add(orden)
    grupos.push({
      orden,
      nombre: nombreDeNivel(delNivel[0]),
      academias: delNivel,
      desbloqueado,
    })
    if (!delNivel.every((a) => datos.concluidas.has(a.id))) anterioresConcluidas = false
  })
  if (sinNivel.length > 0) {
    grupos.push({
      orden: null,
      nombre: NOMBRE_SIN_NIVEL,
      academias: sinNivel,
      desbloqueado: true,
    })
  }
  return { grupos, desbloqueadosResultantes: resultantes }
}

export type EstadoNivel = 'bloqueado' | 'en-curso' | 'espera-encuentro' | 'concluido'

export interface ResumenNivel {
  estado: EstadoNivel
  totalAcademias: number
  nConcluidas: number
  pctLeido: number
  pctPracticado: number
}

export function resumenNivel(grupo: GrupoNivel, datos: DatosProgreso): ResumenNivel {
  const totalAcademias = grupo.academias.length
  const nConcluidas = grupo.academias.filter((a) => datos.concluidas.has(a.id)).length
  let totalCodigos = 0
  let nL = 0
  let nP = 0
  let todasCompletas = totalAcademias > 0
  for (const a of grupo.academias) {
    const p = progresoAcademia(a, datos)
    totalCodigos += p.total
    nL += p.nLeidos
    nP += p.nPracticados
    if (!p.completa && !datos.concluidas.has(a.id)) todasCompletas = false
  }
  let estado: EstadoNivel
  if (!grupo.desbloqueado) estado = 'bloqueado'
  else if (totalAcademias > 0 && nConcluidas === totalAcademias) estado = 'concluido'
  else if (todasCompletas) estado = 'espera-encuentro'
  else estado = 'en-curso'
  return {
    estado,
    totalAcademias,
    nConcluidas,
    pctLeido: totalCodigos ? Math.round((nL / totalCodigos) * 100) : 0,
    pctPracticado: totalCodigos ? Math.round((nP / totalCodigos) * 100) : 0,
  }
}

/** Texto visible de cada estado de academia. */
export const TEXTO_ESTADO_ACADEMIA: Record<EstadoAcademia, string> = {
  bloqueada: '🔒 Bloqueada',
  'en-curso': '📖 En curso',
  'lista-encuentro': '🤝 Lista para el encuentro',
  concluida: '✅ Concluida',
}
