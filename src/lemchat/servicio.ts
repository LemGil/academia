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
import { abrir, sellar } from './cifrado'
import { decidirEntrega, leerSobre } from './entrega'
import {
  crearIdentidad,
  firmarTexto,
  leerCodigoDeContacto,
  verificarTexto,
  type DatosContacto,
} from './identidad'
import { RegistroPresencia } from './presencia'
import { leerCargaUtil, obtenerCercania, type LemChatCercaniaPlugin } from './cercania'
import {
  CONVERSACION_CANAL,
  DIRECCION_CANAL,
  type Contacto,
  type EstadoChat,
  type Mensaje,
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
  cercania: 'no-disponible' | 'apagada' | 'buscando' | 'activa'
  paresCercanos: number
}

export class ServicioChat {
  readonly repo: RepositorioChat
  readonly presencia = new RegistroPresencia()
  private buzon: Buzon
  private cercania: LemChatCercaniaPlugin | null
  private internet: EstadoVias['internet']
  private cercaniaActiva = false
  private escuchando = false

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

  estadoVias(): EstadoVias {
    return {
      internet: this.internet,
      cercania: !this.cercania
        ? 'no-disponible'
        : !this.datos().activado
          ? 'apagada'
          : this.cercaniaActiva
            ? 'activa'
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
    await this.iniciarCercania()
    await this.tocar()
    return estado
  }

  async desactivar(): Promise<void> {
    await this.repo.actualizar((e) => {
      e.activado = false
    })
    try {
      await this.cercania?.detener()
    } catch {
      // Si el nativo no responde, el interruptor local manda igual.
    }
    this.cercaniaActiva = false
    publicarNoLeidos(0)
    await this.tocar()
  }

  async reactivar(): Promise<void> {
    await this.repo.actualizar((e) => {
      e.activado = true
    })
    await this.iniciarCercania()
    await this.tocar()
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
    await this.reiniciarCercania()
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

  // --------------------------------------------------------- sincronizar

  /** Reintenta la cola y recoge el buzón. Seguro de llamar seguido. */
  async sincronizar(): Promise<void> {
    const estado = await this.cargar()
    if (!estado.activado || !estado.identidad) return
    for (const m of estado.mensajes.filter((x) => x.mio && x.estado === 'cola')) {
      await this.intentarEnviar(m)
    }
    if (this.buzon.configurado()) {
      try {
        const filas = await this.buzon.recibir(estado.identidad.clavePublica)
        this.internet = 'ok'
        for (const fila of filas) {
          await this.procesarFila(fila)
        }
      } catch {
        this.internet = 'error'
      }
    }
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
    }
  }

  private async procesarDelCanal(fila: FilaBuzon): Promise<void> {
    if (fila.de !== this.claveMaestroConfiable()) return // solo el maestro publica
    if (fila.tipo === 'paquete') {
      await this.procesarSobreRecibido(fila.cuerpo)
    } else if (fila.tipo === 'texto') {
      const id = `aviso_${fila.id}`
      if (this.datos().mensajes.some((m) => m.id === id)) return
      const mensaje: Mensaje = {
        id,
        conversacion: CONVERSACION_CANAL,
        de: fila.de,
        para: DIRECCION_CANAL,
        tipo: 'aviso',
        cuerpo: fila.cuerpo,
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
      const res = await this.cercania.iniciar({ nombre: yo.nombre })
      this.cercaniaActiva = res.activo
    } catch {
      this.cercaniaActiva = false
      this.escuchando = false
    }
    await this.tocar()
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
