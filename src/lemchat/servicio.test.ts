import { describe, expect, it } from 'vitest'
import { Buzon, type FilaBuzon } from './buzon'
import { CONVERSACION_CANAL, DIRECCION_CANAL, conversacionDeGrupo } from './tipos'
import { crearSobrePaquete } from './entrega'
import { firmarFila } from './buzon'
import { crearIdentidad } from './identidad'
import { descifrarSimetrico, generarClaveSimetrica, sellar } from './cifrado'
import { crearServicioParaPruebas, type ServicioChat } from './servicio'

/** Buzón falso compartido: dos servicios hablando por el «mismo servidor». */
class BuzonFalso extends Buzon {
  filas: FilaBuzon[] = []
  private siguienteId = 1

  constructor() {
    super({ url: 'https://falso.local', anonKey: 'x' })
  }

  override configurado(): boolean {
    return true
  }

  override async enviar(fila: FilaBuzon): Promise<void> {
    this.filas.push({ ...fila, id: `fila_${this.siguienteId++}` })
  }

  override async recibir(miClave: string, extras: string[] = []): Promise<FilaBuzon[]> {
    return this.filas.filter(
      (f) => f.para === miClave || f.para === DIRECCION_CANAL || extras.includes(f.para),
    )
  }

  override async borrar(id: string): Promise<void> {
    this.filas = this.filas.filter((f) => f.id !== id)
  }
}

async function parActivado(servidor: BuzonFalso) {
  const a = crearServicioParaPruebas({ buzon: servidor })
  const b = crearServicioParaPruebas({ buzon: servidor })
  await a.activar('Lem')
  await b.activar('Gil')
  const idA = a.datos().identidad!
  const idB = b.datos().identidad!
  await a.agregarContacto({ nombre: 'Gil', clavePublica: idB.clavePublica, esMaestro: false })
  await b.agregarContacto({ nombre: 'Lem', clavePublica: idA.clavePublica, esMaestro: false })
  return { a, b, idA, idB }
}

describe('servicio: mensajes personales por el buzón', () => {
  it('flujo completo: cola → enviado → entregado, y el otro lo lee descifrado', async () => {
    const servidor = new BuzonFalso()
    const { a, b, idB } = await parActivado(servidor)

    const enviado = await a.enviarTexto(idB.clavePublica, 'Paz, hermano')
    expect(enviado.estado).toBe('enviado') // salió al buzón

    await b.sincronizar()
    const recibidos = b.datos().mensajes.filter((m) => !m.mio)
    expect(recibidos).toHaveLength(1)
    expect(recibidos[0].cuerpo).toBe('Paz, hermano')
    expect(b.repo.contarNoLeidos()).toBe(1)

    // El recibo vuelve y el remitente ve «entregado» — la verdad, no un adorno.
    await a.sincronizar()
    const enA = a.datos().mensajes.find((m) => m.id === enviado.id)
    expect(enA?.estado).toBe('entregado')
    // Y el buzón quedó vacío: ni el mensaje ni el recibo quedan rondando.
    expect(servidor.filas).toHaveLength(0)
  })

  it('sin buzón configurado el mensaje espera en cola, no se pierde', async () => {
    const sinBuzon = new Buzon({ url: '', anonKey: '' })
    const s = crearServicioParaPruebas({ buzon: sinBuzon })
    await s.activar('Lem')
    const otro = crearServicioParaPruebas({ buzon: sinBuzon })
    await otro.activar('Gil')
    const destino = otro.datos().identidad!.clavePublica
    const m = await s.enviarTexto(destino, 'cuando haya vía')
    expect(m.estado).toBe('cola')
    expect(s.datos().mensajes).toHaveLength(1)
  })

  it('una fila con firma falsa se descarta y se borra, no entra como mensaje', async () => {
    const servidor = new BuzonFalso()
    const { b, idA, idB } = await parActivado(servidor)
    servidor.filas.push({
      id: 'fila_falsa',
      de: idA.clavePublica, // dice ser Lem…
      para: idB.clavePublica,
      tipo: 'texto',
      cuerpo: '{"id":"m_falso","sellado":"AAAA"}',
      firma: 'firma-inventada', // …pero no puede probarlo
    })
    await b.sincronizar()
    expect(b.datos().mensajes.filter((m) => !m.mio)).toHaveLength(0)
    expect(servidor.filas.find((f) => f.id === 'fila_falsa')).toBeUndefined()
  })
})

