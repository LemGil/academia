import React, { useMemo, useState } from 'react'
import { Academia, totalCodigos } from './contenido'
import {
  temasLeidos,
  reiniciarProgresoTemas,
  cargarDatosProgreso,
  reiniciarProgresoFormacion,
} from './progreso'
import {
  agruparPorNiveles,
  estadoAcademia,
  progresoAcademia,
  resumenNivel,
  TEXTO_ESTADO_ACADEMIA,
  type DatosProgreso,
} from './niveles'
import { cargarLeidos, reiniciarLeidos } from '../biblia/progresoBiblia'

export const PantallaProgreso: React.FC<{ academias: Academia[]; alAbrirAcademia: (id: string) => void }> = ({ academias, alAbrirAcademia }) => {
  const [leidosTemas, setLeidosTemas] = useState<Set<string>>(() => temasLeidos())
  const [leidosBiblia, setLeidosBiblia] = useState<Set<string>>(() => cargarLeidos())
  const [datos, setDatos] = useState<DatosProgreso>(() => cargarDatosProgreso())

  const totalT = totalCodigos(academias)
  const nT = leidosTemas.size
  const pctT = totalT ? Math.round((nT / totalT) * 100) : 0
  const nConcluidas = datos.concluidas.size

  const catalogo = useMemo(() => agruparPorNiveles(academias, datos), [academias, datos])

  /** Conteo general por estado (v1.7.2): el resumen de la formación
   *  entera, con los mismos colores del catálogo. */
  const conteoEstados = useMemo(() => {
    const c = { concluida: 0, 'lista-encuentro': 0, 'en-curso': 0, bloqueada: 0 }
    for (const g of catalogo.grupos) {
      for (const a of g.academias) c[estadoAcademia(a, datos, g.desbloqueado)]++
    }
    return c
  }, [catalogo, datos])

  const reiniciarTodo = () => {
    if (window.confirm('¿Borrar todo el progreso guardado en este teléfono?')) {
      reiniciarProgresoTemas()
      reiniciarProgresoFormacion()
      reiniciarLeidos()
      setLeidosTemas(new Set())
      setLeidosBiblia(new Set())
      setDatos(cargarDatosProgreso())
    }
  }

  return (
    <div className="lista">
      <h2>📊 Mi progreso</h2>
      <div className="progreso-resumen">
        <div className="progreso-caja">
          <div className="grande">{nT}/{totalT}</div>
          <div className="et">códigos leídos ({pctT}%)</div>
        </div>
        <div className="progreso-caja">
          <div className="grande">{nConcluidas}</div>
          <div className="et">academias concluidas (con encuentro)</div>
        </div>
        <div className="progreso-caja">
          <div className="grande">{leidosBiblia.size}</div>
          <div className="et">capítulos bíblicos leídos</div>
        </div>
      </div>

      {academias.length > 0 && (
        <p className="resumen-estados">
          <span className="estado-texto estado-concluida">✅ {conteoEstados.concluida} concluidas</span>
          {' · '}
          <span className="estado-texto estado-lista-encuentro">🤝 {conteoEstados['lista-encuentro']} listas para el encuentro</span>
          {' · '}
          <span className="estado-texto estado-en-curso">📖 {conteoEstados['en-curso']} en curso</span>
          {' · '}
          <span className="estado-texto estado-bloqueada">🔒 {conteoEstados.bloqueada} bloqueadas</span>
        </p>
      )}

      {academias.length === 0 ? (
        <p style={{ color: '#8f8468', fontSize: 13, marginTop: 0 }}>
          Aún no tienes academias importadas. Cuando importes una en la
          pestaña Academias, aquí verás tu avance en ella.
        </p>
      ) : (
        <p style={{ color: '#8f8468', fontSize: 13, marginTop: 0 }}>
          Toca una academia para abrirla directamente.
        </p>
      )}

      {catalogo.grupos.map((grupo) => {
        const resumen = resumenNivel(grupo, datos)
        return (
          <div key={grupo.nombre} style={{ marginBottom: 18 }}>
            <div className="nivel-cabecera">
              <h3>{grupo.orden === null ? '📦' : '🎚️'} {grupo.nombre}</h3>
              <span className={`chip-estado nivel-${resumen.estado}`}>
                {resumen.estado === 'bloqueado'
                  ? '🔒 Bloqueado'
                  : resumen.estado === 'concluido'
                    ? '✅ Concluido'
                    : resumen.estado === 'espera-encuentro'
                      ? '🤝 Espera encuentros'
                      : '📖 En curso'}
              </span>
            </div>
            <div className="termometro">
              {grupo.academias.map((a) => (
                <i
                  key={a.id}
                  className={`seg-${estadoAcademia(a, datos, grupo.desbloqueado)}`}
                />
              ))}
            </div>
            <p style={{ color: '#cfc4a8', fontSize: 13, margin: '2px 0 10px' }}>
              {resumen.nConcluidas}/{resumen.totalAcademias} academias concluidas · Leído{' '}
              {resumen.pctLeido}% · Practicado {resumen.pctPracticado}%
            </p>
            {grupo.academias.map((a) => {
              const p = progresoAcademia(a, datos)
              const est = estadoAcademia(a, datos, grupo.desbloqueado)
              const pct = p.total ? Math.round((p.nLeidos / p.total) * 100) : 0
              return (
                <button
                  key={a.id}
                  onClick={() => est !== 'bloqueada' && alAbrirAcademia(a.id)}
                  style={{
                    display: 'block', width: '100%', background: 'none', border: 'none',
                    padding: '2px 0', marginBottom: 12, textAlign: 'left',
                    cursor: est === 'bloqueada' ? 'default' : 'pointer',
                    color: 'inherit', fontFamily: 'inherit',
                    opacity: est === 'bloqueada' ? 0.55 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 14 }}>
                    <span style={{ color: '#f0e8d2' }}>{a.numero} · {a.titulo}</span>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#c9a227' }}>{pct}%</span>
                      <span style={{ color: '#c9a227', fontSize: 18, marginLeft: 6 }}>›</span>
                    </span>
                  </div>
                  <div
                    className={`estado-texto estado-${est}`}
                    style={{ fontSize: 12, margin: '2px 0 4px' }}
                  >
                    {TEXTO_ESTADO_ACADEMIA[est]} · {p.nLeidos}/{p.total} leídos · {p.nPracticados}/{p.total} practicados
                  </div>
                  <div className="barra-progreso lectura"><i style={{ width: `${pct}%` }} /></div>
                  <div className="barra-progreso practica">
                    <i style={{ width: `${p.total ? Math.round((p.nPracticados / p.total) * 100) : 0}%` }} />
                  </div>
                </button>
              )
            })}
          </div>
        )
      })}

      <button className="btn-secundario" onClick={reiniciarTodo}>
        Borrar progreso del teléfono
      </button>
      <p className="sincronizar-nota">
        Tu progreso vive en este teléfono y funciona sin internet.<br />
        Una academia se concluye en el encuentro presencial con el Maestro,
        no solo leyendo: por eso el avance es por niveles.
      </p>
      <p className="nota-version">Las academias llegan por paquetes: impórtalas en la pestaña Academias.</p>
    </div>
  )
}
