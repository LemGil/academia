// Pantalla CHAT (Fase B). Se carga SOLO cuando el estudiante abre la
// pestaña (carga perezosa + frontera de error en App): si algo de aquí
// falla, el lector ni se entera.
//
// Bloques, en el orden del diseño (§2): estado de la vía, canal del
// maestro fijado, conversaciones personales, cercanos con «visto hace»
// y ajustes con el interruptor general. La Fase D suma los grupos por
// academia (difusión del maestro), el compositor del canal en el
// teléfono del maestro y la importación de su llave en Ajustes.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { version } from '../../package.json'
import type { Academia } from '../academia/contenido'
import { CodigoQR } from './CodigoQR'
import { escanearCodigoConCamara } from './escaneo'
import { codigoDeContacto } from './identidad'
import { obtenerServicio, type ServicioChat } from './servicio'
import { CONVERSACION_CANAL, conversacionDeGrupo, type Mensaje } from './tipos'
import { haceCuanto } from './util'

interface Props {
  /** Archiva en la biblioteca un paquete ya verificado (lo pasa App). */
  alArchivarPaquete: (textoPaquete: string) => Promise<Academia>
  /** Salta a una academia ya archivada (patrón de Progreso). */
  alAbrirAcademia: (id: string) => void
}

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'conversacion'; clave: string }
  | { tipo: 'canal' }
  | { tipo: 'agregar' }
  | { tipo: 'ajustes' }
  | { tipo: 'crear-grupo' }
  | { tipo: 'grupo'; id: string }

const ICONO_ESTADO: Record<Mensaje['estado'], string> = {
  cola: '⏳ en cola',
  enviado: '📤 enviado',
  entregado: '✓ entregado',
}

