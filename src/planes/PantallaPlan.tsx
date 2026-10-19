import React, { useState } from 'react'
import {
  PLANES, planPorId, planActivo, activarPlan, quitarPlan,
  diaDeHoy, diaCompletado, resumenLecturas, capitulosDelDia, reiniciarPlan,
} from './planes'
import { cargarLeidos } from '../biblia/progresoBiblia'

interface Props {
  onIrACapitulo: (codigo: string, cap: number) => void
}

export const PantallaPlan: React.FC<Props> = ({ onIrACapitulo }) => {
  const [leidos] = useState<Set<string>>(() => cargarLeidos())
  const [verTodos, setVerTodos] = useState(false)
  const [idActivo, setIdActivo] = useState<string | null>(() => planActivo())

  // ---- Selector de plan (al iniciar) ----
  if (!idActivo) {
    return (
      <div className="lista">
        <h2>📅 Elige tu plan de lectura</h2>
        <p style={{ color: '#cfc4a8', fontSize: 15, marginTop: -8 }}>
          ¿Qué plan quieres seguir este año?
        </p>
        {PLANES.map((p) => (
          <button
            key={p.id}
            className="tarjeta"
            onClick={() => {
              activarPlan(p.id)
              setIdActivo(p.id)
            }}
          >
            <span className="num">{p.carga}</span>
            <h3>{p.nombre}</h3>
            <p>{p.descripcion}</p>
            <p style={{ color: '#c9a227', marginTop: 6 }}>Comenzar ›</p>
          </button>
        ))}
        <p className="nota-version">Puedes cambiar de plan cuando quieras · funciona sin internet</p>
      </div>
    )
  }

  // ---- Plan activo ----
  const plan = planPorId(idActivo)
  const total = plan.dias.length
  const hoy = diaDeHoy(plan)
  const diaHoy = plan.dias[hoy - 1]

  const completados = plan.dias.filter((d) => diaCompletado(d, leidos)).length
  const pct = Math.round((completados / total) * 100)

  return (
    <div className="lista">
      <h2>📅 {plan.nombre}</h2>
      <p style={{ color: '#cfc4a8', fontSize: 14, marginTop: -8 }}>{plan.descripcion}</p>

      <div className="progreso-caja" style={{ marginBottom: 16 }}>
        <div className="grande">{completados}/{total}</div>
        <div className="et">días completados ({pct}%)</div>
        <div className="barra-progreso"><i style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="tarjeta" style={{ borderColor: '#c9a227', cursor: 'default' }}>
        <span className="num">Hoy · Día {hoy} de {total}</span>
        <h3>{resumenLecturas(diaHoy)}</h3>
        {diaHoy.lecturas.length > 0 && <p>{capitulosDelDia(diaHoy)} capítulos</p>}
        <div style={{ marginTop: 10 }}>
          {diaHoy.lecturas.map((l, i) => (
            <button
              key={i}
              className="btn-nav"
              style={{ marginRight: 8, marginBottom: 8 }}
              onClick={() => onIrACapitulo(l.libro, l.capInicio)}
            >
              Leer {l.nombreLibro} {l.capInicio}
              {l.capFin !== l.capInicio ? `–${l.capFin}` : ''} ›
            </button>
          ))}
        </div>
      </div>

      <button className="btn-secundario" onClick={() => setVerTodos(!verTodos)}>
        {verTodos ? 'Ocultar los días' : `Ver los ${total} días`}
      </button>

      {verTodos && (
        <div style={{ marginTop: 12 }}>
          {plan.dias.map((d) => {
            const ok = diaCompletado(d, leidos)
            const primera = d.lecturas[0]
            return (
              <button
                key={d.dia}
                className={`tarjeta fila-codigo ${ok ? 'leido' : ''}`}
                style={{ padding: '10px 14px' }}
                onClick={() => {
                  if (primera) onIrACapitulo(primera.libro, primera.capInicio)
                }}
              >
                <span className="check">✓</span>
                <span className="txt">
                  <span className="num">Día {d.dia}</span>
                  <h3 style={{ margin: '2px 0', fontSize: 16 }}>{resumenLecturas(d)}</h3>
                </span>
                <span className="flecha">›</span>
              </button>
            )
          })}
        </div>
      )}

      <button
        className="btn-secundario"
        onClick={() => {
          if (window.confirm(`¿Cambiar de plan? (No se borra lo que ya leíste)`)) {
            quitarPlan()
            setIdActivo(null)
            setVerTodos(false)
          }
        }}
      >
        Cambiar de plan
      </button>
      <button
        className="btn-secundario"
        onClick={() => {
          if (window.confirm('¿Empezar este plan desde el día 1? (No se borra lo leído)')) {
            reiniciarPlan(plan)
            window.location.reload()
          }
        }}
      >
        Empezar este plan de nuevo
      </button>
      <p className="nota-version">El día avanza solo con el calendario · funciona sin internet</p>
    </div>
  )
}
