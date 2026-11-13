// Servicio de LemChat: orquesta identidad, almacén, buzón y cercanía.
// La pantalla solo pinta lo que este servicio dice; los estados que
// muestra son los reales (cola/enviado/entregado), nunca adornos.
//
// Rutas al enviar un texto personal, en el orden del diseño (§5):
//   1. Cercanía Wi-Fi si el contacto está presente ahora → «enviado» y,
//      cuando llega su ack, «entregado».
//   2. Buzón por internet → «enviado» (y «entregado» cuando el otro
//      teléfono lo recoge y deja su recibo).
//   3. Sin vía → queda «en cola» en el teléfono. No se pierde.

import { AlmacenArchivo, AlmacenMemoria, RepositorioChat, publicarNoLeidos } from './almacen'
import { Buzon, firmarFila, filaEsAutentica, type FilaBuzon } from './buzon'
import { CLAVE_MAESTRO_FIJADA, SUPABASE_ANON_KEY, SUPABASE_URL } from './configSupabase'
import {
  abrir,
  cifrarSimetrico,
  descifrarSimetrico,
  esClaveSimetricaValida,
  generarClaveSimetrica,
  sellar,
} from './cifrado'
import { crearSobrePaquete, decidirEntrega, leerSobre } from './entrega'
import { crearSelloTexto, leerSello, selloEsValido } from './sello'
import {
  clavePublicaDe,
  crearIdentidad,
  firmarTexto,
  leerCodigoDeContacto,
  verificarTexto,
  type DatosContacto,
} from './identidad'
import { RegistroPresencia } from './presencia'
import {
  decidirCercania,
  leerCargaUtil,
  obtenerCercania,
  type LemChatCercaniaPlugin,
} from './cercania'
import {
  CONVERSACION_CANAL,
  DIRECCION_CANAL,
  conversacionDeGrupo,
  type Contacto,
  type EstadoChat,
  type Grupo,
  type Mensaje,
  type ModoCercania,
} from './tipos'
import { idAleatorio } from './util'
import type { Academia } from '../academia/contenido'

export interface AvisosServicio {
  /** Archiva un paquete YA verificado en la biblioteca (la pantalla lo
   *  conecta con importarPaquete + refrescar catálogo de App). Devuelve
   *  la academia archivada; si lanza, el paquete queda «a revisar». */
  alArchivarPaquete?: (textoPaquete: string) => Promise<Academia>
  /** Cambió algo que la pantalla debe repintar. */
  alCambiar?: () => void
}

export interface EstadoVias {
  internet: 'sin-configurar' | 'ok' | 'error'
  /** 'en-pausa' (v1.7.2): apagada a propósito porque internet responde. */
  cercania: 'no-disponible' | 'apagada' | 'buscando' | 'activa' | 'en-pausa'
  paresCercanos: number
}

/** Lo que viaja sellado en una invitación de grupo (Fase D): el descriptor
 *  del grupo SIN la clave, y la clave aparte — el formato del plan. */
interface InvitacionGrupo {
  grupo: Omit<Grupo, 'claveGrupo'>
  claveGrupo: string
}

/** Lee y valida el texto de una invitación recibida. Dañada: null. */
function leerInvitacionGrupo(texto: string): InvitacionGrupo | null {
  try {
    const datos = JSON.parse(texto) as Partial<InvitacionGrupo>
    const g = datos?.grupo
    if (!g || typeof g.id !== 'string' || !g.id) return null
    if (typeof g.nombre !== 'string' || !g.nombre.trim()) return null
    if (!Array.isArray(g.miembros) || g.miembros.some((m) => typeof m !== 'string')) return null
    if (typeof datos.claveGrupo !== 'string' || !esClaveSimetricaValida(datos.claveGrupo)) {
      return null
    }
    return {
      grupo: {
        id: g.id,
        nombre: g.nombre.trim(),
        academiaId: typeof g.academiaId === 'string' && g.academiaId ? g.academiaId : undefined,
        miembros: [...g.miembros],
      },
      claveGrupo: datos.claveGrupo,
    }
  } catch {
    return null
  }
}

/** Lo que el maestro firma en cada mensaje de grupo (por cercanía no hay
 *  fila del buzón que firme por él: la firma viaja en la carga misma). */
export function textoFirmadoGrupo(grupoId: string, mensajeId: string, cifrado: string): string {
  return `lemchat-grupo-v1|${grupoId}|${mensajeId}|${cifrado}`
}

export class ServicioChat {
  readonly repo: RepositorioChat
  readonly presencia = new RegistroPresencia()
  private buzon: Buzon
  private cercania: LemChatCercaniaPlugin | null
  private internet: EstadoVias['internet']
  private cercaniaActiva = false
  private escuchando = false
  /** v1.7.2: los oyentes del plugin se registran una sola vez en la
   *  vida del servicio; apagar/encender la cercanía (la política de
   *  vías lo hace seguido) no debe duplicarlos. */
  private oyentesCercania = false

  constructor(
    private avisos: AvisosServicio = {},
    opciones: { repo?: RepositorioChat; buzon?: Buzon; cercania?: LemChatCercaniaPlugin | null } = {},
  ) {
    this.repo =
      opciones.repo ?? new RepositorioChat(new AlmacenArchivo())
    this.buzon =
      opciones.buzon ?? new Buzon({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY })
    this.cercania = opciones.cercania !== undefined ? opciones.cercania : obtenerCercania()
    this.internet = this.buzon.configurado() ? 'ok' : 'sin-configurar'
  }

  // ------------------------------------------------------------------ base

  async cargar(): Promise<EstadoChat> {
    const estado = await this.repo.cargar()
    publicarNoLeidos(estado.activado ? this.repo.contarNoLeidos() : 0)
    return estado
  }

  datos(): EstadoChat {
    return this.repo.datos()
  }

  private async tocar() {
    publicarNoLeidos(this.datos().activado ? this.repo.contarNoLeidos() : 0)
    this.avisos.alCambiar?.()
  }

  /** El modo de cercanía elegido (v1.7.2); sin elegir, 'auto'. */
  modoCercania(): ModoCercania {
    return this.datos().cercaniaModo ?? 'auto'
  }

  estadoVias(): EstadoVias {
    const modo = this.modoCercania()
    return {
      internet: this.internet,
      cercania: !this.cercania
        ? 'no-disponible'
        : !this.datos().activado || modo === 'nunca'
          ? 'apagada'
          : this.cercaniaActiva
            ? 'activa'
            : modo === 'auto' && this.internet === 'ok'
              ? 'en-pausa'
              : 'buscando',
      paresCercanos: this.presencia.presentes(Date.now()).length,
    }
  }

