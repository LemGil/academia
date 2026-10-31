import React, { useState } from 'react'
import { Academia, totalCodigos } from './contenido'
import { temasLeidos, reiniciarProgresoTemas } from './progreso'
import { cargarLeidos, reiniciarLeidos } from '../biblia/progresoBiblia'

export const PantallaProgreso: React.FC<{ academias: Academia[]; alAbrirAcademia: (id: string) => void }> = ({ academias, alAbrirAcademia }) => {
  const [leidosTemas, setLeidosTemas] = useState<Set<string>>(() => temasLeidos())
  const [leidosBiblia, setLeidosBiblia] = useState<Set<string>>(() => cargarLeidos())

  const totalT = totalCodigos(academias)
  const nT = leidosTemas.size
  const pctT = totalT ? Math.round((nT / totalT) * 100) : 0

  const reiniciarTodo = () => {
    if (window.confirm('¿Borrar todo el progreso guardado en este teléfono?')) {
      reiniciarProgresoTemas()
      reiniciarLeidos()
      setLeidosTemas(new Set())
      setLeidosBiblia(new Set())
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
          <div className="grande">{leidosBiblia.size}</div>
          <div className="et">capítulos bíblicos leídos</div>
        </div>
      </div>

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

      {academias.map((a) => {
        const n = a.codigos.filter((c) => leidosTemas.has(c.id)).length
        const pct = a.codigos.length ? Math.round((n / a.codigos.length) * 100) : 0
        return (
          <button
            key={a.id}
            onClick={() => alAbrirAcademia(a.id)}
            style={{
              display: 'block', width: '100%', background: 'none', border: 'none',
              padding: '2px 0', marginBottom: 12, textAlign: 'left',
              cursor: 'pointer', color: 'inherit', fontFamily: 'inherit',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 14 }}>
              <span style={{ color: '#f0e8d2' }}>{a.numero} · {a.titulo}</span>
              <span style={{ whiteSpace: 'nowrap' }}>
                <span style={{ color: '#c9a227' }}>{pct}%</span>
                <span style={{ color: '#c9a227', fontSize: 18, marginLeft: 6 }}>›</span>
              </span>
            </div>
            <div className="barra-progreso"><i style={{ width: `${pct}%` }} /></div>
          </button>
        )
      })}

      <button className="btn-secundario" onClick={reiniciarTodo}>
        Borrar progreso del teléfono
      </button>
      <p className="sincronizar-nota">
        Tu progreso vive en este teléfono y funciona sin internet.<br />
        Si un día te conectas, aquí aparecerá la opción de sincronizarlo con la nube.
      </p>
      <p className="nota-version">Las academias llegan por paquetes: impórtalas en la pestaña Academias.</p>
    </div>
  )
}
