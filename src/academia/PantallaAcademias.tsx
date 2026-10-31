import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Academia, ACADEMIAS_INCLUIDAS } from './contenido'
import { temasLeidos, alternarTemaLeido } from './progreso'
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
}

const IDS_INCLUIDAS = new Set(ACADEMIAS_INCLUIDAS.map((a) => a.id))

export const PantallaAcademias: React.FC<Props> = ({ academias, importadas, alRefrescarCatalogo, destino }) => {
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' })
  const [leidos, setLeidos] = useState<Set<string>>(() => temasLeidos())
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const entradaArchivo = useRef<HTMLInputElement>(null)

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
      : `¿Eliminar la academia importada «${a.titulo}»?`
    if (!window.confirm(mensaje)) return
    try {
      await borrarPaqueteImportado(a.id)
      setAviso({ ok: true, texto: esActualizacion ? '↩️ Actualización retirada: volvió la versión incluida.' : '🗑 Academia importada eliminada.' })
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
    const esImportada = importadas.has(academia.id)
    const esActualizacion = esImportada && IDS_INCLUIDAS.has(academia.id)
    return (
      <div className="lista">
        <button className="btn-nav" onClick={() => setVista({ tipo: 'lista' })}>‹ Academias</button>
        <h2 style={{ marginTop: 12 }}>{academia.numero} · {academia.titulo}</h2>
        <p style={{ color: '#cfc4a8', fontSize: 14 }}>
          {nLeidos} de {academia.codigos.length} códigos leídos
          {esImportada && (esActualizacion ? ' · 📥 versión actualizada por paquete' : ' · 📥 academia importada')}
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
        {esImportada && (
          <button className="btn-secundario" style={{ marginTop: 16 }} onClick={() => alBorrarImportada(academia)}>
            {esActualizacion ? '🗑 Quitar actualización (vuelve la incluida)' : '🗑 Eliminar academia importada'}
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
      {academias.map((a) => {
        const nLeidos = a.codigos.filter((c) => leidos.has(c.id)).length
        const pct = a.codigos.length ? Math.round((nLeidos / a.codigos.length) * 100) : 0
        const esImportada = importadas.has(a.id)
        return (
          <button key={a.id} className="tarjeta" onClick={() => setVista({ tipo: 'academia', id: a.id })}>
            <span className="num">{a.numero}{esImportada ? ' · 📥' : ''}</span>
            <h3>{a.titulo}</h3>
            <p>{a.codigos.length} códigos · {nLeidos} leídos</p>
            <div className="barra-progreso"><i style={{ width: `${pct}%` }} /></div>
          </button>
        )
      })}
    </div>
  )
}