  textoEstadoVias(): string {
    const v = this.estadoVias()
    const partes: string[] = []
    if (v.cercania === 'activa') partes.push(`Cercanía Wi-Fi (${v.paresCercanos} cerca)`)
    else if (v.cercania === 'buscando') partes.push('Cercanía buscando…')
    if (v.internet === 'ok') partes.push('Internet')
    if (partes.length === 0) return 'Sin vía ahora — tus mensajes quedan en cola'
    return `Vía ahora: ${partes.join(' · ')}`
  }

  // ------------------------------------------------------------- identidad

  async activar(nombre: string): Promise<EstadoChat> {
    const identidad = crearIdentidad(nombre)
    const estado = await this.repo.actualizar((e) => {
      e.identidad = identidad
      e.activado = true
    })
    await this.gestionarCercania()
    await this.tocar()
    return estado
  }

  async desactivar(): Promise<void> {
    await this.repo.actualizar((e) => {
      e.activado = false
    })
    await this.detenerCercania()
    publicarNoLeidos(0)
    await this.tocar()
  }

  async reactivar(): Promise<void> {
    await this.repo.actualizar((e) => {
      e.activado = true
    })
    await this.gestionarCercania()
    await this.tocar()
  }

  /**
   * Importa la llave del maestro (Fase D): el contenido del JSON que
   * genera `scripts/lemchat-claves-maestro.mjs` ({ nombre, clavePublica,
   * clavePrivada }). La validación es la de verdad: se deriva la pública
   * desde la privada y deben coincidir — un JSON pegado a medias o de
   * otra llave se rechaza con el motivo. Al importar, la identidad de
   * este teléfono PASA a ser la del maestro (soyMaestro) y la cercanía
   * se re-anuncia con ella.
   */
  async importarLlaveMaestro(json: string): Promise<void> {
    let datos: { nombre?: unknown; clavePublica?: unknown; clavePrivada?: unknown }
    try {
      datos = JSON.parse(json)
    } catch {
      throw new Error('eso no es el JSON de claves del maestro: revísalo y pégalo entero')
    }
    const { nombre, clavePublica, clavePrivada } = datos ?? {}
    if (
      typeof nombre !== 'string' ||
      !nombre.trim() ||
      typeof clavePublica !== 'string' ||
      typeof clavePrivada !== 'string'
    ) {
      throw new Error('al JSON le faltan campos: debe traer nombre, clavePublica y clavePrivada')
    }
    let derivada: string
    try {
      derivada = clavePublicaDe(clavePrivada)
    } catch {
      throw new Error('la clave privada del JSON no es una llave Ed25519 válida')
    }
    if (derivada !== clavePublica) {
      throw new Error('la llave privada no corresponde a la llave pública del JSON: no se importó nada')
    }
    await this.repo.actualizar((e) => {
      e.identidad = {
        nombre: nombre.trim(),
        clavePublica,
        clavePrivada,
        creadaEn: Date.now(),
      }
      e.soyMaestro = true
      e.activado = true
    })
    await this.tocar()
    // La identidad cambió (nombre/clave con que la cercanía se anuncia):
    // si la cercanía está encendida, se reinicia con lo nuevo; si la
    // política la tiene apagada, se queda apagada (v1.7.2).
    if (this.cercaniaActiva) await this.reiniciarCercania()
  }

  mensajesDe(conversacion: string): Mensaje[] {
    return this.datos()
      .mensajes.filter((m) => m.conversacion === conversacion)
      .sort((a, b) => a.ts - b.ts)
  }

  async marcarLeida(conversacion: string): Promise<void> {
    await this.repo.actualizar((e) => {
      for (const m of e.mensajes) {
        if (m.conversacion === conversacion && !m.mio) m.leido = true
      }
    })
    await this.tocar()
  }

  noLeidosDe(conversacion: string): number {
    return this.datos().mensajes.filter(
      (m) => m.conversacion === conversacion && !m.mio && !m.leido,
    ).length
  }

  claveMaestroConfiable(): string | null {
    if (CLAVE_MAESTRO_FIJADA) return CLAVE_MAESTRO_FIJADA
    // Si ESTE teléfono es el maestro (llave importada), su propia llave
    // es la del maestro: sus publicaciones del canal también le valen.
    if (this.datos().soyMaestro) return this.datos().identidad?.clavePublica ?? null
    const maestro = this.datos().contactos.find((c) => c.esMaestro)
    return maestro?.clavePublica ?? null
  }

  // ------------------------------------------------------------- contactos

  async agregarContacto(datos: DatosContacto): Promise<Contacto> {
    const propio = this.datos().identidad
    if (propio && datos.clavePublica === propio.clavePublica) {
      throw new Error('ese código es el tuyo, no el de un contacto')
    }
    const contacto: Contacto = {
      clavePublica: datos.clavePublica,
      nombre: datos.nombre,
      esMaestro: datos.esMaestro,
      agregadoEn: Date.now(),
    }
    await this.repo.actualizar((e) => {
      // Un solo contacto puede ser «el maestro» a la vez: el último QR
      // del maestro manda (así se corrige un QR equivocado).
      if (contacto.esMaestro) {
        e.contactos = e.contactos.map((c) => ({ ...c, esMaestro: false }))
      }
      const i = e.contactos.findIndex((c) => c.clavePublica === contacto.clavePublica)
      if (i >= 0) e.contactos[i] = contacto
      else e.contactos.push(contacto)
    })
    await this.tocar()
    return contacto
  }

  async agregarContactoPorCodigo(texto: string): Promise<Contacto> {
    const datos = leerCodigoDeContacto(texto)
    if (!datos) throw new Error('ese código no es un contacto LemChat válido')
    return this.agregarContacto(datos)
  }

  /**
   * Cambia el nombre de identificación de ESTE teléfono. La clave no se
   * toca: sigo siendo la misma persona para la red. Quienes ya me
   * agregaron conservan el nombre de mi código anterior hasta que
   * vuelvan a agregarme con el código nuevo (al hacerlo, su registro se
   * actualiza solo, porque se busca por clave). La cercanía se
   * re-anuncia con el nombre nuevo.
   */
  async cambiarMiNombre(nombre: string): Promise<void> {
    const limpio = nombre.trim()
    if (!limpio) throw new Error('el nombre no puede quedar vacío')
    if (!this.datos().identidad) throw new Error('primero activa CHAT')
    await this.repo.actualizar((e) => {
      if (e.identidad) e.identidad.nombre = limpio
    })
    await this.tocar()
    // La identidad cambió (nombre/clave con que la cercanía se anuncia):
    // si la cercanía está encendida, se reinicia con lo nuevo; si la
    // política la tiene apagada, se queda apagada (v1.7.2).
    if (this.cercaniaActiva) await this.reiniciarCercania()
  }

