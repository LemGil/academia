// Progreso del estudiante en las enseñanzas — solo en el teléfono.
// Si un día hay internet, aquí se conectará la sincronización con la nube.
const CLAVE = 'academia_temas_leidos_v1'

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
