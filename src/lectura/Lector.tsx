import React, { useEffect, useState } from 'react'
import { irAlInicio } from './scroll'

export type TemaLectura = 'nocturno' | 'diurno' | 'sepia'

interface Props {
  titulo: string
  subtitulo?: string
  onAtras: () => void
  children: React.ReactNode
  leido: boolean
  onAlternarLeido: () => void
  /** Formación por niveles (v1.7): la marca de «practicado», junto a la
   *  de leído. Opcional: la Biblia no la usa. */
  practicado?: boolean
  onAlternarPracticado?: () => void
  /** Controles extra en la MISMA línea de los temas (v1.7.2): la Biblia
   *  pone aquí su selector de versión, para no gastar otra línea en
   *  pantallas pequeñas. Las academias no lo usan. */
  extraControles?: React.ReactNode
  onAnterior?: () => void
  onSiguiente?: () => void
  etiquetaAnterior?: string
  etiquetaSiguiente?: string
}

// Chrome de lectura compartido: temas, tamaño de letra, navegación y "marcar leído".
export const Lector: React.FC<Props> = ({
  titulo, subtitulo, onAtras, children,
  leido, onAlternarLeido, practicado, onAlternarPracticado, extraControles, onAnterior, onSiguiente,
  etiquetaAnterior, etiquetaSiguiente,
}) => {
  const [tema, setTema] = useState<TemaLectura>(() =>
    (localStorage.getItem('academia_tema_lectura') as TemaLectura) || 'nocturno')
  const [tamano, setTamano] = useState<number>(() => {
    const g = localStorage.getItem('academia_tamano_letra')
    return g ? parseInt(g, 10) : 19
  })

  // Al pasar a otro capítulo o código, la lectura empieza desde arriba
  // (verso 1), no donde quedó el scroll del anterior.
  useEffect(() => {
    irAlInicio()
  }, [titulo])

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
        {extraControles}
      </div>

      <article className="lector-cuerpo" style={{ fontSize: tamano }}>
        {children}
      </article>

      {/* v1.7.2: una sola línea — capítulo anterior, las marcas y el
          siguiente capítulo comparten el pie (pantallas pequeñas). */}
      <footer className="lector-pie una-linea">
        {onAnterior ? (
          <button className="btn-nav" onClick={onAnterior}>‹ {etiquetaAnterior || 'Anterior'}</button>
        ) : <span className="hueco" />}
        <div className="lector-marcas">
          <button className={`btn-leido ${leido ? 'si' : ''}`} onClick={onAlternarLeido}>
            {leido ? '✓ Leído' : 'Marcar leído'}
          </button>
          {onAlternarPracticado && (
            <button className={`btn-leido ${practicado ? 'si' : ''}`} onClick={onAlternarPracticado}>
              {practicado ? '✓ Practicado' : 'Marcar practicado'}
            </button>
          )}
        </div>
        {onSiguiente ? (
          <button className="btn-nav" onClick={onSiguiente}>{etiquetaSiguiente || 'Siguiente'} ›</button>
        ) : <span className="hueco" />}
      </footer>
    </div>
  )
}
