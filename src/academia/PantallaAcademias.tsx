import React, { useMemo, useState } from 'react'
import { ACADEMIAS, Academia } from './contenido'
import { temasLeidos, alternarTemaLeido } from './progreso'
import { Lector } from '../lectura/Lector'
import { Markdown } from '../lectura/Markdown'

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'academia'; id: string }
  | { tipo: 'lector'; codigoId: string }

export const PantallaAcademias: React.FC = () => {
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' })
  const [leidos, setLeidos] = useState<Set<string>>(() => temasLeidos())

  const contenido = useMemo(() => {
    if (vista.tipo === 'academia') {
      return ACADEMIAS.find((a) => a.id === vista.id) || null
    }
    if (vista.tipo === 'lector') {
      for (const a of ACADEMIAS) {
        const c = a.codigos.find((x) => x.id === vista.codigoId)
        if (c) return { academia: a, codigo: c }
      }
      return null
    }
    return null
  }, [vista])

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
    const nLeidos = academia.codigos.filter((c) => leidos.has(c.id)).length
    return (
      <div className="lista">
        <button className="btn-nav" onClick={() => setVista({ tipo: 'lista' })}>‹ Academias</button>
        <h2 style={{ marginTop: 12 }}>{academia.numero} · {academia.titulo}</h2>
        <p style={{ color: '#cfc4a8', fontSize: 14 }}>
          {nLeidos} de {academia.codigos.length} códigos leídos
        </p>
        {academia.codigos.map((c) => {
          const leido = leidos.has(c.id)
          return (
            <button
              key={c.id}
              className={`tarjeta fila-codigo ${leido ? 'leido' : ''}`}
              onClick={() => setVista({ tipo: 'lector', codigoId: c.id })}
            >
              <span className="check">✓</span>
              <span className="txt">
                <span className="num">Código</span>
                <h3 style={{ margin: '4px 0' }}>{c.titulo}</h3>
              </span>
              <span className="flecha">›</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="lista">
      <h2>📚 Academias</h2>
      {ACADEMIAS.map((a) => {
        const nLeidos = a.codigos.filter((c) => leidos.has(c.id)).length
        const pct = a.codigos.length ? Math.round((nLeidos / a.codigos.length) * 100) : 0
        return (
          <button key={a.id} className="tarjeta" onClick={() => setVista({ tipo: 'academia', id: a.id })}>
            <span className="num">{a.numero}</span>
            <h3>{a.titulo}</h3>
            <p>{a.codigos.length} códigos · {nLeidos} leídos</p>
            <div className="barra-progreso"><i style={{ width: `${pct}%` }} /></div>
          </button>
        )
      })}
    </div>
  )
}
