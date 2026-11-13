// Interfaz web del módulo nativo de cercanía (Nearby Connections).
// El plugin vive en plugins/lemchat-cercania (Kotlin) y Capacitor lo
// registra solo en Android. En web/PC no existe: todo degrada con
// honestidad («Cercanía: no disponible en esta versión») y el resto de
// LemChat sigue — el lector, por supuesto, ni se entera.
//
// Protocolo de mensajes entre teléfonos (JSON por payload):
//   { tipo: 'hola',    clave, nombre }              — al conectar
//   { tipo: 'mensaje', id, sellado }                — texto personal cifrado
//   { tipo: 'ack',     id }                         — «lo recibí»
//   { tipo: 'aviso',   texto, firma }               — aviso del maestro
//   { tipo: 'paquete', sobre }                      — enseñanza firmada
//   { tipo: 'invitacion-grupo', id, sellado }        — invitación a un grupo (Fase D)
//   { tipo: 'grupo',   grupo, id, cifrado, firma }  — mensaje de grupo (Fase D)

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { ModoCercania } from './tipos'

/**
 * La política de vías (v1.7.2, decisión de LemGil): internet manda.
 * Con internet respondiendo, la cercanía (Wi-Fi/Bluetooth escaneando
 * sin parar) es gasto y ruido — se queda apagada; solo se enciende
 * cuando internet no responde, que es su caso verdadero. Función pura:
 * dados el modo elegido, el estado de internet y si la cercanía está
 * activa, dice qué hacer.
 */
export function decidirCercania(
  modo: ModoCercania,
  internet: 'sin-configurar' | 'ok' | 'error',
  activa: boolean,
): 'iniciar' | 'detener' | 'nada' {
  if (modo === 'nunca') return activa ? 'detener' : 'nada'
  if (modo === 'siempre') return activa ? 'nada' : 'iniciar'
  // auto: 'ok' apaga; 'error' o sin buzón configurado (no hay internet
  // posible) enciende — la cercanía es la única vía.
  if (internet === 'ok') return activa ? 'detener' : 'nada'
  return activa ? 'nada' : 'iniciar'
}

export interface EventoDescubierto {
  endpointId: string
  nombre: string
}
export interface EventoDatos {
  endpointId: string
  datos: string
}
export interface EventoEndpoint {
  endpointId: string
}

export interface LemChatCercaniaPlugin {
  iniciar(opciones: { nombre: string }): Promise<{ activo: boolean }>
  detener(): Promise<void>
  /** Apaga y enciende la escucha: la salida visible cuando la cercanía
   *  se atasca (lección de la Fase A — botón «Reiniciar cercanía»). */
  reiniciar(opciones: { nombre: string }): Promise<{ activo: boolean }>
  enviar(opciones: { endpointId: string; datos: string }): Promise<void>
  addListener(
    evento: 'descubierto',
    cb: (e: EventoDescubierto) => void,
  ): Promise<PluginListenerHandle>
  addListener(evento: 'perdido', cb: (e: EventoEndpoint) => void): Promise<PluginListenerHandle>
  addListener(evento: 'conectado', cb: (e: EventoEndpoint) => void): Promise<PluginListenerHandle>
  addListener(
    evento: 'desconectado',
    cb: (e: EventoEndpoint) => void,
  ): Promise<PluginListenerHandle>
  addListener(evento: 'datos', cb: (e: EventoDatos) => void): Promise<PluginListenerHandle>
}

let plugin: LemChatCercaniaPlugin | null | undefined

/** El plugin nativo, o null si esta plataforma no lo tiene. Nunca lanza. */
export function obtenerCercania(): LemChatCercaniaPlugin | null {
  if (plugin !== undefined) return plugin
  try {
    plugin = Capacitor.isNativePlatform()
      ? registerPlugin<LemChatCercaniaPlugin>('LemChatCercania')
      : null
  } catch {
    plugin = null
  }
  return plugin
}

export type CargaUtil =
  | { tipo: 'hola'; clave: string; nombre: string }
  | { tipo: 'mensaje'; id: string; sellado: string }
  | { tipo: 'ack'; id: string }
  | { tipo: 'aviso'; texto: string; firma: string }
  | { tipo: 'paquete'; sobre: string }
  | { tipo: 'invitacion-grupo'; id: string; sellado: string }
  | { tipo: 'grupo'; grupo: string; id: string; cifrado: string; firma: string }

export function leerCargaUtil(datos: string): CargaUtil | null {
  try {
    const datos2 = JSON.parse(datos) as CargaUtil
    if (!datos2 || typeof datos2.tipo !== 'string') return null
    return datos2
  } catch {
    return null
  }
}
