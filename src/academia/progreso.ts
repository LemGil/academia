// Progreso del estudiante en las enseñanzas — solo en el teléfono.
// Si un día hay internet, aquí se conectará la sincronización con la nube.
// Desde la v1.7 el progreso es por NIVEL e incluye las marcas de
// «practicado», las conclusiones selladas en el encuentro presencial y
// los niveles desbloqueados (el avance no se quita). Todo local: LemGil
// decidió que NO se sincroniza con la web.
import { agruparPorNiveles, type Conclusion, type DatosProgreso } from './niveles'
import type { Academia } from './contenido'

const CLAVE = 'academia_temas_leidos_v1'
const CLAVE_PRACTICADOS = 'academia_temas_practicados_v1'
const CLAVE_CONCLUSIONES = 'academia_conclusiones_v1'
const CLAVE_DESBLOQUEADOS = 'academia_niveles_desbloqueados_v1'

function leer(): Set<string> {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return new Set(crudo ? (JSON.parse(crudo) as string[]) : [])
  } catch {
    return new Set()
  }
}

function guardar(v: Set<string>) {
  localStorage.setItem(CLAVE, JSON.stringify([...v]))
}

export function temasLeidos(): Set<string> {
  return leer()
}

export function alternarTemaLeido(id: string): Set<string> {
  const v = leer()
  if (v.has(id)) v.delete(id)
  else v.add(id)
  guardar(v)
  return v
}

export function reiniciarProgresoTemas() {
  localStorage.removeItem(CLAVE)
}

// ---------------------------------------------------------------------
// Formación por niveles (v1.7): practicados, conclusiones y desbloqueos
// ---------------------------------------------------------------------

function leerSet(clave: string): Set<string> {
  try {
    const crudo = localStorage.getItem(clave)
    return new Set(crudo ? (JSON.parse(crudo) as string[]) : [])
  } catch {
    return new Set()
  }
}

function guardarSet(clave: string, v: Set<string>) {
  localStorage.setItem(clave, JSON.stringify([...v]))
}

export function temasPracticados(): Set<string> {
  return leerSet(CLAVE_PRACTICADOS)
}

export function alternarTemaPracticado(id: string): Set<string> {
  const v = temasPracticados()
  if (v.has(id)) v.delete(id)
  else v.add(id)
  guardarSet(CLAVE_PRACTICADOS, v)
  return v
}

export function conclusiones(): Map<string, Conclusion> {
  try {
    const crudo = localStorage.getItem(CLAVE_CONCLUSIONES)
    if (!crudo) return new Map()
    const obj = JSON.parse(crudo) as Record<string, Conclusion>
    return new Map(Object.entries(obj))
  } catch {
    return new Map()
  }
}

export function registrarConclusion(id: string, c: Conclusion): Map<string, Conclusion> {
  const mapa = conclusiones()
  mapa.set(id, c)
  localStorage.setItem(CLAVE_CONCLUSIONES, JSON.stringify(Object.fromEntries(mapa)))
  return mapa
}

export function nivelesDesbloqueadosGuardados(): Set<number> {
  try {
    const crudo = localStorage.getItem(CLAVE_DESBLOQUEADOS)
    return new Set(crudo ? (JSON.parse(crudo) as number[]) : [])
  } catch {
    return new Set()
  }
}

export function guardarNivelesDesbloqueados(v: ReadonlySet<number>) {
  localStorage.setItem(CLAVE_DESBLOQUEADOS, JSON.stringify([...v]))
}

/** Todos los datos de progreso que la lógica de niveles necesita. */
export function cargarDatosProgreso(): DatosProgreso {
  return {
    leidos: temasLeidos(),
    practicados: temasPracticados(),
    concluidas: conclusiones(),
    desbloqueados: nivelesDesbloqueadosGuardados(),
  }
}

/** Guarda los niveles que el catálogo actual acaba de desbloquear
 *  (el avance no se quita: solo se agregan, nunca se quitan). */
export function sincronizarDesbloqueos(academias: Academia[]) {
  const datos = cargarDatosProgreso()
  const { desbloqueadosResultantes } = agruparPorNiveles(academias, datos)
  if ([...desbloqueadosResultantes].some((o) => !datos.desbloqueados.has(o))) {
    guardarNivelesDesbloqueados(desbloqueadosResultantes)
  }
}

/** Borra practicados, conclusiones y desbloqueos (el reinicio completo
 *  de la pantalla de progreso; los leídos se reinician aparte). */
export function reiniciarProgresoFormacion() {
  localStorage.removeItem(CLAVE_PRACTICADOS)
  localStorage.removeItem(CLAVE_CONCLUSIONES)
  localStorage.removeItem(CLAVE_DESBLOQUEADOS)
}
