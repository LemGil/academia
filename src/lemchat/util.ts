// Utilidades puras de LemChat: base64url, texto y ids.
// Sin dependencias del entorno (funcionan igual en la app, en Node y en las
// herramientas del maestro).

const codificador = new TextEncoder()
const decodificador = new TextDecoder()

export function textoABytes(texto: string): Uint8Array {
  return codificador.encode(texto)
}

export function bytesATexto(bytes: Uint8Array): string {
  return decodificador.decode(bytes)
}

export function bytesABase64Url(bytes: Uint8Array): string {
  let binario = ''
  const trozo = 0x8000
  for (let i = 0; i < bytes.length; i += trozo) {
    binario += String.fromCharCode(...bytes.subarray(i, i + trozo))
  }
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlABytes(texto: string): Uint8Array {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/')
  const conRelleno = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binario = atob(conRelleno)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

export function bytesAHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function idAleatorio(prefijo: string): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return `${prefijo}_${bytesAHex(bytes)}`
}

/** Minutos/horas legibles desde un timestamp: «ahora», «hace 5 min», «hace 2 h». */
export function haceCuanto(ts: number, ahoraTs: number): string {
  const seg = Math.max(0, Math.floor((ahoraTs - ts) / 1000))
  if (seg < 45) return 'ahora'
  const min = Math.floor(seg / 60)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}
