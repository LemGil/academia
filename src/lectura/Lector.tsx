import React, { useState } from 'react'

export type TemaLectura = 'nocturno' | 'diurno' | 'sepia'

interface Props {
  titulo: string
  subtitulo?: string
  onAtras: () => void
  children: React.ReactNode
  leido: boolean
  onAlternarLeido: () => void
  onAnterior?: () => void
  onSiguiente?: () => void
  etiquetaAnterior?: string
  etiquetaSiguiente?: string
}

// Chrome de lectura compartido: temas, tamaño de letra, navegación y "marcar leído".
export const Lector: React.FC<Props> = ({
  titulo, subtitulo, onAtras, children,
  leido, onAlternarLeido, onAnterior, onSiguiente,
  etiquetaAnterior, etiquetaSiguiente,
}) => {
  const [tema, setTema] = useState<TemaLectura>(() =>
    (localStorage.getItem('academia_tema_lectura') as TemaLectura) || 'nocturno')
  const [tamano, setTamano] = useState<number>(() => {
    const g = localStorage.getItem('academia_tamano_letra')
    return g ? parseInt(g, 10) : 19
  })

  const cambiarTema = (t: TemaLectura) => {
    setTema(t)
    localStorage.setItem('academia_tema_lectura', t)
  }
  const cambiarTamano = (d: number) => {
    const n = Math.min(30, Math.max(14, tamano + d))
    setTamano(n)
    localStorage.setItem('academia_tamano_letra', String(n))
  }

  return (
    <div className={`lector tema-${tema}`}>
      <header className="lector-barra">
        <button className="btn-atras" onClick={onAtras} aria-label="Atrás">‹</button>
        <div className="lector-titulo">
          <strong>{titulo}</strong>
          {subtitulo && <span>{subtitulo}</span>}
        </div>
        <div className="lector-ajustes">
          <button onClick={() => cambiarTamano(-1)} aria-label="Letra más pequeña">A−</button>
          <button onClick={() => cambiarTamano(1)} aria-label="Letra más grande">A+</button>
        </div>
      </header>

      <div className="lector-temas">
        {(['nocturno', 'diurno', 'sepia'] as TemaLectura[]).map((t) => (
          <button
            key={t}
            className={tema === t ? 'activo' : ''}
            onClick={() => cambiarTema(t)}
          >
            {t === 'nocturno' ? 'Noche' : t === 'diurno' ? 'Día' : 'Sepia'}
          </button>
        ))}
      </div>

      <article className="lector-cuerpo" style={{ fontSize: tamano }}>
        {children}
      </article>

      <footer className="lector-pie">
        <div className="lector-nav">
          {onAnterior ? (
            <button className="btn-nav" onClick={onAnterior}>‹ {etiquetaAnterior || 'Anterior'}</button>
          ) : <span />}
          {onSiguiente ? (
            <button className="btn-nav" onClick={onSiguiente}>{etiquetaSiguiente || 'Siguiente'} ›</button>
          ) : <span />}
        </div>
        <button className={`btn-leido ${leido ? 'si' : ''}`} onClick={onAlternarLeido}>
          {leido ? '✓ Leído' : 'Marcar como leído'}
        </button>
      </footer>
    </div>
  )
}