  /**
   * Borra un contacto y toda su conversación de este teléfono. Sirve
   * para rehacer limpio un cruce de códigos: borrar y volver a agregar
   * con el código correcto. Lo ya entregado en el OTRO teléfono no se
   * toca (cada teléfono guarda lo suyo).
   */
  async borrarContacto(clavePublica: string): Promise<void> {
    await this.repo.actualizar((e) => {
      e.contactos = e.contactos.filter((c) => c.clavePublica !== clavePublica)
      e.mensajes = e.mensajes.filter((m) => m.conversacion !== clavePublica)
    })
    await this.tocar()
  }

  // ------------------------------------------- grupos y canal (Fase D)

  private exigirMaestro(): NonNullable<EstadoChat['identidad']> {
    const yo = this.datos().identidad
    if (!yo) throw new Error('primero activa CHAT')
    if (!this.datos().soyMaestro) {
      throw new Error('solo el maestro: importa primero tu llave en Ajustes')
    }
    return yo
  }

  /**
   * Crea un grupo por academia (solo el maestro). Genera la clave del
   * grupo, lo guarda en local y manda a cada miembro su invitación 1:1
   * sellada: sin invitación no hay clave, y sin clave no hay lectura.
   */
  async crearGrupo(
    nombre: string,
    academiaId: string | undefined,
    clavesMiembros: string[],
  ): Promise<Grupo> {
    const yo = this.exigirMaestro()
    const limpio = nombre.trim()
    if (!limpio) throw new Error('el grupo necesita un nombre')
    const miembros = [...new Set([yo.clavePublica, ...clavesMiembros])]
    const grupo: Grupo = {
      id: idAleatorio('g'),
      nombre: limpio,
      academiaId: academiaId?.trim() ? academiaId.trim() : undefined,
      claveGrupo: generarClaveSimetrica(),
      miembros,
    }
    await this.repo.actualizar((e) => {
      e.grupos.push(grupo)
      e.mensajes.push({
        id: `grupo_creado_${grupo.id}`,
        conversacion: conversacionDeGrupo(grupo.id),
        de: yo.clavePublica,
        para: conversacionDeGrupo(grupo.id),
        tipo: 'texto',
        cuerpo: `Creaste el grupo «${grupo.nombre}». Aquí solo escribes tú; los miembros leen y te responden en su conversación personal contigo.`,
        ts: Date.now(),
        mio: false,
        estado: 'entregado',
        leido: true,
      })
    })
    for (const clave of miembros) {
      if (clave !== yo.clavePublica) await this.enviarInvitacionGrupo(grupo, clave)
    }
    await this.tocar()
    return grupo
  }

  /**
   * Agrega un miembro a un grupo ya creado (o le reenvía la invitación
   * si ya era miembro). La clave del grupo no cambia en v1: quien entra
   * puede leer también lo publicado antes de su llegada.
   */
  async invitarMiembroGrupo(grupoId: string, claveMiembro: string): Promise<void> {
    this.exigirMaestro()
    const grupo = this.datos().grupos.find((g) => g.id === grupoId)
    if (!grupo) throw new Error('ese grupo ya no está en este teléfono')
    if (!grupo.miembros.includes(claveMiembro)) {
      await this.repo.actualizar((e) => {
        const g = e.grupos.find((x) => x.id === grupoId)
        if (g && !g.miembros.includes(claveMiembro)) g.miembros.push(claveMiembro)
      })
    }
    const actualizado = this.datos().grupos.find((g) => g.id === grupoId) ?? grupo
    await this.enviarInvitacionGrupo(actualizado, claveMiembro)
    await this.tocar()
  }

  /** Manda la invitación sellada a UN miembro: cercanía si está presente
   *  (como un mensaje personal) y, si no, el buzón. Si ninguna vía lo
   *  acepta ahora, se puede reenviar luego con invitarMiembroGrupo. */
  private async enviarInvitacionGrupo(grupo: Grupo, claveMiembro: string): Promise<void> {
    const yo = this.datos().identidad
    if (!yo || claveMiembro === yo.clavePublica) return
    const { claveGrupo: _clave, ...descriptor } = grupo
    const invitacion: InvitacionGrupo = { grupo: descriptor, claveGrupo: grupo.claveGrupo }
    const sellado = sellar(yo.clavePrivada, claveMiembro, JSON.stringify(invitacion))
    const id = idAleatorio('inv')
    // 1) Cercanía, si el miembro está presente ahora.
    const par = this.presencia.porClave(claveMiembro, Date.now())
    if (this.cercania && par) {
      try {
        await this.cercania.enviar({
          endpointId: par.endpointId,
          datos: JSON.stringify({ tipo: 'invitacion-grupo', id, sellado }),
        })
        return
      } catch {
        // Se cayó a mitad: se prueba el buzón.
      }
    }
    // 2) Buzón por internet.
    if (this.buzon.configurado()) {
      try {
        const fila = firmarFila(yo.clavePrivada, {
          de: yo.clavePublica,
          para: claveMiembro,
          tipo: 'invitacion-grupo',
          cuerpo: JSON.stringify({ id, sellado }),
        })
        await this.buzon.enviar(fila)
        this.internet = 'ok'
      } catch {
        this.internet = 'error'
      }
    }
  }

  /**
   * Recibe una invitación YA abierta (el texto sellado descifrado): solo
   * se acepta si el remitente es MI maestro de confianza; cualquier otro
   * remitente se descarta en silencio. Al aceptar, el grupo queda
   * guardado (por id: una re-invitación actualiza el descriptor) y el
   * hilo recibe su mensaje de sistema, una sola vez.
   */
  private async aceptarInvitacionGrupo(deClave: string, textoInvitacion: string): Promise<void> {
    const yo = this.datos().identidad
    if (!yo) return
    if (deClave !== this.claveMaestroConfiable()) return
    const invitacion = leerInvitacionGrupo(textoInvitacion)
    if (!invitacion) return
    const grupo: Grupo = { ...invitacion.grupo, claveGrupo: invitacion.claveGrupo }
    // El grupo es de quien me invita: su clave siempre está entre los miembros.
    if (!grupo.miembros.includes(deClave)) grupo.miembros.push(deClave)
    const yaEstaba = this.datos().grupos.some((g) => g.id === grupo.id)
    await this.repo.actualizar((e) => {
      const i = e.grupos.findIndex((g) => g.id === grupo.id)
      if (i >= 0) e.grupos[i] = grupo
      else e.grupos.push(grupo)
      const idSistema = `grupo_inv_${grupo.id}`
      if (!yaEstaba && !e.mensajes.some((m) => m.id === idSistema)) {
        e.mensajes.push({
          id: idSistema,
          conversacion: conversacionDeGrupo(grupo.id),
          de: deClave,
          para: yo.clavePublica,
          tipo: 'texto',
          cuerpo: `Te agregaron al grupo «${grupo.nombre}». Aquí escribe el maestro; para responderle, usa tu conversación personal con él.`,
          ts: Date.now(),
          mio: false,
          estado: 'entregado',
          leido: false,
        })
      }
    })
    await this.tocar()
  }

