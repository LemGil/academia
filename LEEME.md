# Academia del Espíritu — App del estudiante 📚

La APK del alumno: lector de las enseñanzas + Biblia offline.
Todo el contenido vive **dentro de la app** (funciona sin internet).
El progreso se guarda **en el teléfono**; si un día hay internet, se podrá sincronizar con la nube.

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
  Si el paquete es de una academia que ya trae la app, la **actualiza**
  (el progreso del estudiante se conserva); si es nueva, se agrega a la
  lista. Las importadas se marcan con 📥 y se pueden quitar (al quitar
  una actualización, vuelve la versión incluida).

**Lo que trae la v1.2:**
- 14 academias · 84 códigos (Nº 1–13 + «Descodificando el camino de la Fe»)
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

## Actualización a la v1.3.2 (esta entrega, en tu PC)

Tu clon local quedó atrás de GitHub (los arreglos de Node 22 y Java 21 se
hicieron en la web), así que **primero `git pull`** y después el parche:

```bash
cd ~/Descargas/academia
git pull
unzip -o ~/Descargas/academia-estudiante-v1.3.2.zip
git add .
git commit -m "Academia del Espíritu v1.3.2 — paquetes importables, correcciones del lector y atajo desde Progreso"
git push
```

Luego: GitHub → Actions → "Construir APK Academia del Espíritu" →
Run workflow. Al terminar en verde, descarga el artefacto
**Academia-Espiritu-APK-<número>** (el más alto), descomprime e instala
`app-debug.apk` encima de la anterior (no pierdes progreso).

Para probar la importación: pásate al teléfono el archivo
`paquetes/a7.json` (viene en el repo tras este parche), abre la app →
Academias → «📥 Importar paquete de academia» → elige el archivo.
Debe decir «Academia actualizada» (la Nº 7 ya viene incluida; el paquete
la reemplaza y tus marcas de leído se conservan).

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

**Camino rápido — por paquete (sin recompilar, desde la v1.3):**

```bash
# 1. El .md aprobado de la academia queda en su carpeta de siempre
# 2. Leo regenera el paquete (o corre esto en su máquina):
python3 scripts/empaquetar-contenido.py --paquetes   # deja paquetes/<id>.json
# 3. Ese .json se envía al estudiante por WhatsApp/Bluetooth/USB
#    y él lo importa en Academias → «📥 Importar paquete de academia»
```

Sirve igual para una academia **nueva** y para **actualizar** una
existente (mismo id → reemplaza el contenido y conserva el progreso;
ojo: las marcas siguen la posición del código, así que no reordenes
los códigos en una actualización).

**Camino completo — dentro de la APK (nueva versión):**

```bash
# 1. Actualiza los documentos .md de las academias (o agrega el nuevo)
# 2. Reempaqueta el contenido:
npm run contenido
# 3. Sube la versión en package.json (ej: 1.3.0 → 1.4.0)
#    y también versionName/versionCode en android/app/build.gradle
# 4. Commit + push + corre el workflow de nuevo
```

El script `scripts/empaquetar-contenido.py` lee los `.md` y genera
`src/contenido/academias.json`, que es lo que viaja dentro de la APK.
Busca los `.md` en la carpeta `contenido-fuente/` del repo
(archivos `a1.md` … `a13.md`, `camino-fe.md`); si no la encuentra,
usa las rutas de la máquina de Leo. Si no hay fuentes, no toca el JSON
y el workflow sigue sin fallar.

## Notas técnicas

- App React + Vite + Capacitor (igual que LemWriter Local).
- `appId`: `com.lemgil.academia` — convive con LemWriter en el mismo teléfono.
- La Biblia se carga por libros bajo demanda (igual que en LemWriter).
- Sin login en v1: el progreso es local. La sincronización con la nube
  (Supabase) queda preparada como siguiente paso cuando la pidas.
