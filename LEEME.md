# Academia del Espíritu — App del estudiante 📚

La APK del alumno: lector de las enseñanzas + Biblia offline.
Todo el contenido vive **dentro de la app** (funciona sin internet).
El progreso se guarda **en el teléfono**; si un día hay internet, se podrá sincronizar con la nube.

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

## Cómo agregar temas nuevos (próximas versiones)

```bash
# 1. Actualiza los documentos .md de las academias (o agrega el nuevo)
# 2. Reempaqueta el contenido:
npm run contenido
# 3. Sube la versión en package.json (ej: 1.2.0 → 1.3.0)
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