  /**
   * Publica un mensaje en un grupo (solo el maestro, difusión v1). El
   * cuerpo viaja cifrado con la clave del grupo y firmado por el
   * maestro; en local se guarda en claro, como los demás mensajes.
   */
  async publicarEnGrupo(grupoId: string, texto: string): Promise<Mensaje> {
    const yo = this.exigirMaestro()
    const limpio = texto.trim()
    if (!limpio) throw new Error('el mensaje está vacío')
    if (!this.datos().grupos.some((g) => g.id === grupoId)) {
      throw new Error('ese grupo ya no está en este teléfono')
    }
    const mensaje: Mensaje = {
      id: idAleatorio('m'),
      conversacion: conversacionDeGrupo(grupoId),
      de: yo.clavePublica,
      para: conversacionDeGrupo(grupoId),
      tipo: 'texto',
      cuerpo: limpio,
      ts: Date.now(),
      mio: true,
      estado: 'cola',
      leido: true,
    }
    await this.repo.actualizar((e) => {
      e.mensajes.push(mensaje)
    })
    await this.intentarPublicarGrupo(mensaje)
    await this.tocar()
    return mensaje
  }

  /** Saca un mensaje de grupo en cola: cercanía a los miembros presentes
   *  y buzón para los demás. Si alguna vía lo acepta: «enviado». */
  private async intentarPublicarGrupo(mensaje: Mensaje): Promise<void> {
    const yo = this.datos().identidad
    if (!yo || mensaje.estado !== 'cola') return
    const grupo = this.datos().grupos.find((g) => conversacionDeGrupo(g.id) === mensaje.conversacion)
    if (!grupo) return
    const cifrado = cifrarSimetrico(grupo.claveGrupo, mensaje.cuerpo)
    let salio = false
    // 1) Cercanía: a cada miembro presente.
    if (this.cercania) {
      const firma = firmarTexto(yo.clavePrivada, textoFirmadoGrupo(grupo.id, mensaje.id, cifrado))
      for (const par of this.presencia.presentes(Date.now())) {
        if (!par.clavePublica || !grupo.miembros.includes(par.clavePublica)) continue
        if (par.clavePublica === yo.clavePublica) continue
        try {
          await this.cercania.enviar({
            endpointId: par.endpointId,
            datos: JSON.stringify({
              tipo: 'grupo',
              grupo: grupo.id,
              id: mensaje.id,
              cifrado,
              firma,
            }),
          })
          salio = true
        } catch {
          // Ese par se cayó a mitad: los demás siguen.
        }
      }
    }
    // 2) Buzón: la fila queda para que cada miembro la recoja (no se
    // borra al leer, como las del canal: la leen todos los miembros).
    if (this.buzon.configurado()) {
      try {
        const fila = firmarFila(yo.clavePrivada, {
          de: yo.clavePublica,
          para: conversacionDeGrupo(grupo.id),
          tipo: 'grupo',
          cuerpo: JSON.stringify({ id: mensaje.id, cifrado }),
        })
        await this.buzon.enviar(fila)
        this.internet = 'ok'
        salio = true
      } catch {
        this.internet = 'error'
      }
    }
    if (salio) await this.marcarEstado(mensaje.id, 'enviado')
  }

  /** Guarda un mensaje de grupo recibido (buzón o cercanía), una vez. */
  private async guardarMensajeGrupoRecibido(
    grupo: Grupo,
    deClave: string,
    id: string,
    cifrado: string,
  ): Promise<void> {
    const yo = this.datos().identidad
    if (!yo) return
    if (this.datos().mensajes.some((m) => m.id === id)) return
    const texto = descifrarSimetrico(grupo.claveGrupo, cifrado)
    if (texto === null) return
    const mensaje: Mensaje = {
      id,
      conversacion: conversacionDeGrupo(grupo.id),
      de: deClave,
      para: conversacionDeGrupo(grupo.id),
      tipo: 'texto',
      cuerpo: texto,
      ts: Date.now(),
      mio: deClave === yo.clavePublica,
      estado: 'entregado',
      leido: deClave === yo.clavePublica,
    }
    await this.repo.actualizar((e) => {
      e.mensajes.push(mensaje)
    })
  }

  /**
   * Publica un aviso en el canal TEMAS APOSTÓLICOS (solo el maestro).
   * Sale firmado por el buzón (tipo 'aviso', para = canal) y se anuncia
   * por cercanía con la carga que la recepción ya entiende; en local se
   * guarda como mensaje mío del canal, para que el maestro también vea
   * lo suyo.
   */
  async publicarAvisoCanal(texto: string): Promise<void> {
    const yo = this.exigirMaestro()
    const limpio = texto.trim()
    if (!limpio) throw new Error('el aviso está vacío')
    const mensaje: Mensaje = {
      id: idAleatorio('aviso'),
      conversacion: CONVERSACION_CANAL,
      de: yo.clavePublica,
      para: DIRECCION_CANAL,
      tipo: 'aviso',
      cuerpo: limpio,
      ts: Date.now(),
      mio: true,
      estado: 'entregado',
      leido: true,
    }
    await this.repo.actualizar((e) => {
      e.mensajes.push(mensaje)
    })
    if (this.buzon.configurado()) {
      try {
        await this.buzon.enviar(
          firmarFila(yo.clavePrivada, {
            de: yo.clavePublica,
            para: DIRECCION_CANAL,
            tipo: 'aviso',
            cuerpo: limpio,
          }),
        )
        this.internet = 'ok'
      } catch {
        this.internet = 'error'
      }
    }
    await this.difundirAvisoCercania(limpio)
    await this.tocar()
  }

