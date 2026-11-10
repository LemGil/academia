# Academia del Espíritu — v1.7.0 (Niveles, progreso por nivel y sello del encuentro)

Lo que LemGil aprobó el 2026-11-09, tal como lo decidió:

## Lo nuevo

- **El catálogo se organiza por NIVELES.** El paquete ahora puede traer
  su nivel (desde LemWriter, con los parches «el paquete nace con
  nivel»): la lista de Academias se agrupa por nivel y muestra el
  estado de cada uno. Los paquetes viejos sin nivel quedan en
  «Sin nivel asignado», siempre abiertos.
- **Desbloqueo en orden.** Un nivel se abre solo cuando TODAS las
  academias de los niveles anteriores presentes en el teléfono están
  concluidas. Las bloqueadas **se ven en gris** (se ve el camino, no se
  puede abrir) y **el avance no se quita**: un nivel desbloqueado jamás
  se vuelve a bloquear, aunque llegue una academia nueva a un nivel
  anterior.
- **Progreso local, por nivel, sin sincronizar con la web.** Cada código
  lleva ahora dos marcas: **Leído** y **Practicado** (en la lista de
  códigos y dentro del lector). La pantalla Progreso muestra, por nivel:
  concluidas/total, % leído y % practicado, y el estado del nivel.
- **Ninguna academia se concluye leyendo.** Al 100 % de leídos y
  practicados queda «Lista para el encuentro». La conclusión se sella
  en el **encuentro presencial con el Maestro**:
  - El maestro, desde CHAT → canal TEMAS APOSTÓLICOS → tarjeta
    «🎓 Sello del encuentro», elige la academia y genera un código
    (QR + texto) firmado con su llave. Uno nuevo en cada encuentro.
  - El alumno, en su academia (cuando está lista), toca «Concluir con
    el Maestro», escanea el QR o pega el código: la app verifica la
    firma de su maestro, que el sello sea de esa academia y que esté al
    100 %; entonces la academia queda **Concluida** con la fecha del
    encuentro, y eso es lo que desbloquea el siguiente nivel.

## Pruebas

- 53/53 en verde (13 nuevas: lógica de niveles — agrupación, cadena de
  desbloqueo, avance que no se quita, estados —, el sello — válido,
  impostor, manipulado, sin maestro — y el nivel viajando en el
  paquete). Build de producción limpio.

## Para cerrar el círculo

Los teléfonos ya pueden recibir la v1.7.0, pero las academias actuales
(el paquete lemgil-14) **no traen nivel todavía**: aplica en LemWriter
los parches «el paquete nace con nivel» (móvil y/o PC) y **republica**
la academia con la casilla de MensajeAcademia marcada, eligiendo su
nivel en el diálogo como siempre. Al llegar el paquete actualizado, la
Academia 14 aparecerá bajo su nivel en todos los teléfonos, con el
progreso de los alumnos intacto (las marcas se guardan por código).

## Instalación

Como siempre: descomprimir encima del repo en `~/Descargas/academia`,
commit, push y correr el workflow «Construir APK Academia del Espíritu».
Esta versión conviene en **todos** los teléfonos (maestro y alumnos):
el sello y los niveles viven en esta versión.
