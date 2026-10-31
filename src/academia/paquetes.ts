// Paquetes de enseñanzas importables (v1.3; modelo vigente desde la v1.4).
//
// La app se instala VACÍA: ninguna academia viene dentro de la APK.
// Cada academia llega como archivo suelto (por WhatsApp, Bluetooth o USB)
// y el estudiante la importa aquí, sin internet y sin recompilar la APK.
// El paquete lo genera LemWriter (o el empaquetador de Leo como respaldo):
//   python3 scripts/empaquetar-contenido.py --paquetes
// que deja un .json por academia en la carpeta paquetes/ del proyecto.
//
// El identificador de la academia es MANUAL (autor + número, asignado por
// el maestro en LemWriter, ej. id "lemgil-14" con numero "Nº 14"): da el
// orden deseado en la lista y evita choques entre pastores distintos.
// La lista se ordena por ese número (2 antes que 10, numérico).
//
// Formato del paquete:
//   { "tipo": "paquete-academia", "formato": 1, "generada": "2026-10-31",
//     "academia": { "id": "lemgil-14", "numero": "Nº 14", "titulo": "...",
//                   "autor": "LemGil Apóstol",
//                   "codigos": [{ "id": "lemgil-14-c1", ... }], "cierre": "..." } }
//
// Los paquetes se guardan como archivos en el almacenamiento interno de la
// app (carpeta "paquetes", vía @capacitor/filesystem, como las carpetas de
// LemWriter). Al arrancar, el catálogo = academias incluidas en la APK
// fusionadas con las importadas: una importada con el mismo id REEMPLAZA a
// la incluida (eso es una "actualización"), y borrarla devuelve la incluida.
// El progreso no se toca: las marcas de leído van por id de código
// ("a7-c3") y esos ids no cambian entre versiones del paquete.

import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Academia, ACADEMIAS_INCLUIDAS, Codigo } from './contenido'

const DIR_PAQUETES = 'paquetes'
const TAM_MAX = 2 * 1024 * 1024 // 2 MB (un paquete normal pesa ~40 KB)

export interface ResultadoImportacion {
  academia: Academia
  /** true si el id no existía en el catálogo (academia nueva). */
  esNueva: boolean
  /** true si reemplaza a la versión incluida en la APK. */
  reemplazaIncluida: boolean
}

// ---------------------------------------------------------------------------
// Validación (funciones puras)
// ---------------------------------------------------------------------------