describe('servicio: entrega de enseñanzas', () => {
  const PAQUETE = JSON.stringify({
    tipo: 'paquete-academia',
    formato: 1,
    academia: {
      id: 'lemgil-14',
      numero: 'Nº 14',
      titulo: 'Descodificando la Prueba',
      autor: 'LemGil Apóstol',
      codigos: [{ id: 'lemgil-14-c1', titulo: 'Código 1', subtitulo: '', cuerpo: 'Texto.' }],
      cierre: '',
    },
  })

  it('paquete del maestro por el canal → se archiva y se anuncia una sola vez', async () => {
    const servidor = new BuzonFalso()
    const archivados: string[] = []
    const estudiante = crearServicioParaPruebas({
      buzon: servidor,
      avisos: {
        alArchivarPaquete: async (texto: string) => {
          archivados.push(texto)
          const { validarPaquete } = await import('../academia/paquetes')
          return validarPaquete(texto)
        },
      },
    })
    const maestroSvc = crearServicioParaPruebas({ buzon: servidor })
    await estudiante.activar('Estudiante')
    await maestroSvc.activar('LemGil Apóstol')
    const maestro = maestroSvc.datos().identidad!
    // El estudiante agrega al maestro por su QR (marca de maestro).
    await estudiante.agregarContacto({
      nombre: 'LemGil Apóstol',
      clavePublica: maestro.clavePublica,
      esMaestro: true,
    })
    // El maestro publica el paquete en el canal (como hará su herramienta).
    const sobre = crearSobrePaquete(PAQUETE, 'lemgil-14', maestro.clavePublica, maestro.clavePrivada)
    await servidor.enviar(
      firmarFila(maestro.clavePrivada, {
        de: maestro.clavePublica,
        para: DIRECCION_CANAL,
        tipo: 'paquete',
        cuerpo: JSON.stringify(sobre),
      }),
    )

    await estudiante.sincronizar()
    expect(archivados).toHaveLength(1)
    const anuncios = estudiante.datos().mensajes.filter((m) => m.tipo === 'paquete')
    expect(anuncios).toHaveLength(1)
    expect(anuncios[0].paqueteId).toBe('lemgil-14')
    expect(anuncios[0].cuerpo).toContain('Ya está en tus Academias')

    // Segunda sincronización: la fila del canal sigue ahí (la leen todos),
    // pero no se archiva dos veces ni se duplica el anuncio.
    await estudiante.sincronizar()
    expect(archivados).toHaveLength(1)
    expect(estudiante.datos().mensajes.filter((m) => m.tipo === 'paquete')).toHaveLength(1)
  })

  it('paquete de un impostor en el canal → no se archiva ni se anuncia como enseñanza', async () => {
    const servidor = new BuzonFalso()
    const archivados: string[] = []
    const estudiante = crearServicioParaPruebas({
      buzon: servidor,
      avisos: {
        alArchivarPaquete: async (texto: string) => {
          archivados.push(texto)
          const { validarPaquete } = await import('../academia/paquetes')
          return validarPaquete(texto)
        },
      },
    })
    const maestroSvc = crearServicioParaPruebas({ buzon: servidor })
    const impostorSvc = crearServicioParaPruebas({ buzon: servidor })
    await estudiante.activar('Estudiante')
    await maestroSvc.activar('Maestro')
    await impostorSvc.activar('Impostor')
    const maestro = maestroSvc.datos().identidad!
    const impostor = impostorSvc.datos().identidad!
    await estudiante.agregarContacto({
      nombre: 'Maestro',
      clavePublica: maestro.clavePublica,
      esMaestro: true,
    })
    // El impostor firma con SU llave y publica en el canal.
    const sobre = crearSobrePaquete(PAQUETE, 'lemgil-14', impostor.clavePublica, impostor.clavePrivada)
    await servidor.enviar(
      firmarFila(impostor.clavePrivada, {
        de: impostor.clavePublica,
        para: DIRECCION_CANAL,
        tipo: 'paquete',
        cuerpo: JSON.stringify(sobre),
      }),
    )
    await estudiante.sincronizar()
    expect(archivados).toHaveLength(0)
    // En el canal solo publica el maestro: lo del impostor se ignora entero,
    // ni siquiera como «a revisar» (eso es para entregas personales/cercanía).
    expect(estudiante.datos().mensajes.filter((m) => m.tipo === 'paquete')).toHaveLength(0)
  })

  it('paquete sin verificar entregado en persona → queda «a revisar», no se archiva', async () => {
    const servidor = new BuzonFalso()
    const archivados: string[] = []
    const estudiante = crearServicioParaPruebas({
      buzon: servidor,
      avisos: {
        alArchivarPaquete: async (texto: string) => {
          archivados.push(texto)
          const { validarPaquete } = await import('../academia/paquetes')
          return validarPaquete(texto)
        },
      },
    })
    const cualquieraSvc = crearServicioParaPruebas({ buzon: servidor })
    await estudiante.activar('Estudiante')
    await cualquieraSvc.activar('Cualquiera')
    const cualquiera = cualquieraSvc.datos().identidad!
    const yoEst = estudiante.datos().identidad!
    // Alguien le manda un paquete firmado por una llave que no es el maestro.
    const sobre = crearSobrePaquete(PAQUETE, 'lemgil-14', cualquiera.clavePublica, cualquiera.clavePrivada)
    await servidor.enviar(
      firmarFila(cualquiera.clavePrivada, {
        de: cualquiera.clavePublica,
        para: yoEst.clavePublica,
        tipo: 'paquete',
        cuerpo: JSON.stringify(sobre),
      }),
    )
    await estudiante.sincronizar()
    expect(archivados).toHaveLength(0)
    const recibidos = estudiante.datos().mensajes.filter((m) => m.tipo === 'paquete')
    expect(recibidos).toHaveLength(1)
    expect(recibidos[0].paqueteSinVerificar).toBe(true)
    expect(recibidos[0].cuerpo).toContain('No se instaló')
  })
})

