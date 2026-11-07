// Cifrado extremo a extremo de los mensajes personales.
// De las llaves Ed25519 de identidad se derivan las X25519 de acuerdo
// (conversión estándar Edwards→Montgomery) y el texto viaja sellado con
// XSalsa20-Poly1305: ni el buzón de Supabase ni un relevo pueden leerlo.
// Sellado: base64url( nonce(24) || cifrado ).

import { edwardsToMontgomeryPriv, edwardsToMontgomeryPub, x25519 } from '@noble/curves/ed25519'
import { xsalsa20poly1305 } from '@noble/ciphers/salsa.js'
import { base64UrlABytes, bytesABase64Url, bytesATexto, textoABytes } from './util'

function claveCompartida(clavePrivadaB64: string, clavePublicaAjenaB64: string): Uint8Array {
  const privMont = edwardsToMontgomeryPriv(base64UrlABytes(clavePrivadaB64))
  const pubMont = edwardsToMontgomeryPub(base64UrlABytes(clavePublicaAjenaB64))
  return x25519.getSharedSecret(privMont, pubMont)
}

/** Sella un texto para un destinatario. Solo él (y yo) podemos abrirlo. */
export function sellar(clavePrivadaB64: string, clavePublicaDestinoB64: string, texto: string): string {
  const clave = claveCompartida(clavePrivadaB64, clavePublicaDestinoB64)
  const nonce = new Uint8Array(24)
  crypto.getRandomValues(nonce)
  // En @noble/ciphers el nonce se pasa al construir el cifrador.
  const cifrado = xsalsa20poly1305(clave, nonce).encrypt(textoABytes(texto))
  const junto = new Uint8Array(nonce.length + cifrado.length)
  junto.set(nonce)
  junto.set(cifrado, nonce.length)
  return bytesABase64Url(junto)
}

/** Abre un texto sellado. Si no es para mí o viene dañado: null. */
export function abrir(clavePrivadaB64: string, clavePublicaOrigenB64: string, sellado: string): string | null {
  try {
    const junto = base64UrlABytes(sellado)
    if (junto.length < 25) return null
    const nonce = junto.subarray(0, 24)
    const cifrado = junto.subarray(24)
    const clave = claveCompartida(clavePrivadaB64, clavePublicaOrigenB64)
    return bytesATexto(xsalsa20poly1305(clave, nonce).decrypt(cifrado))
  } catch {
    return null
  }
}