export const PantallaChat: React.FC<Props> = ({ alArchivarPaquete, alAbrirAcademia }) => {
  const servicioRef = useRef<ServicioChat | null>(null)
  if (!servicioRef.current) {
    servicioRef.current = obtenerServicio({
      alArchivarPaquete,
      alCambiar: () => setRepintar((n) => n + 1),
    })
  }
  const servicio = servicioRef.current
  const [, setRepintar] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' })
  const [ahora, setAhora] = useState(Date.now())

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const estado = await servicio.cargar()
        if (estado.activado && estado.identidad) {
          await servicio.iniciarCercania()
          await servicio.sincronizar()
        }
      } catch {
        // El chat degrada solo; la pantalla muestra lo que haya en local.
      }
      if (vivo) setCargando(false)
    })()
    const t = setInterval(() => {
      setAhora(Date.now())
      if (servicio.datos().activado) void servicio.sincronizar()
    }, 30_000)
    return () => {
      vivo = false
      clearInterval(t)
    }
    // Solo al montar la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const estado = servicio.datos()

  if (cargando) {
    return (
      <div className="lista">
        <h2>💬 CHAT</h2>
        <p>Abriendo…</p>
      </div>
    )
  }

  if (!estado.identidad) {
    return <Activacion servicio={servicio} />
  }

  if (!estado.activado) {
    return (
      <div className="lista">
        <h2>💬 CHAT</h2>
        <div className="tarjeta">
          <h3>CHAT está apagado</h3>
          <p>
            Tu identidad se conserva en este teléfono. Al reactivar, la cercanía y el buzón
            vuelven a funcionar como estaban.
          </p>
        </div>
        <button className="btn-primario" onClick={() => void servicio.reactivar()}>
          Reactivar CHAT
        </button>
      </div>
    )
  }

  if (vista.tipo === 'conversacion') {
    return (
      <Conversacion
        servicio={servicio}
        clave={vista.clave}
        alVolver={() => setVista({ tipo: 'lista' })}
      />
    )
  }
  if (vista.tipo === 'canal') {
    return (
      <Canal
        servicio={servicio}
        alVolver={() => setVista({ tipo: 'lista' })}
        alAbrirAcademia={alAbrirAcademia}
      />
    )
  }
  if (vista.tipo === 'agregar') {
    return <AgregarContacto servicio={servicio} alVolver={() => setVista({ tipo: 'lista' })} />
  }
  if (vista.tipo === 'ajustes') {
    return <Ajustes servicio={servicio} alVolver={() => setVista({ tipo: 'lista' })} />
  }
  if (vista.tipo === 'crear-grupo') {
    return <CrearGrupo servicio={servicio} alVolver={() => setVista({ tipo: 'lista' })} />
  }
  if (vista.tipo === 'grupo') {
    return (
      <HiloGrupo
        servicio={servicio}
        grupoId={vista.id}
        alVolver={() => setVista({ tipo: 'lista' })}
        alAbrirConversacion={(clave) => setVista({ tipo: 'conversacion', clave })}
      />
    )
  }

  const noLeidosCanal = servicio.noLeidosDe(CONVERSACION_CANAL)
  const vias = servicio.estadoVias()

  return (
    <div className="lista">
      <h2>💬 CHAT</h2>
      <p className="chat-yo">
        👤 Tú eres: <strong>{estado.identidad?.nombre}</strong>
      </p>
      <p className="chat-estado-via">{servicio.textoEstadoVias()}</p>

      <button className="tarjeta chat-fijada" onClick={() => setVista({ tipo: 'canal' })}>
        <div className="num">📣 Canal del maestro</div>
        <h3>
          TEMAS APOSTÓLICOS
          {noLeidosCanal > 0 && <span className="chat-contador">{noLeidosCanal}</span>}
        </h3>
        <p>Avisos y enseñanzas de LemGil. Solo él publica; las enseñanzas firmadas se archivan solas en tus Academias.</p>
      </button>

      <h3 className="chat-seccion">Conversaciones</h3>
      {estado.contactos.length === 0 && (
        <p className="chat-nota">
          Todavía no tienes contactos. Agrega al maestro y a tus hermanos con su código o su QR,
          en persona: así sabes que son ellos de verdad.
        </p>
      )}
      {estado.contactos.map((c) => {
        const mensajes = servicio.mensajesDe(c.clavePublica)
        const ultimo = mensajes[mensajes.length - 1]
        const noLeidos = servicio.noLeidosDe(c.clavePublica)
        return (
          <button
            key={c.clavePublica}
            className="tarjeta"
            onClick={() => setVista({ tipo: 'conversacion', clave: c.clavePublica })}
          >
            <h3>
              {c.esMaestro ? '📣 ' : '👤 '}
              {c.nombre}
              {noLeidos > 0 && <span className="chat-contador">{noLeidos}</span>}
            </h3>
            <p>
              {ultimo
                ? `${ultimo.mio ? 'Tú: ' : ''}${ultimo.cuerpo.slice(0, 80)}`
                : 'Sin mensajes todavía'}
            </p>
          </button>
        )
      })}
      <button className="btn-secundario" onClick={() => setVista({ tipo: 'agregar' })}>
        ➕ Agregar contacto
      </button>

      {(estado.grupos.length > 0 || estado.soyMaestro) && (
        <>
          <h3 className="chat-seccion">Grupos por academia</h3>
          {estado.grupos.length === 0 && (
            <p className="chat-nota">
              Aún no creas ningún grupo. Un grupo reúne a los estudiantes de una academia:
              tú escribes y ellos reciben, por internet o por cercanía.
            </p>
          )}
          {estado.grupos.map((g) => {
            const conv = conversacionDeGrupo(g.id)
            const mensajes = servicio.mensajesDe(conv)
            const ultimo = mensajes[mensajes.length - 1]
            const noLeidos = servicio.noLeidosDe(conv)
            return (
              <button
                key={g.id}
                className="tarjeta"
                onClick={() => setVista({ tipo: 'grupo', id: g.id })}
              >
                <h3>
                  📌 {g.nombre}
                  {noLeidos > 0 && <span className="chat-contador">{noLeidos}</span>}
                </h3>
                <p>
                  {ultimo
                    ? `${ultimo.mio ? 'Tú: ' : ''}${ultimo.cuerpo.slice(0, 80)}`
                    : 'Sin mensajes todavía'}
                </p>
              </button>
            )
          })}
          {estado.soyMaestro && (
            <button className="btn-secundario" onClick={() => setVista({ tipo: 'crear-grupo' })}>
              ➕ Crear grupo
            </button>
          )}
        </>
      )}

      <h3 className="chat-seccion">Cercanos ahora</h3>
      {vias.cercania === 'no-disponible' && (
        <p className="chat-nota">
          La cercanía Wi-Fi necesita el módulo nativo de esta versión; en este dispositivo no está
          disponible. El buzón por internet sigue funcionando.
        </p>
      )}
      {vias.cercania !== 'no-disponible' && servicio.presencia.todos().length === 0 && (
        <p className="chat-nota">
          Nadie cerca por ahora. La cercanía busca sola; si tarda, en Ajustes tienes el botón
          «Reiniciar cercanía».
        </p>
      )}
      {servicio.presencia.todos().map((par) => {
        const presente = ahora - par.vistoEn <= 90_000
        const esContacto = par.clavePublica
          ? estado.contactos.some((c) => c.clavePublica === par.clavePublica)
          : false
        return (
          <div key={par.endpointId} className="tarjeta chat-par">
            <h3>
              {presente ? '🟢' : '⚪'} {par.nombre}
            </h3>
            <p>visto {haceCuanto(par.vistoEn, ahora)}</p>
            {par.clavePublica && esContacto && presente && (
              <button
                className="btn-secundario"
                onClick={() => setVista({ tipo: 'conversacion', clave: par.clavePublica! })}
              >
                Escribirle
              </button>
            )}
          </div>
        )
      })}

      <button className="btn-secundario" onClick={() => setVista({ tipo: 'ajustes' })}>
        ⚙️ Ajustes de CHAT
      </button>
      <p className="nota-version">MensajeAcademia · v{version} — internet y cercanía Wi-Fi</p>
    </div>
  )
}

