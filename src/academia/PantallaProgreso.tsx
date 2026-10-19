import React, { useState } from 'react'
import { ACADEMIAS, totalCodigos, FECHA_CONTENIDO } from './contenido'
import { temasLeidos, reiniciarProgresoTemas } from './progreso'
import { cargarLeidos, reiniciarLeidos } from '../biblia/progresoBiblia'

export const PantallaProgreso: React.FC = () => {
  const [leidosTemas, setLeidosTemas] = useState<Set<string>>(() => temasLeidos())
  const [leidosBiblia, setLeidosBiblia] = useState<Set<string>>(() => cargarLeidos())

  const totalT = totalCodigos()
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

      {ACADEMIAS.map((a) => {
        const n = a.codigos.filter((c) => leidosTemas.has(c.id)).length
        const pct = a.codigos.length ? Math.round((n / a.codigos.length) * 100) : 0
        return (
          <div key={a.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: '#f0e8d2' }}>{a.numero} · {a.titulo}</span>
              <span style={{ color: '#c9a227' }}>{pct}%</span>
            </div>
            <div className="barra-progreso"><i style={{ width: `${pct}%` }} /></div>
          </div>
        )
      })}

      <button className="btn-secundario" onClick={reiniciarTodo}>
        Borrar progreso del teléfono
      </button>
      <p className="sincronizar-nota">
        Tu progreso vive en este teléfono y funciona sin internet.<br />
        Si un día te conectas, aquí aparecerá la opción de sincronizarlo con la nube.
      </p>
      <p className="nota-version">Contenido incluido en la app · {FECHA_CONTENIDO}</p>
    </div>
  )
}