describe('servicio: identidad y contactos (arreglos v1.5.2)', () => {
  it('cambiarMiNombre actualiza el nombre y conserva la misma clave', async () => {
    const servidor = new BuzonFalso()
    const { a, idA } = await parActivado(servidor)
    await a.cambiarMiNombre('Pastor')
    const despues = a.datos().identidad!
    expect(despues.nombre).toBe('Pastor')
    expect(despues.clavePublica).toBe(idA.clavePublica)
    expect(despues.clavePrivada).toBe(idA.clavePrivada)
    await expect(a.cambiarMiNombre('   ')).rejects.toThrow()
  })

  it('borrarContacto quita el contacto y su conversación, y no toca a los demás', async () => {
    const servidor = new BuzonFalso()
    const { a, b, idB } = await parActivado(servidor)
    // Un segundo contacto con su propio mensaje, para ver que sobrevive.
    const c = crearServicioParaPruebas({ buzon: servidor })
    await c.activar('Luis')
    const idC = c.datos().identidad!
    await a.agregarContacto({ nombre: 'Luis', clavePublica: idC.clavePublica, esMaestro: false })
    await a.enviarTexto(idB.clavePublica, 'para Gil')
    await a.enviarTexto(idC.clavePublica, 'para Luis')
    expect(a.datos().contactos).toHaveLength(2)
    expect(a.mensajesDe(idB.clavePublica)).toHaveLength(1)

    await a.borrarContacto(idB.clavePublica)

    expect(a.datos().contactos.map((x) => x.clavePublica)).toEqual([idC.clavePublica])
    expect(a.mensajesDe(idB.clavePublica)).toHaveLength(0)
    expect(a.mensajesDe(idC.clavePublica)).toHaveLength(1)
    // El otro teléfono no pierde nada: cada uno guarda lo suyo.
    expect(b.datos().contactos).toHaveLength(1)
    void b
  })
})

