#!/usr/bin/env python3
# Genera los PAQUETES IMPORTABLES de las academias y el bundle de la app.
# Lee los documentos markdown de las academias y escribe un .json por
# academia en paquetes/ (paquetes/a1.json, ...): el estudiante recibe el
# archivo por WhatsApp/Bluetooth/USB y lo importa dentro de la app.
#
# Desde la v1.4 la app se instala VACÍA: src/contenido/academias.json se
# escribe SIN academias a propósito. El contenido ya no viaja dentro de
# la APK; viaja en los paquetes.
#
# Uso:  python3 scripts/empaquetar-contenido.py --paquetes
#       (npm run contenido escribe solo el bundle vacío)
#
# Dónde busca los .md (en orden):
#   1. Carpeta "contenido-fuente/" en la raíz del repo, con esta estructura:
#        contenido-fuente/a1.md, a2.md, ... a13.md, camino-fe.md
#   2. Rutas de la máquina de Leo (cuando él regenera los paquetes).
#
# En GitHub no hay fuentes: no se escribe ningún paquete y el bundle
# vacío es el esperado (el workflow nunca falla por esto).

import json
import os
import re
import sys
from datetime import date
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
FUENTE_REPO = BASE / "contenido-fuente"
YOUR_FILES = Path(os.environ.get("ACADEMIA_YOUR_FILES", "/home/hatch/workspace/your_files"))
GOALS = Path(os.environ.get("ACADEMIA_GOALS", "/home/hatch/workspace/goals"))

# (id, número, título, archivo en contenido-fuente/, ruta alternativa en máquina de Leo)
ACADEMIAS = [
    ("a1", "Nº 1", "Descodificando la Luz", "a1.md",
     YOUR_FILES / "academia-espiritu-a1/Academia del Espíritu — Códigos A_1.md"),
    ("a2", "Nº 2", "Descodificando el Plan Eterno", "a2.md",
     YOUR_FILES / "academia-espiritu-a2/Academia del Espíritu — Códigos A_2.md"),
    ("a3", "Nº 3", "Descodificando la Creación", "a3.md",
     YOUR_FILES / "academia-espiritu-a3/Academia del Espíritu — Códigos A_3.md"),
    ("a4", "Nº 4", "Descodificando el Conocer", "a4.md",
     YOUR_FILES / "academia-espiritu-a4/Academia del Espíritu — Códigos A_4.md"),
    ("a5", "Nº 5", "Descodificando la Eternidad", "a5.md",
     YOUR_FILES / "academia-espiritu-a5/Academia del Espíritu — Códigos A_5.md"),
    ("a6", "Nº 6", "Descodificando la Nueva Creación", "a6.md",
     YOUR_FILES / "academia-espiritu-a6/Academia del Espíritu — Códigos A_6.md"),
    ("a7", "Nº 7", "Descodificando la Fe", "a7.md",
     YOUR_FILES / "academia-espiritu-a7/Academia del Espíritu — Códigos A_7.md"),
    ("a8", "Nº 8", "Descodificando la Palabra", "a8.md",
     YOUR_FILES / "academia-espiritu-a8/Academia del Espíritu — Códigos A_8.md"),
    ("a9", "Nº 9", "Descodificando la Plenitud", "a9.md",
     YOUR_FILES / "academia-espiritu-a9/Academia del Espíritu — Códigos A_9.md"),
    ("a10", "Nº 10", "Descodificando el Vivir en Cristo", "a10.md",
     YOUR_FILES / "academia-espiritu-a10/Academia del Espíritu — Códigos A_10.md"),
    ("a11", "Nº 11", "Descodificando el Nuevo Retoño", "a11.md",
     YOUR_FILES / "academia-espiritu-a11/Academia del Espíritu — Códigos A_11.md"),
    ("a12", "Nº 12", "Descodificando la Salvación", "a12.md",
     YOUR_FILES / "descodificando-la-salvacion/Academia del Espíritu — Códigos A_12.md"),
    ("a13", "Nº 13", "Descodificando el Reposo", "a13.md",
     YOUR_FILES / "academia-espiritu-reposo/Academia del Espíritu — Códigos Reposo.md"),
    ("camino-fe", "Serie", "Descodificando el camino de la Fe", "camino-fe.md",
     GOALS / "studies-for-the-future-academy-descodificando-la-fe/files/descodificando-la-fe/academia/Academia del Espíritu — Descodificando el camino de la Fe.md"),
]


