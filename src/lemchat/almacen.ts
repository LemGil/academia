// Almacén propio de LemChat (diseño §6): carpeta «lemchat/» en el
// almacenamiento interno de la app, separada de «paquetes/» y de las
// claves de progreso. Si este almacén falla, el lector ni se entera
// (la pantalla CHAT se carga aparte y con su propia frontera de error).
//
// El estado completo de la Fase B cabe en un solo JSON (identidad,
// contactos y mensajes de un estudiante): se lee y se guarda entero,
// con las escrituras encadenadas para que dos guardados no se pisen.

import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { estadoChatVacio, type EstadoChat } from './tipos'

export interface AlmacenDatos {
  leer(): Promise<string | null>
  guardar(texto: string): Promise<void>
}

/** Almacén real: archivo lemchat/estado.json vía Capacitor Filesystem. */
export class AlmacenArchivo implements AlmacenDatos {
  private carpeta = 'lemchat'
  private archivo = 'estado.json'

  private async asegurarCarpeta() {
    try {
      await Filesystem.mkdir({ path: this.carpeta, directory: Directory.Data, recursive: true })
    } catch {
      // Ya existe.
    }
  }

  async leer(): Promise<string | null> {
    try {
      const res = await Filesystem.readFile({
        path: `${this.carpeta}/${this.archivo}`,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      })
      return res.data as string
    } catch {
      return null
    }
  }

  async guardar(texto: string): Promise<void> {
    await this.asegurarCarpeta()
    await Filesystem.writeFile({
      path: `${this.carpeta}/${this.archivo}`,
      data: texto,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    })
  }
}

/** Almacén en memoria: para pruebas y para degradar con honestidad si el
 *  almacenamiento del teléfono falla (la sesión funciona; no persiste). */
export class AlmacenMemoria implements AlmacenDatos {
  private texto: string | null = null
  async leer(): Promise<string | null> {
    return this.texto
  }
  async guardar(texto: string): Promise<void> {
    this.texto = texto
  }
}

export class RepositorioChat {
  private estado: EstadoChat = estadoChatVacio()
  private cargado = false
  private cadena: Promise<void> = Promise.resolve()

  constructor(private almacen: AlmacenDatos) {}

  async cargar(): Promise<EstadoChat> {
    if (!this.cargado) {
      this.cargado = true
      try {
        const crudo = await this.almacen.leer()
        if (crudo) {
          const datos = JSON.parse(crudo) as Partial<EstadoChat>
          this.estado = { ...estadoChatVacio(), ...datos }
        }
      } catch {
        // Estado dañado: se empieza de cero en el chat; el lector no depende de esto.
        this.estado = estadoChatVacio()
      }
    }
    return this.estado
  }

  datos(): EstadoChat {
    return this.estado
  }

  /** Aplica un cambio y lo persiste (encadenado). Devuelve el estado nuevo. */
  async actualizar(cambio: (e: EstadoChat) => void): Promise<EstadoChat> {
    await this.cargar()
    cambio(this.estado)
    const copia = JSON.stringify(this.estado)
    this.cadena = this.cadena.then(() => this.almacen.guardar(copia)).catch(() => {})
    await this.cadena
    return this.estado
  }

  contarNoLeidos(): number {
    return this.estado.mensajes.filter((m) => !m.mio && !m.leido).length
  }
}

/** Contador de no leídos en localStorage: SOLO el número, para que el
 *  botón CHAT de la barra lo pinte sin cargar todo LemChat (aislamiento).
 *  Si algo falla aquí, simplemente no se pinta contador. */
const CLAVE_NO_LEIDOS = 'lemchat_no_leidos_v1'

export function publicarNoLeidos(n: number) {
  try {
    localStorage.setItem(CLAVE_NO_LEIDOS, String(n))
  } catch {
    // Sin contador; el chat sigue funcionando.
  }
}

export function leerNoLeidosPublicados(): number {
  try {
    const n = parseInt(localStorage.getItem(CLAVE_NO_LEIDOS) ?? '0', 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}
