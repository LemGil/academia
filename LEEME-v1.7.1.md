# Academia del Espíritu — v1.7.1 (Biblia: versión sin salir y leído único)

Dos mejoras que pidió LemGil el 2026-11-12, sobre la Biblia de la app:

## 1. Cambiar de versión sin salir de la lectura

- Las píldoras de versión (RV1909 · VBL · RVG · BLT) ahora están en las
  **tres** pantallas: libros, capítulos y **dentro del capítulo**.
- Al tocar otra versión, el capítulo que estás leyendo **se recarga en
  esa versión, en el mismo lugar**: ya no hay que salir a Libros ni el
  cambio te devuelve a la lista (antes `cambiarVersion` reseteaba la
  vista a libros).

## 2. Leído es leído, en cualquier versión

- La marca de capítulo leído deja de llevar la versión: ahora es
  «libro:capítulo». Génesis 1 leído en RV1909 sale leído también en
  BLT, VBL y RVG — y desmarcarlo lo desmarca en todas.
- **Migración automática**: las marcas viejas («versión:libro:cap») se
  convierten solas la primera vez que la app lee el progreso, y el
  almacén queda guardado ya convertido. Nadie pierde lo leído; si un
  capítulo estaba marcado en dos versiones, cuenta una sola vez.
- Los planes de lectura usan la misma marca unificada (su comprobación
  ya aceptaba «leído en alguna versión»; ahora lee la clave nueva).

## Pruebas

- 58/58 en verde (5 nuevas: clave sin versión, normalización de claves
  viejas, conversión al cargar con deduplicación, marcar/desmarcar
  único y reconocimiento desde los planes). Build de producción limpio.

## Instalación

Como siempre: descomprimir encima del repo en `~/Descargas/academia`,
commit, push (el workflow corre solo) e instalar la APK encima en los
teléfonos. El progreso de lectura de cada teléfono se convierte solo al
abrir la app actualizada; no hay que hacer nada a mano.