describe('servicio: Fase D — maestro, canal y grupos', () => {
  /** Escenario Fase D: un teléfono que importa la llave del maestro y
   *  dos estudiantes que ya lo tienen agregado como maestro. */
  async function escenarioMaestro(servidor: BuzonFalso) {
    const llaves = crearIdentidad('LemGil Apóstol')
    const jsonMaestro = JSON.stringify({
      nombre: llaves.nombre,
      clavePublica: llaves.clavePublica,
      clavePrivada: llaves.clavePrivada,
      creada: '2026-11-08T00:00:00.000Z',
    })
    const maestroSvc = crearServicioParaPruebas({ buzon: servidor })
    await maestroSvc.activar('Teléfono del maestro')
    await maestroSvc.importarLlaveMaestro(jsonMaestro)
    const est1 = crearServicioParaPruebas({ buzon: servidor })
    const est2 = crearServicioParaPruebas({ buzon: servidor })
    await est1.activar('Gil')
    await est2.activar('Luis')
    const idMaestro = maestroSvc.datos().identidad!
    const id1 = est1.datos().identidad!
    const id2 = est2.datos().identidad!
    await est1.agregarContacto({
      nombre: 'LemGil Apóstol',
      clavePublica: idMaestro.clavePublica,
      esMaestro: true,
    })
    await est2.agregarContacto({
      nombre: 'LemGil Apóstol',
      clavePublica: idMaestro.clavePublica,
      esMaestro: true,
    })
    await maestroSvc.agregarContacto({
      nombre: 'Gil',
      clavePublica: id1.clavePublica,
      esMaestro: false,
    })
    await maestroSvc.agregarContacto({
      nombre: 'Luis',
      clavePublica: id2.clavePublica,
      esMaestro: false,
    })
    return { maestroSvc, est1, est2, idMaestro, id1, id2 }
  }

  it('importarLlaveMaestro rechaza una privada que no corresponde a la pública', async () => {
    const servidor = new BuzonFalso()
    const s = crearServicioParaPruebas({ buzon: servidor })
    await s.activar('Teléfono')
    const llaves = crearIdentidad('LemGil Apóstol')
    const otra = crearIdentidad('Otra persona')
    // La privada es de OTRA identidad: no corresponde a la pública.
    await expect(
      s.importarLlaveMaestro(
        JSON.stringify({
          nombre: llaves.nombre,
          clavePublica: llaves.clavePublica,
          clavePrivada: otra.clavePrivada,
        }),
      ),
    ).rejects.toThrow()
    await expect(s.importarLlaveMaestro('{no es json')).rejects.toThrow()
    expect(s.datos().soyMaestro).toBe(false)
    // Con el par correcto sí: la identidad pasa a ser la del maestro.
    await s.importarLlaveMaestro(
      JSON.stringify({
        nombre: llaves.nombre,
        clavePublica: llaves.clavePublica,
        clavePrivada: llaves.clavePrivada,
      }),
    )
    expect(s.datos().soyMaestro).toBe(true)
    expect(s.datos().identidad?.clavePublica).toBe(llaves.clavePublica)
    expect(s.datos().identidad?.nombre).toBe('LemGil Apóstol')
  })

  it('un estudiante no puede crear grupos ni publicar en el canal', async () => {
    const servidor = new BuzonFalso()
    const { est1, id2 } = await escenarioMaestro(servidor)
    await expect(est1.crearGrupo('Grupo', undefined, [id2.clavePublica])).rejects.toThrow()
    await expect(est1.publicarAvisoCanal('aviso falso')).rejects.toThrow()
    expect(servidor.filas).toHaveLength(0)
  })

  it('la invitación de quien NO es el maestro se descarta en silencio', async () => {
    const servidor = new BuzonFalso()
    const { est1, id1, id2 } = await escenarioMaestro(servidor)
    // Luis (un estudiante más) fabrica una invitación con su propia llave.
    const invitacionFalsa = JSON.stringify({
      grupo: {
        id: 'g_falso',
        nombre: 'Grupo falso',
        miembros: [id2.clavePublica, id1.clavePublica],
      },
      claveGrupo: generarClaveSimetrica(),
    })
    const sellado = sellar(id2.clavePrivada, id1.clavePublica, invitacionFalsa)
    await servidor.enviar(
      firmarFila(id2.clavePrivada, {
        de: id2.clavePublica,
        para: id1.clavePublica,
        tipo: 'invitacion-grupo',
        cuerpo: JSON.stringify({ id: 'inv_falsa', sellado }),
      }),
    )
    await est1.sincronizar()
    expect(est1.datos().grupos).toHaveLength(0)
    expect(est1.mensajesDe('grupo:g_falso')).toHaveLength(0)
  })

  it('la invitación del maestro instala el grupo y deja el mensaje de sistema', async () => {
    const servidor = new BuzonFalso()
    const { maestroSvc, est1, id1 } = await escenarioMaestro(servidor)
    const grupo = await maestroSvc.crearGrupo('Estudiantes Nº 14', 'lemgil-14', [id1.clavePublica])
    expect(maestroSvc.datos().grupos).toHaveLength(1)

    await est1.sincronizar()
    const grupos = est1.datos().grupos
    expect(grupos).toHaveLength(1)
    expect(grupos[0].id).toBe(grupo.id)
    expect(grupos[0].nombre).toBe('Estudiantes Nº 14')
    expect(grupos[0].academiaId).toBe('lemgil-14')
    expect(grupos[0].claveGrupo).toBe(grupo.claveGrupo)
    expect(grupos[0].miembros).toContain(id1.clavePublica)
    const hilo = est1.mensajesDe(conversacionDeGrupo(grupo.id))
    expect(hilo.some((m) => m.cuerpo.includes('Te agregaron al grupo'))).toBe(true)
    // La fila de la invitación se consumió: no queda rondando en el buzón.
    expect(servidor.filas.filter((f) => f.tipo === 'invitacion-grupo')).toHaveLength(0)
  })

  it('mensaje de grupo: el miembro lo descifra y lo ve; el no-miembro no obtiene el texto', async () => {
    const servidor = new BuzonFalso()
    const { maestroSvc, est1, est2, id1 } = await escenarioMaestro(servidor)
    const grupo = await maestroSvc.crearGrupo('Grupo de prueba', undefined, [id1.clavePublica])
    await est1.sincronizar()

    await maestroSvc.publicarEnGrupo(grupo.id, 'Bienvenidos: mañana el Código 3')
    await est1.sincronizar()
    const hilo = est1
      .mensajesDe(conversacionDeGrupo(grupo.id))
      .filter((m) => m.cuerpo.includes('Código 3'))
    expect(hilo).toHaveLength(1)

    // Luis no es miembro: no recoge la fila ni ve el hilo.
    await est2.sincronizar()
    expect(est2.datos().grupos).toHaveLength(0)
    expect(est2.mensajesDe(conversacionDeGrupo(grupo.id))).toHaveLength(0)

    // Y con la fila en la mano, sin la clave del grupo no hay texto:
    // el cuerpo viaja cifrado y una clave ajena no lo abre.
    const filaGrupo = servidor.filas.find((f) => f.tipo === 'grupo')!
    expect(filaGrupo.cuerpo).not.toContain('Código 3')
    const datos = JSON.parse(filaGrupo.cuerpo) as { cifrado: string }
    expect(descifrarSimetrico(generarClaveSimetrica(), datos.cifrado)).toBeNull()
    expect(descifrarSimetrico(grupo.claveGrupo, datos.cifrado)).toContain('Código 3')
  })

  it('aviso del canal desde la identidad importada: el estudiante lo recibe válido', async () => {
    const servidor = new BuzonFalso()
    const { maestroSvc, est1 } = await escenarioMaestro(servidor)
    await maestroSvc.publicarAvisoCanal('Mañana estudiamos el Código 3')

    await est1.sincronizar()
    const avisosEst = est1
      .datos()
      .mensajes.filter((m) => m.conversacion === CONVERSACION_CANAL && m.tipo === 'aviso')
    expect(avisosEst).toHaveLength(1)
    expect(avisosEst[0].cuerpo).toBe('Mañana estudiamos el Código 3')

    // El maestro también ve lo suyo en su canal (guardado al publicar)…
    await maestroSvc.sincronizar()
    const avisosMaestro = maestroSvc
      .datos()
      .mensajes.filter((m) => m.conversacion === CONVERSACION_CANAL && m.tipo === 'aviso')
    expect(avisosMaestro).toHaveLength(1)
    // …y nadie duplica al sincronizar de nuevo.
    await est1.sincronizar()
    expect(
      est1.datos().mensajes.filter((m) => m.conversacion === CONVERSACION_CANAL && m.tipo === 'aviso'),
    ).toHaveLength(1)
  })

  it('lo publicado por el maestro DESDE FUERA (LemWriter) también llega a su propio teléfono', async () => {
    const servidor = new BuzonFalso()
    const { maestroSvc, idMaestro } = await escenarioMaestro(servidor)
    // Como hace LemWriter: aviso + paquete firmados con la llave del
    // maestro, directos al buzón del canal, sin pasar por este teléfono.
    const PAQUETE = JSON.stringify({
      tipo: 'paquete-academia',
      formato: 1,
      academia: {
        id: 'lemgil-14',
        numero: 'Nº 14',
        titulo: 'Descodificando la Prueba',
        autor: 'LemGil Apóstol',
        codigos: [{ id: 'lemgil-14-c1', titulo: 'Código 1', subtitulo: '', cuerpo: 'Texto.' }],
        cierre: '',
      },
    })
    await servidor.enviar(
      firmarFila(idMaestro.clavePrivada, {
        de: idMaestro.clavePublica,
        para: DIRECCION_CANAL,
        tipo: 'aviso',
        cuerpo: 'Nueva enseñanza: Descodificando la Prueba',
      }),
    )
    const sobre = crearSobrePaquete(PAQUETE, 'lemgil-14', idMaestro.clavePublica, idMaestro.clavePrivada)
    await servidor.enviar(
      firmarFila(idMaestro.clavePrivada, {
        de: idMaestro.clavePublica,
        para: DIRECCION_CANAL,
        tipo: 'paquete',
        cuerpo: JSON.stringify(sobre),
      }),
    )

    await maestroSvc.sincronizar()
    const canal = maestroSvc.datos().mensajes.filter((m) => m.conversacion === CONVERSACION_CANAL)
    expect(canal.filter((m) => m.tipo === 'aviso')).toHaveLength(1)
    const anuncios = canal.filter((m) => m.tipo === 'paquete')
    expect(anuncios).toHaveLength(1)
    expect(anuncios[0].paqueteId).toBe('lemgil-14')

    // Y al sincronizar de nuevo no se duplica nada.
    await maestroSvc.sincronizar()
    const canal2 = maestroSvc.datos().mensajes.filter((m) => m.conversacion === CONVERSACION_CANAL)
    expect(canal2.filter((m) => m.tipo === 'aviso')).toHaveLength(1)
    expect(canal2.filter((m) => m.tipo === 'paquete')).toHaveLength(1)
  })
})
