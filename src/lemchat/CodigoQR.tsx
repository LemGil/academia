// Dibuja un código QR como SVG a partir de un texto (el código de
// contacto LemChat). Sin imágenes ni red: se genera en el teléfono.

import React, { useMemo } from 'react'
import qrcode from 'qrcode-generator'

export const CodigoQR: React.FC<{ texto: string; tamano?: number }> = ({ texto, tamano = 220 }) => {
  const ruta = useMemo(() => {
    try {
      const qr = qrcode(0, 'M')
      qr.addData(texto)
      qr.make()
      const n = qr.getModuleCount()
      let d = ''
      for (let f = 0; f < n; f++) {
        for (let c = 0; c < n; c++) {
          if (qr.isDark(f, c)) d += `M${c} ${f}h1v1h-1z`
        }
      }
      return { d, n }
    } catch {
      return null
    }
  }, [texto])

  if (!ruta) {
    return <p className="chat-nota">No se pudo dibujar el QR; usa el código de texto.</p>
  }
  return (
    <svg
      className="chat-qr"
      width={tamano}
      height={tamano}
      viewBox={`-2 -2 ${ruta.n + 4} ${ruta.n + 4}`}
      role="img"
      aria-label="Código QR de contacto LemChat"
    >
      <rect x={-2} y={-2} width={ruta.n + 4} height={ruta.n + 4} fill="#ffffff" />
      <path d={ruta.d} fill="#101418" />
    </svg>
  )
}