  /**
   * Publica una enseñanza en el canal (solo el maestro): construye el
   * sobre firmado con crearSobrePaquete — el mismo que decide entregar
   * (`decidirEntrega`) en los teléfonos de los estudiantes — y lo manda
   * por el buzón (tipo 'paquete') y por cercanía (tipo 'paquete').
   */
  async publicarEnsenanzaCanal(academiaId: string, paqueteTexto: string): Promise<void> {
    const yo = this.exigirMaestro()
    const id = academiaId.trim()
    if (!id) throw new Error('la enseñanza necesita el id de su paquete (ej. lemgil-14)')
    if (!paqueteTexto.trim()) throw new Error('pega el texto del paquete de la enseñanza')
    const sobre = crearSobrePaquete(paqueteTexto, id, yo.clavePublica, yo.clavePrivada)
    const textoSobre = JSON.stringify(sobre)
    // Copia local con el MISMO id que genera procesarSobreRecibido: si
    // la fila del canal vuelve a este teléfono, no se duplica.
    const mensaje: Mensaje = {
      id: `pkg_${sobre.academiaId}_${sobre.emitido}`,
      conversacion: CONVERSACION_CANAL,
      de: yo.clavePublica,
      para: DIRECCION_CANAL,
      tipo: 'paquete',
      cuerpo: `Enseñanza publicada en el canal: ${id}.`,
      ts: Date.now(),
      mio: true,
      estado: 'entregado',
      leido: true,
      paqueteId: id,
    }
    await this.repo.actualizar((e) => {
      e.mensajes.push(mensaje)
    })
    if (this.buzon.configurado()) {
      try {
        await this.buzon.enviar(
          firmarFila(yo.clavePrivada, {
            de: yo.clavePublica,
            para: DIRECCION_CANAL,
            tipo: 'paquete',
            cuerpo: textoSobre,
          }),
        )
        this.internet = 'ok'
      } catch {
        this.internet = 'error'
      }
    }
    // Por cercanía: la carga 'paquete' que la recepción ya procesa.
    if (this.cercania) {
      for (const par of this.presencia.presentes(Date.now())) {
        try {
          await this.cercania.enviar({
            endpointId: par.endpointId,
            datos: JSON.stringify({ tipo: 'paquete', sobre: textoSobre }),
          })
        } catch {
          // Ese par se cayó a mitad: los demás siguen.
        }
      }
    }
    await this.tocar()
  }

  // --------------------------------------------------------------- envío

  async enviarTexto(claveDestino: string, texto: string): Promise<Mensaje> {
    const yo = this.datos().identidad
    if (!yo) throw new Error('primero activa CHAT')
    const limpio = texto.trim()
    if (!limpio) throw new Error('el mensaje está vacío')
    const mensaje: Mensaje = {
      id: idAleatorio('m'),
      conversacion: claveDestino,
      de: yo.clavePublica,
      para: claveDestino,
      tipo: 'texto',
      cuerpo: limpio,
      ts: Date.now(),
      mio: true,
      estado: 'cola',
      leido: true,
    }
    await this.repo.actualizar((e) => {
      e.mensajes.push(mensaje)
    })
    await this.intentarEnviar(mensaje)
    await this.tocar()
    return mensaje
  }

  /** Intenta sacar un mensaje en cola por la mejor vía disponible. */
  private async intentarEnviar(mensaje: Mensaje): Promise<void> {
    const yo = this.datos().identidad
    if (!yo || mensaje.estado !== 'cola') return
    // 1) Cercanía: si el contacto está presente, va directo.
    const par = this.presencia.porClave(mensaje.para, Date.now())
    if (this.cercania && par) {
      try {
        const sellado = sellar(yo.clavePrivada, mensaje.para, mensaje.cuerpo)
        await this.cercania.enviar({
          endpointId: par.endpointId,
          datos: JSON.stringify({ tipo: 'mensaje', id: mensaje.id, sellado }),
        })
        await this.marcarEstado(mensaje.id, 'enviado')
        return
      } catch {
        // La cercanía falló a mitad: se prueba el buzón.
      }
    }
    // 2) Buzón por internet.
    if (this.buzon.configurado()) {
      try {
        const sellado = sellar(yo.clavePrivada, mensaje.para, mensaje.cuerpo)
        const fila = firmarFila(yo.clavePrivada, {
          de: yo.clavePublica,
          para: mensaje.para,
          tipo: 'texto',
          cuerpo: JSON.stringify({ id: mensaje.id, sellado }),
        })
        await this.buzon.enviar(fila)
        this.internet = 'ok'
        await this.marcarEstado(mensaje.id, 'enviado')
      } catch {
        this.internet = 'error'
      }
    }
  }

  private async marcarEstado(id: string, estado: Mensaje['estado']) {
    await this.repo.actualizar((e) => {
      const m = e.mensajes.find((x) => x.id === id)
      if (m) m.estado = estado
    })
  }

  // ------------------------------------------ sello del encuentro (v1.7)

  /** El maestro genera el código (QR/texto) con el que, en el encuentro
   *  presencial, sus alumnos dan por concluida una academia. Uno fresco
   *  por encuentro: la marca cambia en cada generación. */
  generarSelloEncuentro(academiaId: string): string {
    const yo = this.exigirMaestro()
    const id = academiaId.trim()
    if (!id) throw new Error('elige la academia del encuentro')
    return crearSelloTexto(id, yo)
  }

  /** Verifica un código de sello escaneado o pegado por el alumno:
   *  devuelve de qué academia y encuentro es, o null si no es válido
   *  (no es un sello, o no lo firmó su maestro de confianza). */
  async verificarSelloEncuentro(
    texto: string,
  ): Promise<{ academiaId: string; encuentro: string } | null> {
    await this.cargar()
    const sello = leerSello(texto)
    if (!sello) return null
    if (!selloEsValido(sello, this.claveMaestroConfiable())) return null
    return { academiaId: sello.academiaId, encuentro: sello.encuentro }
  }

  // --------------------------------------------------------- sincronizar

  /** Reintenta la cola y recoge el buzón. Seguro de llamar seguido. */
  async sincronizar(): Promise<void> {
    const estado = await this.cargar()
    if (!estado.activado || !estado.identidad) return
    if (!estado.canalReintentoV161) {
      // v1.6.1: la v1.6.0 marcaba las filas del canal como procesadas aun
      // cuando eran del propio maestro y no se mostraban en su teléfono
      // (lo publicado desde LemWriter). Se reintentan una sola vez;
      // reprocesar es seguro: avisos y paquetes se deduplican por id.
      await this.repo.actualizar((e) => {
        e.canalProcesados = []
        e.canalReintentoV161 = true
      })
    }
    for (const m of estado.mensajes.filter((x) => x.mio && x.estado === 'cola')) {
      if (m.conversacion.startsWith('grupo:')) await this.intentarPublicarGrupo(m)
      else await this.intentarEnviar(m)
    }
    if (this.buzon.configurado()) {
      try {
        // Además de lo mío y el canal: las direcciones de MIS grupos.
        const extras = estado.grupos.map((g) => conversacionDeGrupo(g.id))
        const filas = await this.buzon.recibir(estado.identidad.clavePublica, extras)
        this.internet = 'ok'
        for (const fila of filas) {
          await this.procesarFila(fila)
        }
      } catch {
        this.internet = 'error'
      }
    }
    // v1.7.2: con el estado de internet fresco, la política de vías
    // decide si la cercanía debe estar encendida o apagada.
    await this.gestionarCercania()
    await this.tocar()
  }

