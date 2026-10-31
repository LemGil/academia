# Academia del Espíritu — App del estudiante 📚

La APK del alumno: Biblia offline + lector de las enseñanzas.
La Biblia vive **dentro de la app**; las enseñanzas llegan como
**paquetes** que el estudiante importa (todo funciona sin internet).
El progreso se guarda **en el teléfono**; si un día hay internet, se podrá sincronizar con la nube.

**Lo que trae la v1.4:**
- 🚫📦 **La app se instala VACÍA, sin ninguna academia.** El estudiante
  importa las que desee o las que su maestro le asigne, y puede
  borrarlas cuando quiera. La lista se **ordena por el número** de cada
  academia (el orden que el maestro decidió: el 2 va antes que el 10).
- El paquete puede traer el **autor** (maestro/ministerio): se muestra
  junto a la academia, y el identificador (autor + número) evita que
  academias de pastores distintos se pisen en un mismo teléfono.

**Firma fija v1.3.3:**
- La APK ahora se firma siempre con la misma clave (la tuya, en los
  secretos del repo): las próximas versiones se instalan **encima** de
  la anterior, sin desinstalar y sin perder el progreso. Ver la
  sección «Firma fija» — hay que crear la llave una sola vez.

**Mejora v1.3.2:**
- En la pantalla Progreso, cada academia de la lista ahora se puede
  tocar para abrirla directamente (con su «›» y la nota «Toca una
  academia para abrirla directamente»).

**Correcciones v1.3.1:**
- Al pasar al capítulo siguiente (o anterior), la lectura sube sola al
  inicio — verso 1 — en vez de quedarse donde estaba el scroll. Vale
  también al saltar entre códigos de una academia.
- La pestaña seleccionada del menú inferior ahora se nota de un vistazo:
  fondo dorado tenue, franja dorada arriba y texto en negrita.

**Lo que trae la v1.3 (nuevo):**
- 📥 **Paquetes de enseñanzas importables**: el estudiante puede importar
  una academia suelta desde un archivo (.json) recibido por WhatsApp,
  Bluetooth o USB — sin internet y **sin recompilar la APK**.
  Si el paquete es de una academia que ya tiene, la **actualiza**
  (el progreso del estudiante se conserva); si es nueva, se agrega a la
  lista. Las importadas se pueden quitar desde su pantalla.

**Lo que trae la v1.2:**
- Biblia offline: RV1909, VBL y RVG (como LemWriter Local)
- 📅 **Planes de lectura**: el discípulo elige al iniciar —
  *La Biblia en un año* (canónico), *El Nuevo Testamento en un año*,
  *Antiguo y Nuevo cada día* (paralelo) y *La Biblia en 90 días* (intensivo).
  La lectura del día avanza sola con el calendario, los días se marcan
  completados al leer, y se puede cambiar de plan sin perder lo leído.
- Lector con temas Noche/Día/Sepia y tamaño de letra A−/A+
- Marcar códigos y capítulos como leídos + pantalla de progreso
- Icono y colores oficiales de la Academia

**Lo que NO trae (a propósito):** nada de escribir ni publicar — eso sigue siendo LemWriter (la web queda para el maestro).

---

## Firma fija (una sola vez — necesario desde la v1.3.3)

**Para qué:** hasta la v1.3.2 cada APK salía firmada con una clave
temporal distinta (GitHub genera una nueva en cada corrida) y Android
no dejaba instalarla encima de la anterior: tocaba desinstalar, y en
esta app el progreso vive **dentro** de la app, así que se perdía.
Con una clave fija tuya, guardada como secreto del repositorio, todas
las APK futuras se firman igual y se instalan encima sin desinstalar.
Es el mismo remedio que ya usa LemWriter Local.

### Paso 1 — Crear tu clave (en tu PC, terminal)

```bash
keytool -genkeypair -v -keystore ~/academia.keystore -alias academia -keyalg RSA -keysize 2048 -validity 10000
```

Te pide una contraseña (una que no olvides; la pide dos veces) y unos
datos (puedes dar Enter a casi todo; lo importante es la contraseña).
Al final vuelve a pedir la contraseña de la clave: pulsa Enter para
usar la misma.

**Guarda como oro:** el archivo `~/academia.keystore` (hazle copia en
un lugar seguro, **fuera** de la carpeta del repo) y la contraseña.
Sin ellos no podrás firmar actualizaciones futuras.

### Paso 2 — Convertir la clave a texto (en tu PC)

```bash
base64 -w 0 ~/academia.keystore > ~/academia-keystore-b64.txt
```

### Paso 3 — Crear los 4 secretos en GitHub

En **github.com/LemGil/academia → Settings → Secrets and variables →
Actions → New repository secret**, crea estos cuatro:

