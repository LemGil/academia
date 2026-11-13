# Academia del Espíritu — v1.7.2 (los cuatro detalles de LemGil, 2026-11-13)

## 1. Canal TEMAS APOSTÓLICOS: lo nuevo primero y resaltado

- La lista del canal se muestra **del más nuevo al más viejo**.
- Los mensajes no leídos salen **resaltados** (fondo dorado suave y
  marca «● Nuevo»). Se marcan leídos **al salir del canal**, no al
  entrar: el resaltado dura mientras se está dentro.

## 2. Cercanía solo sin internet (prioridad de vías)

- Nueva política: si el buzón por internet responde, la cercanía
  Wi-Fi/Bluetooth **queda apagada** (era lo que gastaba recursos y
  provocaba el aviso de Android: escaneaba sin parar, incluso fuera
  del CHAT, porque nunca se detenía). Se enciende sola cuando
  internet no responde y se apaga cuando vuelve.
- Al salir de la pestaña CHAT, la cercanía **se detiene de verdad**.
- En Ajustes, el modo se puede fijar: **Automática** (solo sin
  internet, la nueva de siempre), Siempre activa o Apagada. El estado
  de las vías muestra «en pausa (hay internet)» cuando aplica.
- Los oyentes del plugin se registran una sola vez: encender y apagar
  seguido ya no los duplica.

## 3. Biblia para pantallas pequeñas

- **Pestañas AT | NT** una al lado de la otra al abrir la Biblia (el
  título completo se acorta solo a AT/NT en pantallas estrechas) y la
  app recuerda la última pestaña usada.
- **Libros por color**: leyéndose en dorado, terminado en verde con ✓.
- En la lectura, los temas (Noche/Día/Sepia) y las **versiones comparten
  una sola línea** fija; si no cabe, desliza de lado, nunca se parte.
- El pie del lector va en **una línea**: Anterior · ✓ Leído · Siguiente
  (también en las Academias, con su Practicado).

## 4. Academias y Progreso con colores por estado

- Cada tarjeta se pinta según su estado: **en curso** dorado, **lista
  para el encuentro** ámbar, **concluida** verde con medallón 🎓 y la
  fecha del encuentro; bloqueada en gris, como estaba.
- **Doble barra** en cada tarjeta y en Progreso: celeste lo leído,
  dorada lo practicado.
- Cada nivel trae su **termómetro**: un segmento por academia con el
  color de su estado.
- Progreso abre con el resumen general por estados (concluidas ·
  listas para el encuentro · en curso · bloqueadas), con los mismos
  colores del catálogo.

## Pruebas

- 63/63 en verde (5 nuevas de la política de cercanía). Build limpio.

## Instalación

Sobre la carpeta que ya trae la v1.7.1 aplicada: descomprimir encima,
commit y push (si el push de la v1.7.1 aún está pendiente, este commit
puede llevar los dos cambios juntos). El workflow corre solo con el
push; instalar la APK encima en los teléfonos.