  private async procesarFila(fila: FilaBuzon): Promise<void> {
    const yo = this.datos().identidad
    if (!yo || !fila.id) return
    if (!filaEsAutentica(fila)) {
      // Firma inválida: no es de quien dice ser. Se borra si era para mí;
      // si es del canal, se ignora y queda a expirar sola.
      if (fila.para === yo.clavePublica) await this.borrarFilaSeguro(fila.id)
      return
    }
    if (fila.tipo === 'recibo' && fila.para === yo.clavePublica) {
      await this.marcarEstado(fila.cuerpo.trim(), 'entregado')
      await this.borrarFilaSeguro(fila.id)
      return
    }
    if (fila.para === DIRECCION_CANAL) {
      if (this.datos().canalProcesados.includes(fila.id)) return
      await this.repo.actualizar((e) => {
        e.canalProcesados = [...e.canalProcesados.slice(-400), fila.id as string]
      })
      await this.procesarDelCanal(fila)
      return
    }
    if (fila.para.startsWith('grupo:')) {
      await this.procesarFilaGrupo(fila)
      return
    }
    if (fila.para !== yo.clavePublica) return
    // Mensaje personal para mí.
    if (fila.tipo === 'texto') {
      try {
        const datos = JSON.parse(fila.cuerpo) as { id: string; sellado: string }
        const texto = abrir(yo.clavePrivada, fila.de, datos.sellado)
        if (texto !== null && !this.datos().mensajes.some((m) => m.id === datos.id)) {
          const mensaje: Mensaje = {
            id: datos.id,
            conversacion: fila.de,
            de: fila.de,
            para: yo.clavePublica,
            tipo: 'texto',
            cuerpo: texto,
            ts: Date.now(),
            mio: false,
            estado: 'entregado',
            leido: false,
          }
          await this.repo.actualizar((e) => {
            e.mensajes.push(mensaje)
          })
        }
      } catch {
        // Cuerpo dañado: se recoge y se borra igual, no envenena el buzón.
      }
      await this.enviarRecibo(fila.de, fila)
      await this.borrarFilaSeguro(fila.id)
    } else if (fila.tipo === 'paquete') {
      await this.procesarSobreRecibido(fila.cuerpo)
      await this.enviarRecibo(fila.de, fila)
      await this.borrarFilaSeguro(fila.id)
    } else if (fila.tipo === 'invitacion-grupo') {
      // Invitación a un grupo: se abre el sello y la aceptación decide
      // (solo si el remitente es mi maestro de confianza). La fila se
      // borra siempre: aceptada o no, ya se procesó.
      try {
        const datos = JSON.parse(fila.cuerpo) as { sellado?: string }
        if (typeof datos.sellado === 'string') {
          const texto = abrir(yo.clavePrivada, fila.de, datos.sellado)
          if (texto !== null) await this.aceptarInvitacionGrupo(fila.de, texto)
        }
      } catch {
        // Invitación dañada: se descarta en silencio, como manda el plan.
      }
      await this.borrarFilaSeguro(fila.id)
    }
  }

  /**
   * Una fila dirigida a «grupo:<id>». Las filas de grupo, como las del
   * canal, las leen todos los miembros: NO se borran al leer (expiran
   * solas en el servidor) y se anota cuáles ya se procesaron. Solo entra
   * lo firmado por el maestro y solo si tengo la clave de ese grupo.
   */
  private async procesarFilaGrupo(fila: FilaBuzon): Promise<void> {
    const yo = this.datos().identidad
    if (!yo || !fila.id) return
    if (fila.tipo !== 'grupo') return
    const grupoId = fila.para.slice('grupo:'.length)
    const grupo = this.datos().grupos.find((g) => g.id === grupoId)
    if (!grupo) return // no es mi grupo: no tengo su clave, nada que hacer
    if (this.datos().gruposProcesados.includes(fila.id)) return
    await this.repo.actualizar((e) => {
      e.gruposProcesados = [...e.gruposProcesados.slice(-400), fila.id as string]
    })
    const maestro = this.claveMaestroConfiable()
    if (!maestro || fila.de !== maestro) return // en el grupo solo publica el maestro
    try {
      const datos = JSON.parse(fila.cuerpo) as { id?: string; cifrado?: string }
      if (typeof datos.id === 'string' && typeof datos.cifrado === 'string') {
        await this.guardarMensajeGrupoRecibido(grupo, fila.de, datos.id, datos.cifrado)
      }
    } catch {
      // Cuerpo dañado: ya quedó anotada como procesada; no envenena.
    }
  }

  private async procesarDelCanal(fila: FilaBuzon): Promise<void> {
    if (fila.de !== this.claveMaestroConfiable()) return // solo el maestro publica
    // Lo firmado por el maestro vale también en SU teléfono, aunque se haya
    // publicado desde fuera (LemWriter): antes la v1.6.0 lo descartaba
    // entero suponiendo que ya estaba guardado al publicar, y eso solo es
    // cierto de lo compuesto en el propio teléfono. La deduplicación de lo
    // compuesto aquí ya la hacen los ids de mensaje (pkg_<id>_<emitido> en
    // procesarSobreRecibido, y el contenido en los avisos, abajo).
    if (fila.tipo === 'paquete') {
      await this.procesarSobreRecibido(fila.cuerpo)
    } else if (fila.tipo === 'aviso' || fila.tipo === 'texto') {
      const id = `aviso_${fila.id}`
      if (this.datos().mensajes.some((m) => m.id === id)) return
      const esMio = fila.de === this.datos().identidad?.clavePublica
      // Aviso compuesto en ESTE teléfono: al publicar ya quedó guardado
      // como mío (con id aleatorio); no se duplica al volver por el buzón.
      if (
        esMio &&
        this.datos().mensajes.some(
          (m) =>
            m.mio &&
            m.conversacion === CONVERSACION_CANAL &&
            m.tipo === 'aviso' &&
            m.cuerpo === fila.cuerpo,
        )
      )
        return
      const mensaje: Mensaje = {
        id,
        conversacion: CONVERSACION_CANAL,
        de: fila.de,
        para: DIRECCION_CANAL,
        tipo: 'aviso',
        cuerpo: fila.cuerpo,
        ts: Date.now(),
        mio: esMio,
        estado: 'entregado',
        leido: false,
      }
      await this.repo.actualizar((e) => {
        e.mensajes.push(mensaje)
      })
    }
  }

