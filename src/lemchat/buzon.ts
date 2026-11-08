// Buzón por internet (diseño §5, vía 2): tabla `lc_mensajes` en el MISMO
// Supabase que ya comparten LemWriter y la Academia — sin SDK, solo REST.
//
// El buzón es una oficina pública y tonta a propósito: guarda sobres
// sellados y firmados, y los entrega a quien se presenta con la clave
// destinataria. La privacidad la da el cifrado extremo a extremo y la
// confianza la dan las firmas Ed25519; la tabla no decide nada.
//
// Semántica:
// - Mensaje personal: el destinatario lo recoge y la fila se BORRA.
// - Canal (para = 'canal'): lo lee todo el mundo; la fila NO se borra al
//   leer (la app anota qué filas ya procesó) y expira sola a los 30 días.
// - Recibo: cuando el destinatario guarda un mensaje personal, deja un
//   recibo para el remitente; así el ✓ «entregado» dice la verdad.

import { sha256 } from '@noble/hashes/sha2'
import { firmarTexto, verificarTexto } from './identidad'
import { bytesAHex, textoABytes } from './util'
import { DIRECCION_CANAL } from './tipos'

export type TipoFilaBuzon = 'texto' | 'paquete' | 'recibo' | 'aviso' | 'invitacion-grupo' | 'grupo'

export interface FilaBuzon {
  id?: string
  de: string
  para: string
  tipo: TipoFilaBuzon
  cuerpo: string
  firma: string
  creado_en?: string
}

export interface ConfigSupabase {
  url: string
  anonKey: string
}

type FuncionFetch = (url: string, init?: RequestInit) => Promise<Response>

/** Lo que se firma: remitente, destino, tipo y huella del cuerpo.
 *  El cuerpo de un paquete puede pesar ~200 KB: se firma su huella. */
export function textoFirmadoBuzon(de: string, para: string, tipo: TipoFilaBuzon, cuerpo: string): string {
  const huella = bytesAHex(sha256(textoABytes(cuerpo)))
  return `lemchat-buzon-v1|${de}|${para}|${tipo}|${huella}`
}

export function firmarFila(clavePrivada: string, fila: Omit<FilaBuzon, 'firma' | 'id'>): FilaBuzon {
  return {
    ...fila,
    firma: firmarTexto(clavePrivada, textoFirmadoBuzon(fila.de, fila.para, fila.tipo, fila.cuerpo)),
  }
}

export function filaEsAutentica(fila: FilaBuzon): boolean {
  return verificarTexto(
    fila.de,
    fila.firma,
    textoFirmadoBuzon(fila.de, fila.para, fila.tipo, fila.cuerpo),
  )
}

export class Buzon {
  constructor(
    private config: ConfigSupabase,
    private fetchFn: FuncionFetch = (...args) => fetch(...args),
  ) {}

  configurado(): boolean {
    return this.config.url.trim().length > 0 && this.config.anonKey.trim().length > 0
  }

  private cabeceras(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.config.anonKey,
      Authorization: `Bearer ${this.config.anonKey}`,
      'Content-Type': 'application/json',
      ...extra,
    }
  }

  private base(): string {
    return `${this.config.url.replace(/\/$/, '')}/rest/v1/lc_mensajes`
  }

  async enviar(fila: FilaBuzon): Promise<void> {
    const { id: _id, creado_en: _c, ...insertable } = fila
    const res = await this.fetchFn(this.base(), {
      method: 'POST',
      headers: this.cabeceras({ Prefer: 'return=minimal' }),
      body: JSON.stringify(insertable),
    })
    if (!res.ok) throw new Error(`el buzón rechazó el envío (${res.status})`)
  }

  /** Recoge lo dirigido a mí, lo publicado en el canal y lo dirigido a
   *  las direcciones extra que me tocan (Fase D: «grupo:<id>» de cada
   *  grupo al que pertenezco). */
  async recibir(miClave: string, extras: string[] = []): Promise<FilaBuzon[]> {
    const direcciones = [miClave, DIRECCION_CANAL, ...extras]
    const o = direcciones.map((d) => `para.eq.${encodeURIComponent(d)}`).join(',')
    const consulta =
      `?select=id,de,para,tipo,cuerpo,firma,creado_en` +
      `&or=(${o})` +
      `&order=creado_en.asc&limit=200`
    const res = await this.fetchFn(this.base() + consulta, { headers: this.cabeceras() })
    if (!res.ok) throw new Error(`el buzón no respondió (${res.status})`)
    return (await res.json()) as FilaBuzon[]
  }

  async borrar(id: string): Promise<void> {
    const res = await this.fetchFn(`${this.base()}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.cabeceras({ Prefer: 'return=minimal' }),
    })
    if (!res.ok) throw new Error(`el buzón no borró la fila (${res.status})`)
  }
}
