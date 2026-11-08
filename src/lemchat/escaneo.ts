// Escaneo de códigos QR de contacto con la cámara del teléfono.
//
// Flujo: el plugin oficial de cámara de Capacitor abre la cámara nativa,
// el estudiante encuadra el QR del otro teléfono y hace la foto; aquí se
// decodifica la imagen con jsQR (puro JavaScript, sin red y sin cuentas)
// y el texto resultante sigue exactamente el mismo camino que el código
// pegado a mano (`agregarContactoPorCodigo`). Si la foto no trae un QR
// legible, se dice con honestidad y el pegado manual sigue disponible.

import jsQR from 'jsqr'

/** Decodifica un QR desde píxeles RGBA crudos. Devuelve el texto o null. */
export function decodificarQr(
  datos: Uint8ClampedArray,
  ancho: number,
  alto: number,
): string | null {
  try {
    const resultado = jsQR(datos, ancho, alto, { inversionAttempts: 'attemptBoth' })
    const texto = resultado?.data?.trim()
    return texto ? texto : null
  } catch {
    return null
  }
}

/** Lee el QR de una foto dada como data URL (lo que devuelve la cámara). */
export async function leerQrDeDataUrl(dataUrl: string): Promise<string | null> {
  const imagen = await new Promise<HTMLImageElement>((resolver, rechazar) => {
    const img = new Image()
    img.onload = () => resolver(img)
    img.onerror = () => rechazar(new Error('la foto no se pudo leer'))
    img.src = dataUrl
  })
  // Se reduce la foto a un tamaño razonable: jsQR trabaja mejor y más
  // rápido, y un QR de contacto no necesita los megapíxeles enteros.
  const MAX = 1600
  const escala = Math.min(1, MAX / Math.max(imagen.naturalWidth, imagen.naturalHeight))
  const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala))
  const alto = Math.max(1, Math.round(imagen.naturalHeight * escala))
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(imagen, 0, 0, ancho, alto)
  const pixeles = ctx.getImageData(0, 0, ancho, alto)
  return decodificarQr(pixeles.data, ancho, alto)
}

/**
 * Abre la cámara, toma la foto y devuelve el texto del QR.
 * Lanza Error con mensaje listo para mostrar si se cancela o no se lee.
 */
export async function escanearCodigoConCamara(): Promise<string> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
  let dataUrl: string | undefined
  try {
    const foto = await Camera.getPhoto({
      quality: 92,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      promptLabelHeader: 'Escanear el código del contacto',
      promptLabelCancel: 'Cancelar',
      promptLabelPhoto: 'Usar la cámara',
      promptLabelPicture: 'Hacer la foto',
    })
    dataUrl = foto.dataUrl
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e)
    if (/cancel/i.test(detalle)) throw new Error('__cancelado__')
    throw new Error('no se pudo abrir la cámara en este teléfono')
  }
  if (!dataUrl) throw new Error('la cámara no devolvió ninguna foto')
  const texto = await leerQrDeDataUrl(dataUrl)
  if (!texto) {
    throw new Error(
      'no se leyó ningún código QR en la foto: acércate más, busca buena luz y que el QR llene la pantalla',
    )
  }
  return texto
}