  /** Un paquete que llegó por cualquier vía pasa por la puerta firmada. */
  async procesarSobreRecibido(textoSobre: string): Promise<void> {
    const decision = decidirEntrega(textoSobre, this.claveMaestroConfiable())
    if (decision.accion === 'rechazar') return
    const sobre = decision.sobre
    const idMensaje = `pkg_${sobre.academiaId}_${sobre.emitido}`
    if (this.datos().mensajes.some((m) => m.id === idMensaje)) return
    if (decision.accion === 'archivar') {
      // El guardado real lo hace App vía la pantalla (importarPaquete +
      // refrescar catálogo): el camino de importación ya probado. Solo si
      // el guardado prospera se anuncia «ya está en tus Academias».
      let archivada: Academia | null = null
      try {
        archivada = this.avisos.alArchivarPaquete
          ? await this.avisos.alArchivarPaquete(sobre.paqueteTexto)
          : decision.academia
      } catch {
        archivada = null
      }
      if (!archivada) {
        const mensaje: Mensaje = {
          id: idMensaje,
          conversacion: CONVERSACION_CANAL,
          de: sobre.claveMaestro,
          para: DIRECCION_CANAL,
          tipo: 'paquete',
          cuerpo: `Llegó una enseñanza verificada (${sobre.academiaId}) pero no se pudo guardar en la biblioteca. No se instaló.`,
          ts: Date.now(),
          mio: false,
          estado: 'entregado',
          leido: false,
          paqueteId: sobre.academiaId,
          paqueteSinVerificar: true,
        }
        await this.repo.actualizar((e) => {
          e.mensajes.push(mensaje)
        })
        await this.tocar()
        return
      }
      const mensaje: Mensaje = {
        id: idMensaje,
        conversacion: CONVERSACION_CANAL,
        de: sobre.claveMaestro,
        para: DIRECCION_CANAL,
        tipo: 'paquete',
        cuerpo: `Nueva enseñanza recibida: ${archivada.numero} — ${archivada.titulo}. Ya está en tus Academias.`,
        ts: Date.now(),
        mio: false,
        estado: 'entregado',
        leido: false,
        paqueteId: archivada.id,
        paqueteTitulo: `${archivada.numero} — ${archivada.titulo}`,
      }
      await this.repo.actualizar((e) => {
        e.mensajes.push(mensaje)
      })
    } else {
      // Sin verificar: se ofrece a revisar, jamás se instala en silencio.
      const posible = leerSobre(textoSobre)
      const mensaje: Mensaje = {
        id: idMensaje,
        conversacion: CONVERSACION_CANAL,
        de: sobre.claveMaestro,
        para: DIRECCION_CANAL,
        tipo: 'paquete',
        cuerpo: `Llegó un paquete de enseñanza pero NO se pudo verificar su firma (${decision.motivo}). No se instaló.`,
        ts: Date.now(),
        mio: false,
        estado: 'entregado',
        leido: false,
        paqueteId: posible?.academiaId,
        paqueteSinVerificar: true,
      }
      await this.repo.actualizar((e) => {
        e.mensajes.push(mensaje)
      })
    }
    await this.tocar()
  }

  private async enviarRecibo(para: string, filaOriginal: FilaBuzon): Promise<void> {
    const yo = this.datos().identidad
    if (!yo || !this.buzon.configurado()) return
    try {
      const datos = JSON.parse(filaOriginal.cuerpo) as { id?: string }
      const idOriginal = datos.id ?? filaOriginal.id ?? ''
      if (!idOriginal) return
      const recibo = firmarFila(yo.clavePrivada, {
        de: yo.clavePublica,
        para,
        tipo: 'recibo',
        cuerpo: idOriginal,
      })
      await this.buzon.enviar(recibo)
    } catch {
      // Sin recibo, el remitente verá «enviado» en vez de «entregado»:
      // es la verdad disponible, no un fallo del mensaje.
    }
  }

  private async borrarFilaSeguro(id: string): Promise<void> {
    try {
      await this.buzon.borrar(id)
    } catch {
      // Si no se borra, al recoger otra vez se deduplica por id local.
    }
  }

  // ------------------------------------------------------------- cercanía

  async iniciarCercania(): Promise<void> {
    const yo = this.datos().identidad
    if (!yo || !this.datos().activado || !this.cercania || this.escuchando) return
    this.escuchando = true
    try {
      if (!this.oyentesCercania) {
        await this.registrarOyentesCercania()
        this.oyentesCercania = true
      }
      const res = await this.cercania.iniciar({ nombre: yo.nombre })
      this.cercaniaActiva = res.activo
      if (!res.activo) this.escuchando = false
    } catch {
      this.cercaniaActiva = false
      this.escuchando = false
    }
    await this.tocar()
  }

  /** Apaga la cercanía de verdad (v1.7.2): plugin detenido, presencia
   *  limpia. La política de vías y la salida del CHAT la usan. */
  async detenerCercania(): Promise<void> {
    if (!this.cercania) return
    try {
      await this.cercania.detener()
    } catch {
      // Si el nativo no responde, el estado local manda igual.
    }
    this.cercaniaActiva = false
    this.escuchando = false
    this.presencia.limpiar()
    await this.tocar()
  }

  /**
   * Aplica la política de vías (v1.7.2): según el modo elegido y el
   * estado de internet, enciende o apaga la cercanía. Se llama tras
   * cada sincronización (el buzón dice si hay internet) y al cambiar
   * el modo en Ajustes.
   */
  async gestionarCercania(): Promise<void> {
    if (!this.cercania || !this.datos().activado || !this.datos().identidad) return
    const decision = decidirCercania(this.modoCercania(), this.internet, this.cercaniaActiva)
    if (decision === 'iniciar') await this.iniciarCercania()
    else if (decision === 'detener') await this.detenerCercania()
  }

  /** El alumno/maestro elige el modo en Ajustes; se aplica al momento. */
  async fijarModoCercania(modo: ModoCercania): Promise<void> {
    await this.repo.actualizar((e) => {
      e.cercaniaModo = modo
    })
    await this.gestionarCercania()
    await this.tocar()
  }

  /** Los oyentes del plugin, registrados una única vez (v1.7.2). */
  private async registrarOyentesCercania(): Promise<void> {
    if (!this.cercania) return
    await this.cercania.addListener('descubierto', (e) => {
        this.presencia.tocar(e.endpointId, e.nombre, Date.now())
        void this.tocar()
      })
      await this.cercania.addListener('perdido', (e) => {
        this.presencia.olvidar(e.endpointId)
        void this.tocar()
      })
      await this.cercania.addListener('conectado', async (e) => {
        const id = this.datos().identidad
        if (!id) return
        this.presencia.tocar(e.endpointId, '', Date.now())
        // El saludo solo hace falta si aún no sé la clave de este
        // endpoint (v1.5.3: en una reconexión ya conocida no se repite;
        // si la presencia lo olvidó al desconectar, se vuelve a mandar).
        if (!this.presencia.porEndpoint(e.endpointId)?.clavePublica) {
          try {
            await this.cercania?.enviar({
              endpointId: e.endpointId,
              datos: JSON.stringify({ tipo: 'hola', clave: id.clavePublica, nombre: id.nombre }),
            })
          } catch {
            // El saludo se reintenta al siguiente dato.
          }
        }
        void this.tocar()
      })
      await this.cercania.addListener('desconectado', (e) => {
        this.presencia.olvidar(e.endpointId)
        void this.tocar()
      })
      await this.cercania.addListener('datos', (e) => {
        void this.procesarDatosCercania(e.endpointId, e.datos)
      })
  }

