// LemChat — firma un paquete de academia con la llave del maestro y,
// si hay buzón configurado, lo publica en el canal TEMAS APOSTÓLICOS.
//
// Uso:
//   node scripts/lemchat-firmar-paquete.mjs <paquete.json> <claves-maestro.json> [salida.lemchat.json]
//
// El paquete es el .json de siempre (el que genera LemWriter o el
// empaquetador). El sobre firmado (.lemchat.json) es lo que viaja por
// LemChat: la app del estudiante verifica la firma y, si es del
// maestro, archiva la enseñanza sola en la biblioteca.
//
// Publicación directa al buzón (opcional): si defines las variables
//   LEMCHAT_SUPABASE_URL y LEMCHAT_SUPABASE_ANON_KEY
// con los valores del proyecto Supabase, el sobre se publica además en
// el canal para que los estudiantes lo recojan por internet.

import * as ed from '@noble/ed25519'
import { sha512, sha256 } from '@noble/hashes/sha2'
import { readFileSync, writeFileSync } from 'node:fs'

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m))

const b64url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const deB64url = (texto) => Buffer.from(texto.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
const hex = (bytes) => Buffer.from(bytes).toString('hex')

const [rutaPaquete, rutaClaves, rutaSalidaArg] = process.argv.slice(2)
if (!rutaPaquete || !rutaClaves) {
  console.error('Uso: node scripts/lemchat-firmar-paquete.mjs <paquete.json> <claves-maestro.json> [salida]')
  process.exit(1)
}

const paqueteTexto = readFileSync(rutaPaquete, 'utf8')
const claves = JSON.parse(readFileSync(rutaClaves, 'utf8'))

let datos
try {
  datos = JSON.parse(paqueteTexto)
} catch {
  console.error('✋ El paquete no es un JSON válido.')
  process.exit(1)
}
const academia = datos && typeof datos === 'object' && 'academia' in datos ? datos.academia : datos
if (!academia || typeof academia.id !== 'string') {
  console.error('✋ El paquete no trae el id de la academia.')
  process.exit(1)
}

// Debe firmar EXACTAMENTE lo mismo que la app verifica
// (src/lemchat/entrega.ts: textoFirmadoPaquete).
const textoFirmado = `lemchat-paquete-v1|${academia.id}|${paqueteTexto}`
const privada = deB64url(claves.clavePrivada)
const publica = deB64url(claves.clavePublica)
const firma = ed.sign(new TextEncoder().encode(textoFirmado), privada)

const sobre = {
  tipo: 'paquete-lemchat',
  formato: 1,
  academiaId: academia.id,
  paqueteTexto,
  claveMaestro: claves.clavePublica,
  firma: b64url(firma),
  emitido: new Date().toISOString(),
}

// Autoverificación antes de entregar nada.
if (!ed.verify(firma, new TextEncoder().encode(textoFirmado), publica)) {
  console.error('✋ La firma no verifica ni aquí: algo va mal con las claves.')
  process.exit(1)
}

const rutaSalida = rutaSalidaArg || `${academia.id}.lemchat.json`
writeFileSync(rutaSalida, JSON.stringify(sobre, null, 1))
console.log(`✅ Sobre firmado: ${rutaSalida}`)
console.log(`   Academia: ${academia.id} · Firmante: ${claves.nombre}`)

const url = process.env.LEMCHAT_SUPABASE_URL
const anon = process.env.LEMCHAT_SUPABASE_ANON_KEY
if (url && anon) {
  const cuerpo = JSON.stringify(sobre)
  const huella = hex(sha256(new TextEncoder().encode(cuerpo)))
  const textoFila = `lemchat-buzon-v1|${claves.clavePublica}|canal|paquete|${huella}`
  const firmaFila = b64url(ed.sign(new TextEncoder().encode(textoFila), privada))
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/lc_mensajes`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      de: claves.clavePublica,
      para: 'canal',
      tipo: 'paquete',
      cuerpo,
      firma: firmaFila,
    }),
  })
  if (res.ok) {
    console.log('📣 Publicado en el canal del buzón: los estudiantes lo recogerán al conectarse.')
  } else {
    console.error(`⚠️ El buzón rechazó la publicación (${res.status}). El sobre firmado sí quedó en ${rutaSalida}.`)
  }
} else {
  console.log('ℹ️ Sin LEMCHAT_SUPABASE_URL/ANON_KEY: no se publicó al buzón.')
  console.log('   El sobre puede viajar por cercanía o enviarse como archivo.')
}
