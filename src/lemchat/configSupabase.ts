// Configuración del buzón de LemChat (vía internet).
//
// Es el MISMO proyecto Supabase que ya comparten LemWriter y la Academia
// web (el de las tablas lw_* y los cursos). LemGil pega aquí los dos
// valores del proyecto — los mismos de su despliegue web:
//   Project Settings → API → Project URL  y  anon public key.
// La anon key es pública por diseño (la seguridad la ponen las políticas
// RLS del SQL y, sobre todo, el cifrado y las firmas de LemChat).
//
// Sin estos valores, CHAT funciona igual sin internet (cercanía y cola
// local) y la vía de internet se muestra como «sin configurar» — nunca
// como un error que tumbe la app.

export const SUPABASE_URL = ''
export const SUPABASE_ANON_KEY = ''

/** Llave pública del maestro fijada en la app (opcional).
 *  Si se deja vacía, la app confía en el contacto «maestro» que el
 *  estudiante agregue con el QR del maestro en persona — que es el
 *  camino normal. Fijarla aquí sirve para distribuir la APK con la
 *  llave ya dentro, imposible de suplantar por un QR falso. */
export const CLAVE_MAESTRO_FIJADA = ''
