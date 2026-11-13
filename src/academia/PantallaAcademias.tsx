import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Academia, ACADEMIAS_INCLUIDAS } from './contenido'
import {
  temasLeidos,
  alternarTemaLeido,
  temasPracticados,
  alternarTemaPracticado,
  conclusiones,
  registrarConclusion,
  nivelesDesbloqueadosGuardados,
  sincronizarDesbloqueos,
} from './progreso'
import {
  agruparPorNiveles,
  estadoAcademia,
  progresoAcademia,
  resumenNivel,
  TEXTO_ESTADO_ACADEMIA,
  type DatosProgreso,
} from './niveles'
import { borrarPaqueteImportado, importarPaquete } from './paquetes'
import { Lector } from '../lectura/Lector'
import { Markdown } from '../lectura/Markdown'

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'academia'; id: string }
  | { tipo: 'lector'; codigoId: string }

interface Props {
  academias: Academia[]
  importadas: Set<string>
  alRefrescarCatalogo: () => Promise<void>
  /** Academia a abrir directamente (viene de tocarla en Progreso). */
  destino?: { id: string; n: number } | null
  /** Verifica el sello del encuentro presencial (lo pasa App; carga
   *  LemChat de forma perezosa solo al sellar). */
  verificarSello: (texto: string) => Promise<{ academiaId: string; encuentro: string } | null>
}

const IDS_INCLUIDAS = new Set(ACADEMIAS_INCLUIDAS.map((a) => a.id))