| Nombre | Valor |
|---|---|
| `ANDROID_KEYSTORE` | todo el contenido de `~/academia-keystore-b64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | la contraseña del paso 1 |
| `ANDROID_KEY_ALIAS` | `academia` |
| `ANDROID_KEY_PASSWORD` | la misma contraseña del paso 1 |

**Ojo:** si corres el flujo sin crear los secretos, la corrida falla
a propósito con «Falta el secreto ANDROID_KEYSTORE» (para no entregar
otra APK con firma temporal sin darte cuenta).

### La primera instalación con firma nueva

La APK firmada se llama **`app-firmada.apk`** (es la única que trae el
artefacto). Como la firma cambia respecto a la temporal anterior,
**esta vez toca desinstalar la app vieja una última vez** e instalar
la nueva — el progreso guardado en ese teléfono se pierde esta única
vez (lo mismo le pasará a cualquier estudiante que ya tenga la v1.2).
De ahí en adelante, todas las versiones se instalan encima y el
progreso se conserva siempre.

---

## Actualización a la v1.4.0 (esta entrega, en tu PC)

Tu clon local quedó atrás de GitHub (los arreglos de Node 22 y Java 21 se
hicieron en la web), así que **primero `git pull`** y después el parche:

```bash
cd ~/Descargas/academia
git pull
unzip -o ~/Descargas/academia-estudiante-v1.4.0.zip
git add .
git commit -m "Academia del Espíritu v1.4.0 — la app se instala vacía, orden por número y autor"
git push
```

(Antes de esto, crea la llave y los 4 secretos de la sección
«Firma fija» si aún no lo has hecho.)

Luego: GitHub → Actions → "Construir APK Academia del Espíritu" →
Run workflow. Al terminar en verde, descarga el artefacto
**Academia-Espiritu-APK-<número>** (el más alto): dentro va solo
**`app-firmada.apk`**. Si aún no has instalado ninguna APK con la
firma fija, esta vez toca desinstalar la vieja una última vez (ver
«Firma fija»); si ya traes una firmada, se instala encima.

Para probar la importación: pásate al teléfono el paquete de prueba
de la Nº 7 que te pasó Leo (`paquete-a7.json`, trae el autor «LemGil
Apóstol»), abre la app → Academias (saldrá vacía, con el aviso «📭
Todavía no tienes academias») → «📥 Importar paquete de academia» →
elige el archivo. Debe decir «Academia importada» y la Nº 7 aparecerá
en la lista, con su autor. Desde su pantalla puedes borrarla con
«🗑 Eliminar academia».

---

## Cómo publicarla (en tu PC)

```bash
cd ~/Descargas
unzip ~/Descargas/academia-estudiante-v1.zip   # (o donde lo hayas guardado)
cd academia-estudiante

# 1. Crea el repositorio en GitHub (nombre sugerido: academia-estudiante)
#    https://github.com/new  →  LemGil/academia-estudiante  →  Create repository
#    (Si prefieres reutilizar el repo viejo LemGil/academia —la versión web
#    de matrícula que ya no siguen—, clónalo en vez de crear uno nuevo,
#    quita los archivos viejos y sigue desde el paso 2:
#      git clone https://github.com/LemGil/academia.git
#      cd academia && git rm -q index.html logo.png logo2.png README.md .gitignore
#      cp -a ~/Descargas/academia-estudiante/. .
#    Nota: si ese repo tenía GitHub Pages activo, la página vieja dejará de
#    funcionar; se desactiva en Settings → Pages.)

# 2. Súbelo
git init
git add .
git commit -m "Academia del Espíritu v1.0.0 — app del estudiante"
git branch -M main
git remote add origin https://github.com/LemGil/academia-estudiante.git
git push -u origin main

# 3. Compila la APK: en GitHub → pestaña Actions →
#    "Construir APK Academia del Espíritu" → Run workflow → Run workflow

# 4. Descarga: al terminar la corrida (en verde), abre la corrida →
#    Artifacts → "Academia-Espiritu-APK-<número>" (el número distingue
#    cada versión: instala siempre la del número más alto).

# 5. Instala en el teléfono o pásala por Bluetooth/archivo: el material
#    ya viene dentro, no hay que descargar nada más.
```

## Cómo agregar temas nuevos

Desde la v1.4 **todo** el contenido llega por paquete — ya nada se
mete dentro de la APK:

```bash
# 1. La academia nace como proyecto en LemWriter (su identificador
#    manual, autor + número, viaja dentro del paquete), o Leo genera
#    el paquete desde el .md aprobado como respaldo:
python3 scripts/empaquetar-contenido.py --paquetes   # deja paquetes/<id>.json
# 2. Ese .json se envía al estudiante por WhatsApp/Bluetooth/USB
#    y él lo importa en Academias → «📥 Importar paquete de academia»
```

Sirve igual para una academia **nueva** y para **actualizar** una
existente (mismo id → reemplaza el contenido y conserva el progreso;
ojo: las marcas siguen la posición del código, así que no reordenes
los códigos en una actualización).

El script `scripts/empaquetar-contenido.py` busca los `.md` en la
carpeta `contenido-fuente/` del repo (archivos `a1.md` … `a13.md`,
`camino-fe.md`) o en las rutas de la máquina de Leo, y escribe el
bundle de la app (`src/contenido/academias.json`) **vacío a propósito**:
la app se instala sin academias. En GitHub no hay fuentes y el
workflow sigue sin fallar.

## Notas técnicas

- App React + Vite + Capacitor (igual que LemWriter Local).
- `appId`: `com.lemgil.academia` — convive con LemWriter en el mismo teléfono.
- La Biblia se carga por libros bajo demanda (igual que en LemWriter).
- Sin login en v1: el progreso es local. La sincronización con la nube
  (Supabase) queda preparada como siguiente paso cuando la pidas.
