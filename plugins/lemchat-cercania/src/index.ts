// Definición TS del plugin LemChatCercania (el registro real en la app
// se hace por nombre desde src/lemchat/cercania.ts; este archivo es la
// fuente de la definición para quien reutilice el plugin).
import { registerPlugin } from '@capacitor/core'

export interface LemChatCercaniaPlugin {
  iniciar(opciones: { nombre: string }): Promise<{ activo: boolean }>
  detener(): Promise<void>
  reiniciar(opciones: { nombre: string }): Promise<{ activo: boolean }>
  enviar(opciones: { endpointId: string; datos: string }): Promise<void>
  addListener(evento: string, cb: (e: never) => void): Promise<{ remove: () => Promise<void> }>
}

export const LemChatCercania = registerPlugin<LemChatCercaniaPlugin>('LemChatCercania')