export const PantallaAcademias: React.FC<Props> = ({ academias, importadas, alRefrescarCatalogo, destino, verificarSello }) => {
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' })
  const [leidos, setLeidos] = useState<Set<string>>(() => temasLeidos())
  const [practicados, setPracticados] = useState<Set<string>>(() => temasPracticados())
  const [concluidas, setConcluidas] = useState(() => conclusiones())
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [sellando, setSellando] = useState(false)
  const [codigoSello, setCodigoSello] = useState('')
  const [errorSello, setErrorSello] = useState('')
  const [escaneandoSello, setEscaneandoSello] = useState(false)
  const entradaArchivo = useRef<HTMLInputElement>(null)

  /** Datos de formación (v1.7) tal como los ve esta pantalla. */
  const datosProgreso: DatosProgreso = useMemo(
    () => ({
      leidos,
      practicados,
      concluidas,
      desbloqueados: nivelesDesbloqueadosGuardados(),
    }),
    [leidos, practicados, concluidas],
  )
  const catalogo = useMemo(
    () => agruparPorNiveles(academias, datosProgreso),
    [academias, datosProgreso],
  )

  /** Sella la conclusión de una academia con el código del encuentro. */
  const concluirConSello = async (academia: Academia, texto: string) => {
    setErrorSello('')
    const limpio = texto.trim()
    if (!limpio) {
      setErrorSello('Escanea el QR del Maestro o pega su código.')
      return
    }
    let resultado: { academiaId: string; encuentro: string } | null = null
    try {
      resultado = await verificarSello(limpio)
    } catch {
      resultado = null
    }
    if (!resultado) {
      setErrorSello('Ese código no es un sello válido de tu Maestro. Pídele que lo genere de nuevo en el encuentro.')
      return
    }
    if (resultado.academiaId !== academia.id) {
      setErrorSello('Ese sello es de otra academia. El Maestro debe generar el de esta.')
      return
    }
    const nuevas = registrarConclusion(academia.id, {
      fecha: new Date().toISOString().slice(0, 10),
      encuentro: resultado.encuentro,
    })
    setConcluidas(nuevas)
    sincronizarDesbloqueos(academias)
    setSellando(false)
    setCodigoSello('')
    setAviso({ ok: true, texto: `🎓 Academia concluida en el encuentro con el Maestro. ¡Bien hecho!` })
  }

  const escanearSello = async (academia: Academia) => {
    setEscaneandoSello(true)
    setErrorSello('')
    try {
      const { escanearCodigoConCamara } = await import('../lemchat/escaneo')
      const texto = await escanearCodigoConCamara()
      if (texto) await concluirConSello(academia, texto)
      else setErrorSello('No se leyó ningún código en la foto. Inténtalo de nuevo o pega el código de texto.')
    } catch {
      setErrorSello('No se pudo abrir la cámara. Pega el código de texto del Maestro.')
    } finally {
      setEscaneandoSello(false)
    }
  }

  const contenido = useMemo(() => {
    if (vista.tipo === 'academia') {
      return academias.find((a) => a.id === vista.id) || null
    }
    if (vista.tipo === 'lector') {
      for (const a of academias) {
        const c = a.codigos.find((x) => x.id === vista.codigoId)
        if (c) return { academia: a, codigo: c }
      }
      return null
    }
    return null
  }, [vista, academias])

  // Apertura directa de una academia (al tocarla en la pantalla Progreso).
  useEffect(() => {
    if (destino) setVista({ tipo: 'academia', id: destino.id })
  }, [destino])

  const alElegirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    e.target.value = '' // Permite volver a elegir el mismo archivo.
    if (!archivo) return
    try {
      const texto = await archivo.text()
      const r = await importarPaquete(texto, academias)
      const detalle = `${r.academia.numero} · ${r.academia.titulo} (${r.academia.codigos.length} códigos)`
      setAviso({
        ok: true,
        texto: r.esNueva
          ? `📥 Academia importada: ${detalle}.`
          : `📥 Academia actualizada: ${detalle}. Tu progreso se conserva.`,
      })
      await alRefrescarCatalogo()
    } catch (err) {
      setAviso({ ok: false, texto: `⚠️ No se pudo importar: ${err instanceof Error ? err.message : 'archivo no válido'}.` })
    }
  }

  const alBorrarImportada = async (a: Academia) => {
    const esActualizacion = IDS_INCLUIDAS.has(a.id)
    const mensaje = esActualizacion
      ? `¿Quitar la actualización de «${a.titulo}»? Volverá la versión incluida en la app.`
      : `¿Eliminar la academia «${a.titulo}»?`
    if (!window.confirm(mensaje)) return
    try {
      await borrarPaqueteImportado(a.id)
      setAviso({ ok: true, texto: esActualizacion ? '↩️ Actualización retirada: volvió la versión incluida.' : '🗑 Academia eliminada.' })
      setVista({ tipo: 'lista' })
      await alRefrescarCatalogo()
    } catch {
      setAviso({ ok: false, texto: '⚠️ No se pudo eliminar el paquete.' })
    }
  }

  if (vista.tipo === 'lector' && contenido && 'codigo' in contenido) {
    const { academia, codigo } = contenido
    const idx = academia.codigos.findIndex((c) => c.id === codigo.id)
    const ant = idx > 0 ? academia.codigos[idx - 1] : null
    const sig = idx < academia.codigos.length - 1 ? academia.codigos[idx + 1] : null
    const esLeido = leidos.has(codigo.id)
    return (
      <Lector
        titulo={`🔓 ${codigo.titulo}`}
        subtitulo={`${academia.numero} · ${academia.titulo}`}
        onAtras={() => setVista({ tipo: 'academia', id: academia.id })}
        leido={esLeido}
        onAlternarLeido={() => setLeidos(alternarTemaLeido(codigo.id))}
        practicado={practicados.has(codigo.id)}
        onAlternarPracticado={() => setPracticados(alternarTemaPracticado(codigo.id))}
        onAnterior={ant ? () => setVista({ tipo: 'lector', codigoId: ant.id }) : undefined}
        onSiguiente={sig ? () => setVista({ tipo: 'lector', codigoId: sig.id }) : undefined}
        etiquetaAnterior={ant ? ant.titulo : undefined}
        etiquetaSiguiente={sig ? sig.titulo : undefined}
      >
        {codigo.subtitulo && <h2>{codigo.subtitulo}</h2>}
        <Markdown texto={codigo.cuerpo} />
        {idx === academia.codigos.length - 1 && academia.cierre && (
          <>
            <h2>Cierre</h2>
            <Markdown texto={academia.cierre} />
          </>
        )}
      </Lector>
    )
  }

  if (vista.tipo === 'academia' && contenido && 'codigos' in contenido) {
    const academia = contenido as Academia
    const grupo = catalogo.grupos.find((g) => g.academias.some((a) => a.id === academia.id))
    const estado = estadoAcademia(academia, datosProgreso, grupo?.desbloqueado ?? true)
    const prog = progresoAcademia(academia, datosProgreso)
    const conclusion = concluidas.get(academia.id)
    const esImportada = importadas.has(academia.id)
    const esActualizacion = esImportada && IDS_INCLUIDAS.has(academia.id)
    return (
      <div className="lista">
        <button className="btn-nav" onClick={() => setVista({ tipo: 'lista' })}>‹ Academias</button>
        <h2 style={{ marginTop: 12 }}>{academia.numero} · {academia.titulo}</h2>
        <p style={{ color: '#cfc4a8', fontSize: 14 }}>
          {prog.nLeidos} de {prog.total} códigos leídos · {prog.nPracticados} practicados
          {academia.autor ? ` · Por ${academia.autor}` : ''}
          {grupo && grupo.orden !== null ? ` · ${grupo.nombre}` : ''}
        </p>
        <p>
          <span className={`chip-estado estado-${estado}`}>{TEXTO_ESTADO_ACADEMIA[estado]}</span>
        </p>
        <div style={{ maxWidth: 420 }}>
          <div className="barra-progreso lectura">
            <i style={{ width: `${prog.total ? Math.round((prog.nLeidos / prog.total) * 100) : 0}%` }} />
          </div>
          <div className="barra-progreso practica">
            <i style={{ width: `${prog.total ? Math.round((prog.nPracticados / prog.total) * 100) : 0}%` }} />
          </div>
          <p style={{ fontSize: 11, color: '#8f8468', margin: '4px 0 10px' }}>
            <span style={{ color: '#7fb3d5' }}>— leído</span>
            {'   '}
            <span style={{ color: '#c9a227' }}>— practicado</span>
          </p>
        </div>
        {estado === 'concluida' && conclusion && (
          <p style={{ color: '#cfc4a8', fontSize: 14 }}>
            Sellada en el encuentro presencial del {conclusion.fecha}.
          </p>
        )}
        {estado === 'lista-encuentro' && !sellando && (
          <div className="tarjeta" style={{ cursor: 'default' }}>
            <h3>🤝 Lista para el encuentro</h3>
            <p>
              Ya leíste y practicaste toda la academia. Solo falta el encuentro presencial
              con el Maestro: ahí te mostrará su código y lo escaneas para concluirla.
            </p>
            <button className="btn-primario" onClick={() => { setSellando(true); setErrorSello('') }}>
              Concluir con el Maestro
            </button>
          </div>
        )}
        {estado === 'lista-encuentro' && sellando && (
          <div className="tarjeta" style={{ cursor: 'default' }}>
            <h3>🎓 Sello del encuentro</h3>
            <p>Escanea el QR que el Maestro generó para esta academia, o pega su código de texto.</p>
            <button
              className="btn-primario"
              onClick={() => void escanearSello(academia)}
              disabled={escaneandoSello}
            >
              {escaneandoSello ? 'Abriendo la cámara…' : '📷 Escanear el QR con la cámara'}
            </button>
            <textarea
              className="chat-entrada chat-codigo"
              value={codigoSello}
              onChange={(e) => setCodigoSello(e.target.value)}
              rows={4}
              placeholder="lemsello1:…"
            />
            {errorSello && <p className="chat-error">{errorSello}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn-primario" onClick={() => void concluirConSello(academia, codigoSello)}>
                Verificar y concluir
              </button>
              <button className="btn-secundario" onClick={() => setSellando(false)}>
                Ahora no
              </button>
            </div>
          </div>
        )}
        {academia.codigos.map((c) => {
          const leido = leidos.has(c.id)
          const practicado = practicados.has(c.id)
          return (
            <div key={c.id} className={`tarjeta fila-codigo ${leido ? 'leido' : ''}`}>
              <button className="fila-codigo-ir" onClick={() => setVista({ tipo: 'lector', codigoId: c.id })}>
                <span className="check">✓</span>
                <span className="txt">
                  <span className="num">Código</span>
                  <h3 style={{ margin: '4px 0' }}>{c.titulo}</h3>
                </span>
                <span className="flecha">›</span>
              </button>
              <div className="fila-codigo-marcas">
                <button
                  className={`chip-marca ${leido ? 'activo' : ''}`}
                  onClick={() => setLeidos(alternarTemaLeido(c.id))}
                >
                  {leido ? '✓ Leído' : 'Marcar leído'}
                </button>
                <button
                  className={`chip-marca ${practicado ? 'activo' : ''}`}
                  onClick={() => setPracticados(alternarTemaPracticado(c.id))}
                >
                  {practicado ? '✓ Practicado' : 'Marcar practicado'}
                </button>
              </div>
            </div>
          )
        })}
        {esImportada && (
          <button className="btn-secundario" style={{ marginTop: 16 }} onClick={() => alBorrarImportada(academia)}>
            {esActualizacion ? '🗑 Quitar actualización (vuelve la incluida)' : '🗑 Eliminar academia'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="lista">
      <h2>📚 Academias</h2>
      <button className="btn-secundario" onClick={() => entradaArchivo.current?.click()}>
        📥 Importar paquete de academia
      </button>
      <input
        ref={entradaArchivo}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={alElegirArchivo}
      />
      <p style={{ color: '#cfc4a8', fontSize: 13, marginTop: 8 }}>
        Recibe el archivo del paquete (.json) por WhatsApp, Bluetooth o USB e impórtalo aquí. No necesitas internet.
      </p>
      {aviso && (
        <p
          style={{
            background: aviso.ok ? '#173d2c' : '#4a2430',
            color: '#f0e8d2',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 14,
          }}
        >
          {aviso.texto}
        </p>
      )}
      {academias.length === 0 && (
        <div className="tarjeta" style={{ cursor: 'default', textAlign: 'center', padding: '28px 20px' }}>
          <div style={{ fontSize: 40 }}>📭</div>
          <h3>Todavía no tienes academias</h3>
          <p>
            Esta app se instala sin enseñanzas: tú decides qué estudiar.
            Cuando tu maestro te pase un paquete de academia (un archivo
            .json por WhatsApp, Bluetooth o USB), impórtalo con el botón
            de arriba y aparecerá aquí.
          </p>
        </div>
      )}
      {catalogo.grupos.map((grupo) => {
        const resumen = resumenNivel(grupo, datosProgreso)
        return (
          <div key={grupo.nombre}>
            <div className="nivel-cabecera">
              <h3>{grupo.orden === null ? '📦' : '🎚️'} {grupo.nombre}</h3>
              <span className={`chip-estado nivel-${resumen.estado}`}>
                {grupo.orden === null
                  ? 'Siempre abierto'
                  : resumen.estado === 'bloqueado'
                    ? '🔒 Bloqueado'
                    : resumen.estado === 'concluido'
                      ? '✅ Nivel concluido'
                      : resumen.estado === 'espera-encuentro'
                        ? '🤝 En espera de encuentros'
                        : `${resumen.nConcluidas}/${resumen.totalAcademias} concluidas`}
              </span>
            </div>
            {/* Termómetro del nivel (v1.7.2): un segmento por academia,
                pintado con el color de su estado. */}
            <div className="termometro">
              {grupo.academias.map((a) => (
                <i
                  key={a.id}
                  className={`seg-${estadoAcademia(a, datosProgreso, grupo.desbloqueado)}`}
                />
              ))}
            </div>
            {grupo.academias.map((a) => {
              const p = progresoAcademia(a, datosProgreso)
              const est = estadoAcademia(a, datosProgreso, grupo.desbloqueado)
              const pctL = p.total ? Math.round((p.nLeidos / p.total) * 100) : 0
              const pctP = p.total ? Math.round((p.nPracticados / p.total) * 100) : 0
              const conclusion = concluidas.get(a.id)
              if (est === 'bloqueada') {
                return (
                  <div key={a.id} className="tarjeta bloqueada">
                    <span className="num">{a.numero}</span>
                    <h3>{a.titulo}</h3>
                    <p>🔒 Se abre al concluir todas las academias del nivel anterior.</p>
                  </div>
                )
              }
              return (
                <button
                  key={a.id}
                  className={`tarjeta estado-${est}`}
                  onClick={() => setVista({ tipo: 'academia', id: a.id })}
                >
                  {est === 'concluida' && <span className="sello-medallon">🎓</span>}
                  <span className="num">{a.numero}</span>
                  <h3>{a.titulo}</h3>
                  <p>
                    {a.codigos.length} códigos · {p.nLeidos} leídos · {p.nPracticados} practicados
                    {a.autor ? ` · ${a.autor}` : ''}
                  </p>
                  <p style={{ marginTop: 6 }}>
                    <span className={`chip-estado estado-${est}`}>{TEXTO_ESTADO_ACADEMIA[est]}</span>
                    {est === 'concluida' && conclusion && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#9fd48a' }}>
                        Encuentro: {conclusion.fecha}
                      </span>
                    )}
                  </p>
                  <div className="barra-progreso lectura"><i style={{ width: `${pctL}%` }} /></div>
                  <div className="barra-progreso practica"><i style={{ width: `${pctP}%` }} /></div>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
