// Planes de lectura bíblica incluidos en la APK. Generados con:
//   python3 scripts/generar-planes.py
import canonico from './canonico.json'
import ntAno from './nt-ano.json'
import paralelo from './paralelo.json'
import dias90 from './90-dias.json'

export interface LecturaPlan {
  libro: string
  nombreLibro: string
  capInicio: number
  capFin: number
}

export interface DiaPlan {
  dia: number
  lecturas: LecturaPlan[]
}

export interface Plan {
  id: string
  nombre: string
  descripcion: string
  carga: string
  dias: DiaPlan[]
}

export const PLANES: Plan[] = [
  canonico as Plan,
  ntAno as Plan,
  paralelo as Plan,
  dias90 as Plan,
]

export function planPorId(id: string): Plan {
  return PLANES.find((p) => p.id === id) || PLANES[0]
}

const CLAVE_ACTIVO = 'academia_plan_activo'
const CLAVE_VIEJA = 'academia_plan_canonico_inicio' // v1.1, migrar
const claveInicio = (id: string) => `academia_plan_${id}_inicio`

// Plan elegido por el discípulo (null = aún no eligió)
export function planActivo(): string | null {
  let id = localStorage.getItem(CLAVE_ACTIVO)
  if (!id && localStorage.getItem(CLAVE_VIEJA)) {
    // Migración desde v1.1 (solo existía el canónico)
    id = 'canonico'
    localStorage.setItem(claveInicio(id), localStorage.getItem(CLAVE_VIEJA) as string)
    localStorage.removeItem(CLAVE_VIEJA)
    localStorage.setItem(CLAVE_ACTIVO, id)
  }
  return id
}

export function activarPlan(id: string) {
  localStorage.setItem(CLAVE_ACTIVO, id)
  if (!localStorage.getItem(claveInicio(id))) {
    localStorage.setItem(claveInicio(id), new Date().toISOString().slice(0, 10))
  }
}

export function quitarPlan() {
  localStorage.removeItem(CLAVE_ACTIVO)
}

// Día actual del plan según su fecha de inicio
export function diaDeHoy(plan: Plan): number {
  const total = plan.dias.length
  let inicio = localStorage.getItem(claveInicio(plan.id))
  if (!inicio) {
    inicio = new Date().toISOString().slice(0, 10)
    localStorage.setItem(claveInicio(plan.id), inicio)
  }
  const ms = Date.now() - new Date(inicio + 'T00:00:00').getTime()
  const dia = Math.floor(ms / 86400000) + 1
  return Math.min(Math.max(dia, 1), total)
}

export function reiniciarPlan(plan: Plan) {
  localStorage.removeItem(claveInicio(plan.id))
}

// ¿Se leyó este capítulo en alguna versión? (las claves son version:codigo:cap)
export function capituloLeido(leidos: Set<string>, codigo: string, cap: number): boolean {
  for (const c of leidos) {
    const partes = c.split(':')
    if (partes.length === 3 && partes[1] === codigo && partes[2] === String(cap)) return true
  }
  return false
}

export function diaCompletado(dia: DiaPlan, leidos: Set<string>): boolean {
  if (!dia.lecturas.length) return true // día de descanso
  for (const l of dia.lecturas) {
    for (let c = l.capInicio; c <= l.capFin; c++) {
      if (!capituloLeido(leidos, l.libro, c)) return false
    }
  }
  return true
}

export function resumenLecturas(dia: DiaPlan): string {
  if (!dia.lecturas.length) return 'Día de descanso'
  return dia.lecturas
    .map((l) => `${l.nombreLibro} ${l.capInicio}${l.capFin !== l.capInicio ? `–${l.capFin}` : ''}`)
    .join(' · ')
}

export function capitulosDelDia(dia: DiaPlan): number {
  return dia.lecturas.reduce((n, l) => n + (l.capFin - l.capInicio + 1), 0)
}
