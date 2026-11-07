import { describe, expect, it } from 'vitest'
import { Buzon, type FilaBuzon } from './buzon'
import { DIRECCION_CANAL } from './tipos'
import { crearSobrePaquete } from './entrega'
import { firmarFila } from './buzon'
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

  override async recibir(miClave: string): Promise<FilaBuzon[]> {
    return this.filas.filter((f) => f.para === miClave || f.para === DIRECCION_CANAL)
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