// ---------------------------------------------------------------------------

const Activacion: React.FC<{ servicio: ServicioChat }> = ({ servicio }) => {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const activar = async () => {
    if (!nombre.trim()) {
      setError('Escribe tu nombre: es el que verán tus hermanos.')
      return
    }
    try {
      await servicio.activar(nombre)
    } catch {
      setError('No se pudo crear tu identidad en este teléfono.')
    }
  }
  return (
    <div className="lista">
      <h2>💬 CHAT</h2>
      <div className="tarjeta">
        <h3>Bienvenido a LemChat</h3>
        <p>
          Mensajes y enseñanzas de la Academia por la vía que haya: cercanía Wi-Fi cuando estén
          juntos e internet cuando aparezca. Sin cuentas y sin contraseña: tu identidad se crea
          aquí, en tu teléfono, y los contactos se agregan en persona con su código o su QR.
        </p>
        <p>
          Al activar, las vías quedan <strong>activadas y verificadas desde el inicio</strong>:
          la pantalla siempre dice por qué vía vas y en qué estado va cada mensaje
          (⏳ en cola · 📤 enviado · ✓ entregado). Sin vía, el mensaje espera en tu teléfono;
          no se pierde.
        </p>
      </div>
      <label className="chat-etiqueta">Tu nombre para mostrar</label>
      <input
        className="chat-entrada"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Ej.: Hermano Juan"
        maxLength={60}
      />
      {error && <p className="chat-error">{error}</p>}
      <button className="btn-primario" onClick={() => void activar()}>
        Activar CHAT
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------

const Conversacion: React.FC<{
  servicio: ServicioChat
  clave: string
  alVolver: () => void
}> = ({ servicio, clave, alVolver }) => {
  const [texto, setTexto] = useState('')
  const [, setRepintar] = useState(0)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const contacto = servicio.datos().contactos.find((c) => c.clavePublica === clave)

  const borrar = async () => {
    await servicio.borrarContacto(clave)
    alVolver()
  }
  const mensajes = servicio.mensajesDe(clave)
  const finRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void servicio.marcarLeida(clave)
  }, [servicio, clave, mensajes.length])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes.length])

  const enviar = async () => {
    if (!texto.trim()) return
    const copia = texto
    setTexto('')
    try {
      await servicio.enviarTexto(clave, copia)
    } catch {
      // El mensaje no se creó; se restaura el texto para no perderlo.
      setTexto(copia)
    }
    setRepintar((n) => n + 1)
  }

  return (
    <div className="chat-conversacion">
      <div className="lector-barra chat-barra">
        <button className="btn-atras" onClick={alVolver} aria-label="Volver">
          ‹
        </button>
        <div className="lector-titulo">
          <strong>{contacto?.nombre ?? 'Contacto'}</strong>
          <span>{servicio.textoEstadoVias()}</span>
        </div>
      </div>
      <div className="chat-hilo">
        {mensajes.length === 0 && (
          <p className="chat-nota">Sin mensajes todavía. Lo que escribas viaja cifrado, solo para ustedes dos.</p>
        )}
        {mensajes.map((m) => (
          <div key={m.id} className={`chat-burbuja ${m.mio ? 'mia' : 'suya'}`}>
            <p>{m.cuerpo}</p>
            <span className="chat-meta">
              {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {m.mio && ` · ${ICONO_ESTADO[m.estado]}`}
            </span>
          </div>
        ))}
        <div ref={finRef} />
      </div>
      <div className="chat-escribir">
        <input
          className="chat-entrada"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void enviar()
          }}
          placeholder="Escribe un mensaje…"
          maxLength={2000}
        />
        <button className="btn-primario chat-enviar" onClick={() => void enviar()}>
          Enviar
        </button>
      </div>
      <div className="chat-borrar-zona">
        {!confirmarBorrar ? (
          <button className="btn-secundario" onClick={() => setConfirmarBorrar(true)}>
            🗑 Borrar este contacto
          </button>
        ) : (
          <>
            <p className="chat-error">
              Se borra el contacto «{contacto?.nombre}» y toda esta conversación de este
              teléfono. Podrás agregarlo de nuevo con su código o su QR.
            </p>
            <button className="btn-secundario" onClick={() => void borrar()}>
              Sí, borrar
            </button>{' '}
            <button className="btn-secundario" onClick={() => setConfirmarBorrar(false)}>
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

const Canal: React.FC<{
  servicio: ServicioChat
  alVolver: () => void
  alAbrirAcademia: (id: string) => void
}> = ({ servicio, alVolver, alAbrirAcademia }) => {
  const mensajes = servicio.mensajesDe(CONVERSACION_CANAL)
  const soyMaestro = servicio.datos().soyMaestro
  const [avisoTexto, setAvisoTexto] = useState('')
  const [paqueteId, setPaqueteId] = useState('')
  const [paqueteTexto, setPaqueteTexto] = useState('')
  const [resultado, setResultado] = useState('')
  const [esError, setEsError] = useState(false)
  useEffect(() => {
    void servicio.marcarLeida(CONVERSACION_CANAL)
  }, [servicio, mensajes.length])

  const publicarAviso = async () => {
    try {
      await servicio.publicarAvisoCanal(avisoTexto)
      setAvisoTexto('')
      setResultado('✅ Aviso publicado en el canal.')
      setEsError(false)
    } catch (e) {
      setResultado(e instanceof Error ? e.message : 'No se pudo publicar el aviso.')
      setEsError(true)
    }
  }

  const publicarEnsenanza = async () => {
    try {
      await servicio.publicarEnsenanzaCanal(paqueteId, paqueteTexto)
      setPaqueteId('')
      setPaqueteTexto('')
      setResultado('✅ Enseñanza publicada en el canal: llegará firmada y se archivará sola.')
      setEsError(false)
    } catch (e) {
      setResultado(e instanceof Error ? e.message : 'No se pudo publicar la enseñanza.')
      setEsError(true)
    }
  }

  return (
    <div className="lista">
      <div className="lector-barra chat-barra">
        <button className="btn-atras" onClick={alVolver} aria-label="Volver">
          ‹
        </button>
        <div className="lector-titulo">
          <strong>📣 TEMAS APOSTÓLICOS</strong>
          <span>Solo publica el maestro</span>
        </div>
      </div>
      {mensajes.length === 0 && (
        <p className="chat-nota">
          Aún no llegan avisos ni enseñanzas. Cuando el maestro publique y haya vía (cercanía o
          internet), aparecerán aquí — y las enseñanzas firmadas se archivarán solas en tus
          Academias.
        </p>
      )}
      {mensajes.map((m) => (
        <div key={m.id} className="tarjeta">
          <div className="num">{m.tipo === 'paquete' ? '📦 Enseñanza' : '📣 Aviso'}</div>
          <p className={m.paqueteSinVerificar ? 'chat-aviso-error' : undefined}>{m.cuerpo}</p>
          {m.tipo === 'paquete' && m.paqueteId && !m.paqueteSinVerificar && (
            <button className="btn-secundario" onClick={() => alAbrirAcademia(m.paqueteId!)}>
              Abrir en Academias ›
            </button>
          )}
          <p className="chat-meta">{new Date(m.ts).toLocaleString()}</p>
        </div>
      ))}
      {soyMaestro && (
        <>
          <div className="tarjeta">
            <h3>📣 Publicar un aviso</h3>
            <p>Sale firmado con tu llave, por internet y por cercanía.</p>
            <textarea
              className="chat-entrada"
              value={avisoTexto}
              onChange={(e) => setAvisoTexto(e.target.value)}
              rows={3}
              placeholder="Ej.: Mañana estudiamos el Código 3; traigan sus preguntas."
              maxLength={2000}
            />
            <button className="btn-primario" onClick={() => void publicarAviso()}>
              Publicar aviso
            </button>
          </div>
          <div className="tarjeta">
            <h3>📦 Publicar una enseñanza</h3>
            <p>
              Pega el paquete (el .json de la academia) y su id. Viaja dentro del sobre
              firmado: en cada teléfono se verifica tu firma y se archiva solo.
            </p>
            <label className="chat-etiqueta">Id del paquete</label>
            <input
              className="chat-entrada"
              value={paqueteId}
              onChange={(e) => setPaqueteId(e.target.value)}
              placeholder="Ej.: lemgil-14"
              maxLength={60}
            />
            <label className="chat-etiqueta">Texto del paquete</label>
            <textarea
              className="chat-entrada chat-codigo"
              value={paqueteTexto}
              onChange={(e) => setPaqueteTexto(e.target.value)}
              rows={5}
              placeholder='{"tipo":"paquete-academia",…}'
            />
            {resultado && <p className={esError ? 'chat-error' : 'chat-ok'}>{resultado}</p>}
            <button className="btn-primario" onClick={() => void publicarEnsenanza()}>
              Publicar enseñanza
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

const CrearGrupo: React.FC<{ servicio: ServicioChat; alVolver: () => void }> = ({
  servicio,
  alVolver,
}) => {
  const [nombre, setNombre] = useState('')
  const [academiaId, setAcademiaId] = useState('')
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [mensaje, setMensaje] = useState('')
  const [esError, setEsError] = useState(false)
  const contactos = servicio.datos().contactos

  const alternar = (clave: string) =>
    setSeleccion((s) => (s.includes(clave) ? s.filter((c) => c !== clave) : [...s, clave]))

  const crear = async () => {
    try {
      await servicio.crearGrupo(nombre, academiaId || undefined, seleccion)
      alVolver()
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo crear el grupo.')
      setEsError(true)
    }
  }

  return (
    <div className="lista">
      <div className="lector-barra chat-barra">
        <button className="btn-atras" onClick={alVolver} aria-label="Volver">
          ‹
        </button>
        <div className="lector-titulo">
          <strong>Crear grupo</strong>
          <span>Solo el maestro crea grupos</span>
        </div>
      </div>
      <div className="tarjeta">
        <h3>El grupo</h3>
        <label className="chat-etiqueta">Nombre del grupo</label>
        <input
          className="chat-entrada"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej.: Estudiantes de la Academia 14"
          maxLength={80}
        />
        <label className="chat-etiqueta">Academia vinculada (opcional)</label>
        <input
          className="chat-entrada"
          value={academiaId}
          onChange={(e) => setAcademiaId(e.target.value)}
          placeholder="Ej.: lemgil-14"
          maxLength={60}
        />
      </div>
      <div className="tarjeta">
        <h3>Miembros</h3>
        <p>
          Cada miembro recibe su invitación sellada con la clave del grupo: sin invitación no
          hay lectura, aunque alguien recoja las filas del buzón.
        </p>
        {contactos.length === 0 && (
          <p className="chat-nota">Todavía no tienes contactos: agrega primero a los miembros.</p>
        )}
        {contactos.map((c) => (
          <label key={c.clavePublica} className="chat-par">
            <input
              type="checkbox"
              checked={seleccion.includes(c.clavePublica)}
              onChange={() => alternar(c.clavePublica)}
            />{' '}
            {c.esMaestro ? '📣 ' : '👤 '}
            {c.nombre}
          </label>
        ))}
        {mensaje && <p className={esError ? 'chat-error' : 'chat-ok'}>{mensaje}</p>}
        <button className="btn-primario" onClick={() => void crear()}>
          Crear grupo y enviar invitaciones
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

const HiloGrupo: React.FC<{
  servicio: ServicioChat
  grupoId: string
  alVolver: () => void
  alAbrirConversacion: (clave: string) => void
}> = ({ servicio, grupoId, alVolver, alAbrirConversacion }) => {
  const [texto, setTexto] = useState('')
  const [, setRepintar] = useState(0)
  const [aviso, setAviso] = useState('')
  const estado = servicio.datos()
  const grupo = estado.grupos.find((g) => g.id === grupoId)
  const conv = conversacionDeGrupo(grupoId)
  const mensajes = servicio.mensajesDe(conv)
  const finRef = useRef<HTMLDivElement>(null)
  const maestroContacto = estado.contactos.find((c) => c.esMaestro)

  useEffect(() => {
    void servicio.marcarLeida(conv)
  }, [servicio, conv, mensajes.length])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes.length])

  if (!grupo) {
    return (
      <div className="lista">
        <div className="lector-barra chat-barra">
          <button className="btn-atras" onClick={alVolver} aria-label="Volver">
            ‹
          </button>
          <div className="lector-titulo">
            <strong>📌 Grupo</strong>
          </div>
        </div>
        <p className="chat-nota">Este grupo ya no está en este teléfono.</p>
      </div>
    )
  }

  const enviar = async () => {
    if (!texto.trim()) return
    const copia = texto
    setTexto('')
    try {
      await servicio.publicarEnGrupo(grupoId, copia)
    } catch {
      setTexto(copia)
    }
    setRepintar((n) => n + 1)
  }

  const invitar = async (clave: string, nombreMiembro: string) => {
    try {
      await servicio.invitarMiembroGrupo(grupoId, clave)
      setAviso(`✅ Invitación enviada a ${nombreMiembro}.`)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo invitar.')
    }
    setRepintar((n) => n + 1)
  }

  const fueraDelGrupo = estado.contactos.filter((c) => !grupo.miembros.includes(c.clavePublica))

  return (
    <div className="chat-conversacion">
      <div className="lector-barra chat-barra">
        <button className="btn-atras" onClick={alVolver} aria-label="Volver">
          ‹
        </button>
        <div className="lector-titulo">
          <strong>📌 {grupo.nombre}</strong>
          <span>
            {grupo.academiaId ? `Academia: ${grupo.academiaId} · ` : ''}
            {grupo.miembros.length} miembros · escribe el maestro
          </span>
        </div>
      </div>
      <div className="chat-hilo">
        {mensajes.map((m) => (
          <div key={m.id} className={`chat-burbuja ${m.mio ? 'mia' : 'suya'}`}>
            <p>{m.cuerpo}</p>
            <span className="chat-meta">
              {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {m.mio && ` · ${ICONO_ESTADO[m.estado]}`}
            </span>
          </div>
        ))}
        <div ref={finRef} />
      </div>
      {estado.soyMaestro ? (
        <>
          <div className="chat-escribir">
            <input
              className="chat-entrada"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void enviar()
              }}
              placeholder="Escribe al grupo…"
              maxLength={2000}
            />
            <button className="btn-primario chat-enviar" onClick={() => void enviar()}>
              Enviar
            </button>
          </div>
          <div className="tarjeta">
            <h3>Agregar miembros</h3>
            {fueraDelGrupo.length === 0 ? (
              <p className="chat-nota">Todos tus contactos ya están en el grupo.</p>
            ) : (
              fueraDelGrupo.map((c) => (
                <p key={c.clavePublica}>
                  {c.esMaestro ? '📣 ' : '👤 '}
                  {c.nombre}{' '}
                  <button
                    className="btn-secundario"
                    onClick={() => void invitar(c.clavePublica, c.nombre)}
                  >
                    Invitar
                  </button>
                </p>
              ))
            )}
            {aviso && <p className="chat-ok">{aviso}</p>}
          </div>
        </>
      ) : (
        <div className="tarjeta">
          <p className="chat-nota">
            En el grupo solo escribe el maestro. Si quieres responderle, hazlo en tu
            conversación personal con él.
          </p>
          {maestroContacto && (
            <button
              className="btn-secundario"
              onClick={() => alAbrirConversacion(maestroContacto.clavePublica)}
            >
              Escribir al maestro
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

const AgregarContacto: React.FC<{ servicio: ServicioChat; alVolver: () => void }> = ({
  servicio,
  alVolver,
}) => {
  const [codigo, setCodigo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [esError, setEsError] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const yo = servicio.datos().identidad
  const soyMaestro = servicio.datos().soyMaestro
  const miCodigo = useMemo(
    () => (yo ? codigoDeContacto(yo, soyMaestro) : ''),
    [yo, soyMaestro],
  )

  const agregar = async (texto?: string) => {
    try {
      const contacto = await servicio.agregarContactoPorCodigo((texto ?? codigo).trim())
      setMensaje(`✅ ${contacto.nombre} agregado${contacto.esMaestro ? ' como maestro' : ''}.`)
      setEsError(false)
      setCodigo('')
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo agregar.')
      setEsError(true)
    }
  }

  const escanear = async () => {
    setEscaneando(true)
    try {
      const texto = await escanearCodigoConCamara()
      setCodigo(texto)
      await agregar(texto)
    } catch (e) {
      const detalle = e instanceof Error ? e.message : ''
      if (detalle !== '__cancelado__') {
        setMensaje(detalle || 'No se pudo escanear.')
        setEsError(true)
      }
    } finally {
      setEscaneando(false)
    }
  }

  return (
    <div className="lista">
      <div className="lector-barra chat-barra">
        <button className="btn-atras" onClick={alVolver} aria-label="Volver">
          ‹
        </button>
        <div className="lector-titulo">
          <strong>Agregar contacto</strong>
          <span>En persona, como debe ser</span>
        </div>
      </div>
      <div className="tarjeta">
        <h3>Tu código</h3>
        <p>
          Este teléfono es: <strong>{yo?.nombre}</strong>
        </p>
        <p>Muéstralo a quien te vaya a agregar: el QR o el código de texto valen igual.</p>
        <CodigoQR texto={miCodigo} />
        <textarea className="chat-entrada chat-codigo" readOnly value={miCodigo} rows={3} />
      </div>
      <div className="tarjeta">
        <h3>Agregar con el código del otro</h3>
        <p>Escanea su QR con la cámara, o pega aquí el código que te mostró: valen igual.</p>
        <button
          className="btn-primario"
          onClick={() => void escanear()}
          disabled={escaneando}
        >
          {escaneando ? 'Abriendo la cámara…' : '📷 Escanear el QR con la cámara'}
        </button>
        <textarea
          className="chat-entrada chat-codigo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          rows={3}
          placeholder="lemchat1:…"
        />
        {mensaje && <p className={esError ? 'chat-error' : 'chat-ok'}>{mensaje}</p>}
        <button className="btn-primario" onClick={() => void agregar()}>
          Agregar
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

const Ajustes: React.FC<{ servicio: ServicioChat; alVolver: () => void }> = ({
  servicio,
  alVolver,
}) => {
  const vias = servicio.estadoVias()
  const yo = servicio.datos().identidad
  const [aviso, setAviso] = useState('')
  const [nombreNuevo, setNombreNuevo] = useState(yo?.nombre ?? '')
  const [avisoNombre, setAvisoNombre] = useState('')
  const [errorNombre, setErrorNombre] = useState(false)

  const guardarNombre = async () => {
    try {
      await servicio.cambiarMiNombre(nombreNuevo)
      setAvisoNombre('✅ Nombre actualizado en este teléfono.')
      setErrorNombre(false)
    } catch (e) {
      setAvisoNombre(e instanceof Error ? e.message : 'No se pudo cambiar el nombre.')
      setErrorNombre(true)
    }
  }

  const soyMaestro = servicio.datos().soyMaestro
  const [jsonMaestro, setJsonMaestro] = useState('')
  const [avisoMaestro, setAvisoMaestro] = useState('')
  const [errorMaestro, setErrorMaestro] = useState(false)

  const importarMaestro = async () => {
    try {
      await servicio.importarLlaveMaestro(jsonMaestro)
      setJsonMaestro('')
      setAvisoMaestro('✅ Llave importada: este teléfono ahora ES el maestro.')
      setErrorMaestro(false)
    } catch (e) {
      setAvisoMaestro(e instanceof Error ? e.message : 'No se pudo importar la llave.')
      setErrorMaestro(true)
    }
  }

  return (
    <div className="lista">
      <div className="lector-barra chat-barra">
        <button className="btn-atras" onClick={alVolver} aria-label="Volver">
          ‹
        </button>
        <div className="lector-titulo">
          <strong>⚙️ Ajustes de CHAT</strong>
          <span>{yo?.nombre}</span>
        </div>
      </div>

      <div className="tarjeta">
        <h3>Mi identidad en este teléfono</h3>
        <p>
          Este teléfono se presenta como: <strong>{yo?.nombre}</strong>
        </p>
        <p>Si el nombre quedó mal puesto (pasa al probar con varios teléfonos), corrígelo aquí:</p>
        <input
          className="chat-entrada"
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder="Tu nombre"
          maxLength={60}
        />
        {avisoNombre && <p className={errorNombre ? 'chat-error' : 'chat-ok'}>{avisoNombre}</p>}
        <button className="btn-secundario" onClick={() => void guardarNombre()}>
          Guardar el nombre
        </button>
        <p className="chat-nota">
          Al cambiarlo, vuelve a mostrar tu código a tus contactos: cuando te agreguen otra vez,
          tu nombre se actualiza en su lista. Tu clave no cambia: sigues siendo tú.
        </p>
      </div>

      <div className="tarjeta">
        <h3>🔑 Llave del maestro</h3>
        {soyMaestro ? (
          <p>
            Este teléfono tiene la llave del maestro: puede publicar en el canal TEMAS
            APOSTÓLICOS y crear grupos. Tu código de contacto ya sale marcado como maestro.
          </p>
        ) : (
          <>
            <p>
              Solo para el teléfono del maestro: pega el contenido del archivo de claves
              (el JSON que genera la herramienta de claves en la PC). Al importarla, la
              identidad de este teléfono pasa a ser la del maestro: podrás publicar en el
              canal y crear grupos. La llave se valida aquí — si la privada no corresponde
              a la pública, no se importa nada.
            </p>
            <textarea
              className="chat-entrada chat-codigo"
              value={jsonMaestro}
              onChange={(e) => setJsonMaestro(e.target.value)}
              rows={5}
              placeholder='{"nombre":"…","clavePublica":"…","clavePrivada":"…"}'
            />
            {avisoMaestro && (
              <p className={errorMaestro ? 'chat-error' : 'chat-ok'}>{avisoMaestro}</p>
            )}
            <button className="btn-primario" onClick={() => void importarMaestro()}>
              Importar la llave del maestro
            </button>
          </>
        )}
      </div>

      <div className="tarjeta">
        <h3>Estado de las vías</h3>
        <p>
          Internet:{' '}
          {vias.internet === 'ok'
            ? 'configurado'
            : vias.internet === 'error'
              ? 'sin respuesta ahora (se reintenta solo)'
              : 'sin configurar en esta versión'}
          <br />
          Cercanía Wi-Fi:{' '}
          {vias.cercania === 'activa'
            ? `activa (${vias.paresCercanos} cerca)`
            : vias.cercania === 'buscando'
              ? 'buscando…'
              : vias.cercania === 'apagada'
                ? 'apagada'
                : 'no disponible en este dispositivo'}
        </p>
        {aviso && <p className="chat-ok">{aviso}</p>}
        <button
          className="btn-secundario"
          onClick={() => {
            void servicio.reiniciarCercania().then(() =>
              setAviso('Cercanía reiniciada: vuelve a buscar desde cero.'),
            )
          }}
        >
          🔄 Reiniciar cercanía
        </button>
        <p className="chat-nota">
          Si la cercanía se atasca (nadie aparece y sabes que hay alguien al lado), este botón es
          la salida: apaga y enciende la escucha sin tocar nada más.
        </p>
      </div>

      <div className="tarjeta">
        <h3>Interruptor general</h3>
        <p>
          Apagar CHAT detiene la cercanía y el buzón: la app vuelve a ser solo el lector, sin gasto
          de batería. Tu identidad y tus mensajes se conservan en el teléfono.
        </p>
        <button
          className="btn-secundario"
          onClick={() => {
            void servicio.desactivar().then(alVolver)
          }}
        >
          Apagar CHAT
        </button>
      </div>
    </div>
  )
}
