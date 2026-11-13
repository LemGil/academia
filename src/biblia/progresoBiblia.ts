// Progreso de lectura bíblica — solo en el teléfono (localStorage).
// Si un día hay internet, aquí se conectará la sincronización con la nube.
//
// Desde la v1.7.1 la marca de «leído» es por LIBRO Y CAPÍTULO, sin
// versión (decisión de LemGil, 2026-11-12): leer Génesis 1 en una
// versión es haberlo leído en todas. Las marcas viejas traían la
// versión («version:codigo:cap»); al leer el almacén se normalizan
// solas a «codigo:cap» y se guardan convertidas — nadie pierde su
// progreso al actualizar.

const CLAVE_LEIDOS = 'academia_biblia_leidos_v1'

/** Clave de un capítulo leído: «codigo:capitulo», sin versión. */
export function claveCapitulo(codigo: string, capitulo: number): string {
  return `${codigo}:${capitulo}`
}

/** Normaliza una clave guardada: la vieja («version:codigo:cap») pasa a
 *  «codigo:cap»; la nueva queda igual; lo irreconocible se descarta. */
export function normalizarClave(cruda: string): string | null {
  const partes = cruda.split(':')
  if (partes.length === 2) return cruda
  if (partes.length === 3) return `${partes[1]}:${partes[2]}`
  return null
}

function leer(): Set<string> {
  try {
    const crudo = localStorage.getItem(CLAVE_LEIDOS)
    if (!crudo) return new Set()
    const viejas = JSON.parse(crudo) as string[]
    const normalizadas = new Set<string>()
    let huboConversion = false
    for (const c of viejas) {
      const n = normalizarClave(c)
      if (n === null) {
        huboConversion = true
        continue
      }
      if (n !== c) huboConversion = true
      normalizadas.add(n)
    }
    // La primera lectura tras actualizar deja el almacén ya convertido.
    if (huboConversion) guardar(normalizadas)
    return normalizadas
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

/** Capítulos leídos de un libro (las claves ya no llevan versión). */
export function conteoPorLibro(leidos: Set<string>, codigo: string): number {
  let n = 0
  for (const c of leidos) {
    const [cod] = c.split(':')
    if (cod === codigo) n++
  }
  return n
}
