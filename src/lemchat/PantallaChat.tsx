// Pantalla CHAT (Fase B). Se carga SOLO cuando el estudiante abre la
// pestaña (carga perezosa + frontera de error en App): si algo de aquí
// falla, el lector ni se entera.
//
// Bloques, en el orden del diseño (§2): estado de la vía, canal del
// maestro fijado, conversaciones personales, cercanos con «visto hace»
// y ajustes con el interruptor general. Los grupos son Fase D: aquí no
// hay ni el botón.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Academia } from '../academia/contenido'
import { CodigoQR } from './CodigoQR'
import { codigoDeContacto } from './identidad'
import { obtenerServicio, type ServicioChat } from './servicio'
import { CONVERSACION_CANAL, type Mensaje } from './tipos'
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

  const noLeidosCanal = servicio.noLeidosDe(CONVERSACION_CANAL)
  const vias = servicio.estadoVias()

  return (
    <div className="lista">
      <h2>💬 CHAT</h2>
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
      <p className="nota-version">LemChat · Fase B — internet y cercanía Wi-Fi</p>
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
  const contacto = servicio.datos().contactos.find((c) => c.clavePublica === clave)
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
  useEffect(() => {
    void servicio.marcarLeida(CONVERSACION_CANAL)
  }, [servicio, mensajes.length])

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
  const yo = servicio.datos().identidad
  const miCodigo = useMemo(() => (yo ? codigoDeContacto(yo) : ''), [yo])

  const agregar = async () => {
    try {
      const contacto = await servicio.agregarContactoPorCodigo(codigo)
      setMensaje(`✅ ${contacto.nombre} agregado${contacto.esMaestro ? ' como maestro' : ''}.`)
      setEsError(false)
      setCodigo('')
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo agregar.')
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
          <strong>Agregar contacto</strong>
          <span>En persona, como debe ser</span>
        </div>
      </div>
      <div className="tarjeta">
        <h3>Tu código</h3>
        <p>Muéstralo a quien te vaya a agregar: el QR o el código de texto valen igual.</p>
        <CodigoQR texto={miCodigo} />
        <textarea className="chat-entrada chat-codigo" readOnly value={miCodigo} rows={3} />
      </div>
      <div className="tarjeta">
        <h3>Agregar con el código del otro</h3>
        <p>Pega aquí el código que te mostró (el escaneo con cámara llega en una próxima versión).</p>
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