def resolver_fuente(nombre_repo: str, alternativa: Path) -> Path | None:
    candidato = FUENTE_REPO / nombre_repo
    if candidato.exists():
        return candidato
    if alternativa.exists():
        return alternativa
    return None


def limpiar(texto: str) -> str:
    # Quita el bloque <style> del inicio (es para PDF, no para la app)
    texto = re.sub(r"<style>.*?</style>", "", texto, flags=re.DOTALL)
    lineas = []
    for ln in texto.splitlines():
        s = ln.strip()
        # Quita imágenes, saltos de página y separadores del documento impreso
        if s.startswith("!["):
            continue
        if s.startswith("<div"):
            continue
        lineas.append(ln)
    texto = "\n".join(lineas)
    # Colapsa separadores y líneas vacías múltiples
    texto = re.sub(r"\n---\n", "\n", texto)
    texto = re.sub(r"\n{3,}", "\n\n", texto)
    return texto.strip()


def parsear_academia(aid: str, numero: str, titulo: str, ruta: Path) -> dict:
    texto = limpiar(ruta.read_text(encoding="utf-8"))

    # Divide por encabezados de código
    partes = re.split(r"^## 🔓 CÓDIGO:\s*", texto, flags=re.MULTILINE)
    codigos = []
    for i, parte in enumerate(partes[1:], start=1):
        lineas = parte.splitlines()
        titulo_codigo = lineas[0].strip().rstrip(".")
        cuerpo = "\n".join(lineas[1:])
        # Subtítulo si existe
        subtitulo = ""
        m = re.search(r"^### 🔓 SUBTÍTULO:\s*(.+)$", cuerpo, flags=re.MULTILINE)
        if m:
            subtitulo = m.group(1).strip()
            cuerpo = cuerpo.replace(m.group(0), "")
        # El cierre va aparte
        cuerpo = re.split(r"^## CIERRE.*$", cuerpo, flags=re.MULTILINE)[0]
        cuerpo = limpiar(cuerpo)
        codigos.append({
            "id": f"{aid}-c{i}",
            "titulo": titulo_codigo,
            "subtitulo": subtitulo,
            "cuerpo": cuerpo,
        })

    # Cierre de la enseñanza (si existe)
    cierre = ""
    m = re.search(r"^## CIERRE.*$", texto, flags=re.MULTILINE)
    if m:
        cierre = limpiar(texto[m.start():])
        cierre = re.sub(r"^## CIERRE.*$", "", cierre, flags=re.MULTILINE).strip()

    print(f"  {numero} {titulo}: {len(codigos)} códigos")
    return {
        "id": aid,
        "numero": numero,
        "titulo": titulo,
        "codigos": codigos,
        "cierre": cierre,
    }


def main():
    print("Empaquetando enseñanzas...")
    destino = BASE / "src/contenido/academias.json"

    # Desde la v1.4 la app se instala VACÍA: el bundle ya no lleva ninguna
    # academia dentro. El contenido llega solo por paquetes importables
    # (los genera este mismo script con --paquetes, o LemWriter).
    paquete_app = {
        "version": "1.4.0",
        "generada": date.today().isoformat(),
        "nota": "La app se instala sin academias: el contenido llega por paquetes importables.",
        "academias": [],
    }
    destino.write_text(json.dumps(paquete_app, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK: bundle de la app vacío (0 academias incluidas) -> {destino}")

    if "--paquetes" not in sys.argv:
        return

    academias = []
    for aid, numero, titulo, nombre_repo, alternativa in ACADEMIAS:
        ruta = resolver_fuente(nombre_repo, alternativa)
        if not ruta:
            print(f"  AVISO: no se encontró fuente para {numero} {titulo}, se omite")
            continue
        academias.append(parsear_academia(aid, numero, titulo, ruta))

    if not academias:
        print("No se encontró ninguna fuente: no se escriben paquetes.")
        return

    carpeta = BASE / "paquetes"
    carpeta.mkdir(exist_ok=True)
    for a in academias:
        envoltura = {
            "tipo": "paquete-academia",
            "formato": 1,
            "generada": date.today().isoformat(),
            "academia": a,
        }
        ruta = carpeta / f"{a['id']}.json"
        ruta.write_text(json.dumps(envoltura, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  paquete: {ruta.name} ({ruta.stat().st_size // 1024} KB)")
    print(f"OK: {len(academias)} paquetes importables en {carpeta}")


if __name__ == "__main__":
    main()
