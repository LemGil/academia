import React, { useEffect, useMemo, useState } from 'react'
import {
  VersionBiblia, VERSIONES_BIBLIA, librosDe, nombreLibro,
  totalCapitulos, obtenerCapitulo, etiquetaReferencia, parsearReferencia,
} from '../biblia/bibliaService'
import {
  cargarLeidos, alternarLeido, claveCapitulo, conteoPorLibro,
} from '../biblia/progresoBiblia'
import { Lector } from './Lector'
import type { DestinoBiblia } from '../App'

type VistaBiblia =
  | { tipo: 'libros' }
  | { tipo: 'caps'; codigo: string }
  | { tipo: 'lectura'; codigo: string; cap: number }

export const Biblia: React.FC<{ destino?: DestinoBiblia | null }> = ({ destino }) => {
  const [version, setVersion] = useState<VersionBiblia>(() =>
    (localStorage.getItem('academia_biblia_version') as VersionBiblia) || 'rv1909')
  const [vista, setVista] = useState<VistaBiblia>({ tipo: 'libros' })
  const [leidos, setLeidos] = useState<Set<string>>(() => cargarLeidos())
  const [versiculos, setVersiculos] = useState<string[] | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const libros = useMemo(() => librosDe(version), [version])

  useEffect(() => {
    if (vista.tipo === 'lectura') {
      setVersiculos(null)
      obtenerCapitulo(version, vista.codigo, vista.cap)
        .then(setVersiculos)
        .catch(() => setVersiculos([]))
    }
  }, [vista, version])

  // Salto directo desde el plan de lectura
  useEffect(() => {
    if (destino) {
      setVista({ tipo: 'lectura', codigo: destino.codigo, cap: destino.cap })
    }
  }, [destino])

  const cambiarVersion = (v: VersionBiblia) => {
    setVersion(v)
    localStorage.setItem('academia_biblia_version', v)
    setVista({ tipo: 'libros' })
  }

  const irReferencia = () => {
    const r = parsearReferencia(busqueda)
    if (r) {
      setVista({ tipo: 'lectura', codigo: r.codigo, cap: r.capitulo })
      setBusqueda('')
    }
  }

  // ---- Lectura de capítulo ----
  if (vista.tipo === 'lectura') {
    const total = totalCapitulos(version, vista.codigo)
    const clave = claveCapitulo(version, vista.codigo, vista.cap)
    const esLeido = leidos.has(clave)
    const nombre = nombreLibro(version, vista.codigo)
    const ant = vista.cap > 1 ? vista.cap - 1 : null
    const sig = vista.cap < total ? vista.cap + 1 : null
    return (
      <Lector
        titulo={etiquetaReferencia(version, vista.codigo, vista.cap)}
        subtitulo={VERSIONES_BIBLIA.find((v) => v.id === version)?.nombre}
        onAtras={() => setVista({ tipo: 'caps', codigo: vista.codigo })}
        leido={esLeido}
        onAlternarLeido={() => setLeidos(new Set(alternarLeido(clave)))}
        onAnterior={ant ? () => setVista({ tipo: 'lectura', codigo: vista.codigo, cap: ant }) : undefined}
        onSiguiente={sig ? () => setVista({ tipo: 'lectura', codigo: vista.codigo, cap: sig }) : undefined}
        etiquetaAnterior={`Cap. ${ant}`}
        etiquetaSiguiente={`Cap. ${sig}`}
      >
        {versiculos === null && <p>Cargando…</p>}
        {versiculos !== null && versiculos.map((v, i) => (
          <p key={i} className="versiculo">
            <span className="n">{i + 1}</span>{v}
          </p>
        ))}
      </Lector>
    )
  }

  // ---- Capítulos de un libro ----
  if (vista.tipo === 'caps') {
    const total = totalCapitulos(version, vista.codigo)
    return (
      <div className="lista">
        <button className="btn-nav" onClick={() => setVista({ tipo: 'libros' })}>‹ Libros</button>
        <h2 style={{ marginTop: 12 }}>{nombreLibro(version, vista.codigo)}</h2>
        <div className="rejilla-caps">
          {Array.from({ length: total }, (_, i) => i + 1).map((c) => {
            const leido = leidos.has(claveCapitulo(version, vista.codigo, c))
            return (
              <button
                key={c}
                className={leido ? 'leido' : ''}
                onClick={() => setVista({ tipo: 'lectura', codigo: vista.codigo, cap: c })}
              >
                {c}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- Libros ----
  const at = libros.filter((l) => l.testamento === 'AT')
  const nt = libros.filter((l) => l.testamento === 'NT')
  const grupo = (titulo: string, arr: typeof libros) => (
    <>
      <div className="separador-testamento">{titulo}</div>
      {arr.map((l) => {
        const n = conteoPorLibro(leidos, version, l.codigo)
        const pct = Math.round((n / l.capitulos) * 100)
        return (
          <button key={l.codigo} onClick={() => setVista({ tipo: 'caps', codigo: l.codigo })}>
            {l.nombre}
            <span className="pct">{n}/{l.capitulos}{pct === 100 ? ' ✓' : ''}</span>
          </button>
        )
      })}
    </>
  )

  return (
    <div>
      <div className="selector-version">
        {VERSIONES_BIBLIA.map((v) => (
          <button key={v.id} className={version === v.id ? 'activo' : ''} onClick={() => cambiarVersion(v.id)}>
            {v.corta}
          </button>
        ))}
      </div>
      <div className="buscador">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && irReferencia()}
          placeholder="Ir a: Juan 3:16"
          enterKeyHint="go"
        />
      </div>
      <div className="lista" style={{ paddingTop: 4 }}>
        <h2>📖 Biblia</h2>
        <div className="rejilla-libros" style={{ padding: 0 }}>
          {grupo('Antiguo Testamento', at)}
          {grupo('Nuevo Testamento', nt)}
        </div>
        <p className="nota-version">
          {VERSIONES_BIBLIA.find((v) => v.id === version)?.nombre} · incluida en la app, sin internet
        </p>
      </div>
    </div>
  )
}