  /** El botón visible de la lección de la Fase A: reinicia la escucha. */
  async reiniciarCercania(): Promise<void> {
    const yo = this.datos().identidad
    if (!yo || !this.cercania) return
    try {
      const res = await this.cercania.reiniciar({ nombre: yo.nombre })
      this.cercaniaActiva = res.activo
      this.presencia.limpiar()
    } catch {
      this.cercaniaActiva = false
    }
    await this.tocar()
  }

  private async procesarDatosCercania(endpointId: string, datos: string): Promise<void> {
    const yo = this.datos().identidad
    if (!yo) return
    const carga = leerCargaUtil(datos)
    if (!carga) return
    this.presencia.tocar(endpointId, '', Date.now())
    if (carga.tipo === 'hola') {
      this.presencia.tocar(endpointId, carga.nombre, Date.now(), carga.clave)
      // Al saber quién es, se intenta sacar la cola hacia él.
      for (const m of this.datos().mensajes.filter((x) => x.mio && x.estado === 'cola')) {
        if (m.para === carga.clave) await this.intentarEnviar(m)
        else if (m.conversacion.startsWith('grupo:')) {
          // Cola de grupo: si el que saludó es miembro, puede salir ya.
          const g = this.datos().grupos.find(
            (x) => conversacionDeGrupo(x.id) === m.conversacion,
          )
          if (g?.miembros.includes(carga.clave)) await this.intentarPublicarGrupo(m)
        }
      }
    } else if (carga.tipo === 'invitacion-grupo') {
      // Solo vale si el par que la trae ES mi maestro de confianza (la
      // aceptación vuelve a comprobarlo sobre el remitente del sello).
      const par = this.presencia.porEndpoint(endpointId)
      if (par?.clavePublica && par.clavePublica === this.claveMaestroConfiable()) {
        const texto = abrir(yo.clavePrivada, par.clavePublica, carga.sellado)
        if (texto !== null) await this.aceptarInvitacionGrupo(par.clavePublica, texto)
      }
    } else if (carga.tipo === 'grupo') {
      // Mensaje de grupo por cercanía: descifrar con la clave de MI
      // grupo y verificar la firma del maestro (la carga la trae).
      const grupo = this.datos().grupos.find((g) => g.id === carga.grupo)
      const maestro = this.claveMaestroConfiable()
      if (
        grupo &&
        maestro &&
        verificarTexto(maestro, carga.firma, textoFirmadoGrupo(carga.grupo, carga.id, carga.cifrado))
      ) {
        await this.guardarMensajeGrupoRecibido(grupo, maestro, carga.id, carga.cifrado)
      }
    } else if (carga.tipo === 'mensaje') {
      const par = this.presencia.porEndpoint(endpointId)
      if (!par?.clavePublica) return
      const texto = abrir(yo.clavePrivada, par.clavePublica, carga.sellado)
      if (texto === null) return
      if (!this.datos().mensajes.some((m) => m.id === carga.id)) {
        const mensaje: Mensaje = {
          id: carga.id,
          conversacion: par.clavePublica,
          de: par.clavePublica,
          para: yo.clavePublica,
          tipo: 'texto',
          cuerpo: texto,
          ts: Date.now(),
          mio: false,
          estado: 'entregado',
          leido: false,
        }
        await this.repo.actualizar((e) => {
          e.mensajes.push(mensaje)
        })
      }
      try {
        await this.cercania?.enviar({
          endpointId,
          datos: JSON.stringify({ tipo: 'ack', id: carga.id }),
        })
      } catch {
        // El mensaje ya quedó guardado; el ack es cortesía.
      }
    } else if (carga.tipo === 'ack') {
      await this.marcarEstado(carga.id, 'entregado')
    } else if (carga.tipo === 'paquete') {
      await this.procesarSobreRecibido(carga.sobre)
    } else if (carga.tipo === 'aviso') {
      const par = this.presencia.porEndpoint(endpointId)
      const maestro = this.claveMaestroConfiable()
      if (par?.clavePublica && maestro && par.clavePublica === maestro) {
        if (verificarTexto(maestro, carga.firma, carga.texto)) {
          const id = `aviso_cerca_${Date.now()}`
          const mensaje: Mensaje = {
            id,
            conversacion: CONVERSACION_CANAL,
            de: maestro,
            para: DIRECCION_CANAL,
            tipo: 'aviso',
            cuerpo: carga.texto,
            ts: Date.now(),
            mio: false,
            estado: 'entregado',
            leido: false,
          }
          await this.repo.actualizar((e) => {
            e.mensajes.push(mensaje)
          })
        }
      }
    }
    await this.tocar()
  }

  /** Envía un aviso firmado del maestro por cercanía (lo usa la pantalla
   *  del maestro si este teléfono ES el maestro; los estudiantes no). */
  async difundirAvisoCercania(texto: string): Promise<number> {
    const yo = this.datos().identidad
    if (!yo || !this.cercania) return 0
    const firma = firmarTexto(yo.clavePrivada, texto)
    let enviados = 0
    for (const par of this.presencia.presentes(Date.now())) {
      try {
        await this.cercania.enviar({
          endpointId: par.endpointId,
          datos: JSON.stringify({ tipo: 'aviso', texto, firma }),
        })
        enviados++
      } catch {
        // Ese par se cayó a mitad: los demás siguen.
      }
    }
    return enviados
  }
}

// ---------------------------------------------------------------------------
// Instancia compartida de la app (se crea al abrir CHAT por primera vez:
// aislamiento — nada de LemChat corre mientras el estudiante solo lee).
// ---------------------------------------------------------------------------

let instancia: ServicioChat | null = null

export function obtenerServicio(avisos?: AvisosServicio): ServicioChat {
  if (!instancia) {
    instancia = new ServicioChat(avisos)
  } else if (avisos) {
    // La pantalla nueva trae los avisos frescos de App.
    ;(instancia as unknown as { avisos: AvisosServicio }).avisos = avisos
  }
  return instancia
}

/** Solo para pruebas: servicio con memoria y sin nativo. */
export function crearServicioParaPruebas(opciones?: {
  buzon?: Buzon
  avisos?: AvisosServicio
}): ServicioChat {
  return new ServicioChat(opciones?.avisos, {
    repo: new RepositorioChat(new AlmacenMemoria()),
    buzon: opciones?.buzon,
    cercania: null,
  })
}
