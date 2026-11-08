// Tipos de datos de LemChat (Fase B).
// Todo vive en el almacén propio de LemChat (carpeta «lemchat/» en el
// teléfono); nada de esto se mezcla con los paquetes de academias ni con
// el progreso de lectura.

/** Identidad del estudiante: par de llaves Ed25519 creado en su teléfono.
 *  Sin cuentas, sin correo, sin registro en ningún servidor. */
export interface Identidad {
  nombre: string
  /** Clave pública Ed25519 en base64url: es su «dirección» en LemChat. */
  clavePublica: string
  /** Clave privada Ed25519 en base64url: nunca sale del teléfono. */
  clavePrivada: string
  creadaEn: number
}

export interface Contacto {
  clavePublica: string
  nombre: string
  /** true si es el maestro: sus paquetes firmados se archivan solos. */
  esMaestro: boolean
  agregadoEn: number
}

export type TipoMensaje = 'texto' | 'aviso' | 'paquete'

/** Estados honestos del diseño: en cola · enviado · entregado. */
export type EstadoMensaje = 'cola' | 'enviado' | 'entregado'

export interface Mensaje {
  id: string
  /** 'canal-maestro' o la clave pública del otro (conversación personal). */
  conversacion: string
  de: string
  para: string
  tipo: TipoMensaje
  /** Texto ya descifrado en local (lo personal viaja cifrado por las vías). */
  cuerpo: string
  ts: number
  mio: boolean
  estado: EstadoMensaje
  leido: boolean
  /** Si tipo = 'paquete': id de la academia entregada (ej. «lemgil-14»). */
  paqueteId?: string
  /** Si tipo = 'paquete': título visible de la enseñanza. */
  paqueteTitulo?: string
  /** Si tipo = 'paquete' y la firma NO verificó: queda a revisar, jamás
   *  se instala en silencio (diseño §3). */
  paqueteSinVerificar?: boolean
}

/** Grupo por academia (Fase D). Lo crea solo el maestro; en v1 es un
 *  hilo de difusión: el maestro escribe y los miembros leen (responderle
 *  es por la conversación personal con él). La clave del grupo es
 *  simétrica: quien no la tiene, no puede leer los mensajes del grupo
 *  aunque recoja las filas del buzón. */
export interface Grupo {
  id: string
  nombre: string
  /** Academia vinculada, si el maestro la indicó al crear (id libre). */
  academiaId?: string
  /** Clave simétrica del grupo (base64url, 32 bytes). */
  claveGrupo: string
  /** Claves públicas de los miembros, incluida la del maestro. */
  miembros: string[]
}

export interface EstadoChat {
  activado: boolean
  identidad: Identidad | null
  contactos: Contacto[]
  mensajes: Mensaje[]
  /** ids de filas del canal ya procesadas (el buzón del canal no se borra:
   *  lo leen todos; expira solo en el servidor a los 30 días). */
  canalProcesados: string[]
  /** Grupos por academia a los que pertenece este teléfono (Fase D). */
  grupos: Grupo[]
  /** ids de filas de grupo ya procesadas (como las del canal, las filas
   *  de grupo las leen todos los miembros: no se borran al leer). */
  gruposProcesados: string[]
  /** true si este teléfono importó la llave del maestro (Fase D): puede
   *  publicar en el canal y crear grupos. */
  soyMaestro: boolean
}

export const CONVERSACION_CANAL = 'canal-maestro'
/** Dirección especial del buzón: lo que el maestro publica «para el canal». */
export const DIRECCION_CANAL = 'canal'

/** Conversación local y dirección del buzón de un grupo: «grupo:<id>». */
export function conversacionDeGrupo(id: string): string {
  return `grupo:${id}`
}

export function estadoChatVacio(): EstadoChat {
  return {
    activado: false,
    identidad: null,
    contactos: [],
    mensajes: [],
    canalProcesados: [],
    grupos: [],
    gruposProcesados: [],
    soyMaestro: false,
  }
}
