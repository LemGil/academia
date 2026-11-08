// Pruebas del decodificador QR: se genera un QR real con la misma
// librería que dibuja el código de contacto, se rasteriza a píxeles
// RGBA como haría una foto, y se comprueba que el texto vuelve exacto.

import { describe, expect, it } from 'vitest'
import qrcode from 'qrcode-generator'
import { decodificarQr } from './escaneo'

function rasterizar(texto: string, escala = 8, margen = 4) {
  const qr = qrcode(0, 'M')
  qr.addData(texto)
  qr.make()
  const n = qr.getModuleCount()
  const lado = (n + margen * 2) * escala
  const datos = new Uint8ClampedArray(lado * lado * 4).fill(255)
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(f, c)) continue
      for (let y = 0; y < escala; y++) {
        for (let x = 0; x < escala; x++) {
          const px = ((f + margen) * escala + y) * lado + (c + margen) * escala + x
          datos[px * 4] = 0
          datos[px * 4 + 1] = 0
          datos[px * 4 + 2] = 0
          datos[px * 4 + 3] = 255
        }
      }
    }
  }
  return { datos, lado }
}

describe('decodificarQr', () => {
  it('recupera exacto el texto de un código de contacto', () => {
    const texto =
      'lemchat1:eyJub21icmUiOiJHaWwiLCJjbGF2ZSI6ImFiY2RlZmcifQ'
    const { datos, lado } = rasterizar(texto)
    expect(decodificarQr(datos, lado, lado)).toBe(texto)
  })

  it('devuelve null ante una imagen en blanco (sin QR)', () => {
    const lado = 120
    const datos = new Uint8ClampedArray(lado * lado * 4).fill(255)
    expect(decodificarQr(datos, lado, lado)).toBeNull()
  })
})
