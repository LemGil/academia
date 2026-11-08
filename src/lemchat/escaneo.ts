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

/** Lee el QR de una foto dada como URL (data URL o ruta convertible). */
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

const SIN_QR =
  'no se leyó ningún código QR en la foto: acércate más, busca buena luz y que el QR llene la pantalla'

function detalleDe(e: unknown): string {
  const d = e instanceof Error ? e.message : String(e)
  return d.replace(/\s+/g, ' ').slice(0, 160)
}

/**
 * Abre la cámara, toma la foto y devuelve el texto del QR.
 * Lanza Error con mensaje listo para mostrar si se cancela o no se lee.
 *
 * v1.5.5 — diagnóstico de campo (2026-11-07): con el permiso ya declarado
 * y concedido, el camino clásico `getPhoto` (flujo heredado del plugin,
 * que delega en la app de cámara del sistema) rechazaba la apertura en
 * dos teléfonos sin abrir la cámara, y el error real quedaba escondido
 * tras un texto genérico. Ahora: (1) el permiso se pide de forma
 * explícita primero; (2) se intenta primero el camino NUEVO del plugin
 * v8 (`takePhoto`, cámara propia CameraX, sin delegar en otra app);
 * (3) si también falla, se prueba el clásico; (4) si ninguno abre, el
 * mensaje muestra el error real de cada camino, no un texto genérico.
 */
export async function escanearCodigoConCamara(): Promise<string> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')

  // (1) Permiso explícito, con su estado a la vista si queda denegado.
  try {
    const estado = await Camera.checkPermissions()
    if (estado.camera !== 'granted') {
      const pedido = await Camera.requestPermissions({ permissions: ['camera'] })
      if (pedido.camera !== 'granted') {
        throw new Error(
          'el permiso de cámara quedó denegado: actívalo en Ajustes → Aplicaciones → Academia del Espíritu → Permisos → Cámara',
        )
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso de cámara quedó denegado')) throw e
    // Si la consulta de permisos no existe en esta plataforma, los
    // caminos de captura harán su propia petición: se continúa.
  }

  const fallos: string[] = []

  // (2) Camino nuevo del plugin v8: takePhoto (CameraX).
  try {
    const res = await Camera.takePhoto({ quality: 92, saveToGallery: false })
    let fuente: string | null = null
    if (res.uri) {
      const { Capacitor } = await import('@capacitor/core')
      fuente = Capacitor.convertFileSrc(res.uri)
    } else if (res.thumbnail) {
      fuente = res.thumbnail.startsWith('data:')
        ? res.thumbnail
        : `data:image/jpeg;base64,${res.thumbnail}`
    }
    if (!fuente) throw new Error('la cámara nueva no devolvió imagen')
    const texto = await leerQrDeDataUrl(fuente)
    if (!texto) throw new Error(SIN_QR)
    return texto
  } catch (e) {
    const d = detalleDe(e)
    if (/cancel/i.test(d)) throw new Error('__cancelado__')
    if (d === SIN_QR) throw new Error(SIN_QR)
    fallos.push(`cámara nueva: ${d}`)
  }

  // (3) Camino clásico: getPhoto (intención a la app de cámara).
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
    if (!foto.dataUrl) throw new Error('la cámara no devolvió ninguna foto')
    const texto = await leerQrDeDataUrl(foto.dataUrl)
    if (!texto) throw new Error(SIN_QR)
    return texto
  } catch (e) {
    const d = detalleDe(e)
    if (/cancel/i.test(d)) throw new Error('__cancelado__')
    if (d === SIN_QR) throw new Error(SIN_QR)
    fallos.push(`cámara clásica: ${d}`)
  }

  // (4) Ningún camino abrió: se muestra el motivo real de cada uno.
  throw new Error(`no se pudo abrir la cámara en este teléfono (${fallos.join(' · ')})`)
}
