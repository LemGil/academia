# Academia del Espíritu — app del estudiante v1.6.1

**El arreglo:** en la v1.6.0, el teléfono del maestro descartaba en
silencio todo lo que él mismo publicaba en el canal cuando la publicación
venía de fuera del teléfono (desde LemWriter): el código suponía que lo
suyo ya estaba guardado localmente al publicar, y eso solo es cierto de lo
compuesto en el propio teléfono. Resultado real (2026-11-09): la enseñanza
`lemgil-14` publicada desde LemWriter llegó a los estudiantes, pero no al
teléfono del maestro.

**Qué cambia:**
- `procesarDelCanal` ya no descarta las filas firmadas por el propio
  maestro: los avisos y paquetes de LemWriter entran también en su canal,
  y lo compuesto en el teléfono no se duplica (los paquetes se reconocen
  por su id `pkg_<academia>_<emitido>`; los avisos, por contenido).
- Al primer encendido tras actualizar, las filas del canal marcadas como
  procesadas por la v1.6.0 se reintentan una sola vez, para recuperar lo
  que haya quedado sin mostrar (reprocesar es seguro: todo se deduplica).

**Pruebas:** 40/40 en verde, con una prueba nueva que reproduce el caso
(aviso + paquete firmados por el maestro, directos al buzón, sin pasar
por su teléfono → le llegan y no se duplican).

**Instalar:** descomprimir sobre `~/Descargas/academia`, correr el
workflow «Construir APK Academia del Espíritu» e instalar la APK encima
en el teléfono del maestro (el del estudiante no la necesita, aunque no
estorba).