function esTexto(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function validarCodigo(crudo: unknown, idAcademia: string): Codigo {
  const c = crudo as Partial<Codigo>
  if (!c || !esTexto(c.id) || !esTexto(c.titulo) || typeof c.cuerpo !== 'string') {
    throw new Error('un código viene incompleto (falta id, título o texto)')
  }
  if (!c.id.startsWith(`${idAcademia}-`)) {
    throw new Error(`el código «${c.id}» no pertenece a esta academia`)
  }
  return {
    id: c.id,
    titulo: c.titulo,
    subtitulo: typeof c.subtitulo === 'string' ? c.subtitulo : '',
    cuerpo: c.cuerpo,
  }
}

/** Valida el texto de un paquete y devuelve la academia lista para usar. */
export function validarPaquete(texto: string): Academia {
  if (texto.length > TAM_MAX) {
    throw new Error('el archivo es demasiado grande para ser un paquete de academia')
  }
  let datos: unknown
  try {
    datos = JSON.parse(texto)
  } catch {
    throw new Error('el archivo no es un paquete válido (no se pudo leer)')
  }
  const raiz = datos as { tipo?: unknown; academia?: unknown }
  // Se acepta el paquete con envoltura y también la academia "pelada".
  const cruda = (raiz && typeof raiz === 'object' && 'academia' in raiz ? raiz.academia : datos) as Partial<Academia>
  if (!cruda || typeof cruda !== 'object') {
    throw new Error('el paquete no trae ninguna academia')
  }
  if (!esTexto(cruda.id) || !/^[a-z0-9-]+$/.test(cruda.id)) {
    throw new Error('la academia del paquete no tiene un id válido')
  }
  if (!esTexto(cruda.numero) || !esTexto(cruda.titulo)) {
    throw new Error('la academia del paquete viene sin número o sin título')
  }
  if (!Array.isArray(cruda.codigos) || cruda.codigos.length === 0) {
    throw new Error('la academia del paquete no trae códigos')
  }
  const codigos = cruda.codigos.map((c) => validarCodigo(c, cruda.id as string))
  const idsVistos = new Set<string>()
  for (const c of codigos) {
    if (idsVistos.has(c.id)) throw new Error(`el código «${c.id}» está repetido en el paquete`)
    idsVistos.add(c.id)
  }
  return {
    id: cruda.id,
    numero: cruda.numero,
    titulo: cruda.titulo,
    autor: esTexto(cruda.autor) ? cruda.autor : undefined,
    codigos,
    cierre: typeof cruda.cierre === 'string' ? cruda.cierre : '',
  }
}

/** Número de orden de una academia: el primer número de su «Nº» visible
 *  (ej. "Nº 14" → 14); si no tiene, el número final de su id ("lemgil-14");
 *  si tampoco, va al final. */
function claveNumero(a: Academia): number {
  const enNumero = /(\d+)/.exec(a.numero)
  if (enNumero) return parseInt(enNumero[1], 10)
  const enId = /(\d+)$/.exec(a.id)
  if (enId) return parseInt(enId[1], 10)
  return Number.MAX_SAFE_INTEGER
}

function compararAcademias(a: Academia, b: Academia): number {
  return (
    claveNumero(a) - claveNumero(b) ||
    (a.autor ?? '').localeCompare(b.autor ?? '', 'es') ||
    a.titulo.localeCompare(b.titulo, 'es')
  )
}

/** Catálogo visible, ORDENADO por el número de cada academia (el orden
 *  que el maestro decidió): las incluidas en la APK (hoy ninguna), con
 *  las importadas reemplazando por id y las nuevas sumadas. */
export function fusionarCatalogo(importadas: Map<string, Academia>): Academia[] {
  const lista = ACADEMIAS_INCLUIDAS.map((a) => importadas.get(a.id) ?? a)
  const incluidas = new Set(ACADEMIAS_INCLUIDAS.map((a) => a.id))
  for (const a of importadas.values()) {
    if (!incluidas.has(a.id)) lista.push(a)
  }
  return lista.sort(compararAcademias)
}

// ---------------------------------------------------------------------------
// Almacenamiento en el teléfono
// ---------------------------------------------------------------------------

async function asegurarCarpeta() {
  try {
    await Filesystem.mkdir({ path: DIR_PAQUETES, directory: Directory.Data, recursive: true })
  } catch {
    // Ya existe: es lo normal a partir de la primera importación.
  }
}

async function leerImportadas(): Promise<Map<string, Academia>> {
  const mapa = new Map<string, Academia>()
  let archivos: string[] = []
  try {
    const res = await Filesystem.readdir({ path: DIR_PAQUETES, directory: Directory.Data })
    archivos = res.files.map((f) => f.name).filter((n) => n.endsWith('.json'))
  } catch {
    return mapa // La carpeta aún no existe: no hay importadas.
  }
  for (const nombre of archivos) {
    try {
      const res = await Filesystem.readFile({
        path: `${DIR_PAQUETES}/${nombre}`,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      })
      const academia = validarPaquete(res.data as string)
      mapa.set(academia.id, academia)
    } catch {
      // Un paquete dañado se ignora; no debe tumbar la app al arrancar.
    }
  }
  return mapa
}

export interface Catalogo {
  lista: Academia[]
  /** ids presentes como paquete importado (nuevas o actualizando una incluida). */
  importadas: Set<string>
}

export async function cargarCatalogo(): Promise<Catalogo> {
  const mapa = await leerImportadas()
  return { lista: fusionarCatalogo(mapa), importadas: new Set(mapa.keys()) }
}

/** Valida y guarda el paquete. El llamador refresca el catálogo después. */
export async function importarPaquete(
  texto: string,
  catalogoActual: Academia[],
): Promise<ResultadoImportacion> {
  const academia = validarPaquete(texto)
  await asegurarCarpeta()
  const envoltura = {
    tipo: 'paquete-academia',
    formato: 1,
    generada: new Date().toISOString().slice(0, 10),
    academia,
  }
  await Filesystem.writeFile({
    path: `${DIR_PAQUETES}/${academia.id}.json`,
    data: JSON.stringify(envoltura, null, 1),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
  })
  return {
    academia,
    esNueva: !catalogoActual.some((a) => a.id === academia.id),
    reemplazaIncluida: ACADEMIAS_INCLUIDAS.some((a) => a.id === academia.id),
  }
}

/** Borra el paquete importado. Si la academia venía incluida en la APK,
 *  al refrescar el catálogo reaparece la versión incluida. */
export async function borrarPaqueteImportado(id: string) {
  await Filesystem.deleteFile({ path: `${DIR_PAQUETES}/${id}.json`, directory: Directory.Data })
}
