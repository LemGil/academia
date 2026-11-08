// LemChat — genera el par de llaves Ed25519 del MAESTRO (una sola vez).
//
// Uso (en la PC del maestro):
//   node scripts/lemchat-claves-maestro.mjs "LemGil Apóstol" [ruta-del-archivo]
//
// Crea un archivo JSON con la llave PÚBLICA (la que verifica) y la
// PRIVADA (la que firma). La privada es la identidad del maestro en
// LemChat: quien la tenga puede publicar enseñanzas «suyas». Guárdala
// FUERA del repo y hazle copia segura; si se pierde, hay que generar
// otra y los estudiantes deben agregar el nuevo código del maestro.
//
// El script se niega a sobrescribir un archivo de claves existente.

import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2'
import { existsSync, writeFileSync } from 'node:fs'

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m))

const b64url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const nombre = process.argv[2] || 'LemGil Apóstol'
const ruta = process.argv[3] || 'claves-maestro-lemchat.json'

if (existsSync(ruta)) {
  console.error(`✋ Ya existe ${ruta}. No lo sobrescribo: esas claves ya son una identidad.`)
  console.error('   Si de verdad quieres unas nuevas, borra o renombra ese archivo primero.')
  process.exit(1)
}

const privada = ed.utils.randomPrivateKey()
const publica = ed.getPublicKey(privada)

const claves = {
  nombre,
  clavePublica: b64url(publica),
  clavePrivada: b64url(privada),
  creada: new Date().toISOString(),
}
writeFileSync(ruta, JSON.stringify(claves, null, 2), { mode: 0o600 })

const codigoContacto =
  'lemchat1:' + b64url(Buffer.from(JSON.stringify({ nombre, clavePublica: claves.clavePublica, esMaestro: true }), 'utf8'))

console.log('✅ Llaves del maestro creadas.')
console.log('')
console.log(`Archivo (GUÁRDALO COMO ORO, fuera del repo): ${ruta}`)
console.log('')
console.log('Llave pública del maestro:')
console.log(`  ${claves.clavePublica}`)
console.log('')
console.log('Código de contacto del maestro (para el QR que escanean los estudiantes):')
console.log(`  ${codigoContacto}`)
console.log('')
console.log('Opcional: para fijar la llave dentro de la APK, pégala en')
console.log('src/lemchat/configSupabase.ts como CLAVE_MAESTRO_FIJADA antes de compilar.')
