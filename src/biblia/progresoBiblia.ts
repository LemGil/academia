// Progreso de lectura bíblica — solo en el teléfono (localStorage).
// Si un día hay internet, aquí se conectará la sincronización con la nube.
import type { VersionBiblia } from './bibliaService'

const CLAVE_LEIDOS = 'academia_biblia_leidos_v1'

export function claveCapitulo(version: VersionBiblia, codigo: string, capitulo: number): string {
  return `${version}:${codigo}:${capitulo}`
}

function leer(): Set<string> {
  try {
    const crudo = localStorage.getItem(CLAVE_LEIDOS)
    return new Set(crudo ? (JSON.parse(crudo) as string[]) : [])
  } catch {
    return new Set()
  }
}

function guardar(leidos: Set<string>) {
  localStorage.setItem(CLAVE_LEIDOS, JSON.stringify([...leidos]))
}

export function cargarLeidos(): Set<string> {
  return leer()
}

export function estaLeido(clave: string): boolean {
  return leer().has(clave)
}

export function alternarLeido(clave: string): Set<string> {
  const leidos = leer()
  if (leidos.has(clave)) leidos.delete(clave)
  else leidos.add(clave)
  guardar(leidos)
  return leidos
}

export function reiniciarLeidos() {
  localStorage.removeItem(CLAVE_LEIDOS)
}

export function conteoPorLibro(leidos: Set<string>, version: VersionBiblia, codigo: string): number {
  let n = 0
  for (const c of leidos) {
    const [v, cod] = c.split(':')
    if (v === version && cod === codigo) n++
  }
  return n
}
