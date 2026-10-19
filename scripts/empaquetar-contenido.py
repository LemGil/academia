#!/usr/bin/env python3
# Empaqueta las enseñanzas de la Academia dentro de la APK del estudiante.
# Lee los documentos markdown de las academias y genera
# src/contenido/academias.json (texto incluido en la app, funciona sin internet).
#
# Uso:  npm run contenido
#       (o: python3 scripts/empaquetar-contenido.py)
# Cuando haya temas nuevos: actualizar los .md y correr de nuevo, luego
# subir version en package.json y compilar la APK.

import json
import re
from datetime import date
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
YOUR_FILES = Path("/home/hatch/workspace/your_files")
GOALS = Path("/home/hatch/workspace/goals")

ACADEMIAS = [
    ("a1", "Nº 1", "Descodificando la Luz",
     YOUR_FILES / "academia-espiritu-a1/Academia del Espíritu — Códigos A_1.md"),
    ("a2", "Nº 2", "Descodificando el Plan Eterno",
     YOUR_FILES / "academia-espiritu-a2/Academia del Espíritu — Códigos A_2.md"),
    ("a3", "Nº 3", "Descodificando la Creación",
     YOUR_FILES / "academia-espiritu-a3/Academia del Espíritu — Códigos A_3.md"),
    ("a4", "Nº 4", "Descodificando el Conocer",
     YOUR_FILES / "academia-espiritu-a4/Academia del Espíritu — Códigos A_4.md"),
    ("a5", "Nº 5", "Descodificando la Eternidad",
     YOUR_FILES / "academia-espiritu-a5/Academia del Espíritu — Códigos A_5.md"),
    ("a6", "Nº 6", "Descodificando la Nueva Creación",
     YOUR_FILES / "academia-espiritu-a6/Academia del Espíritu — Códigos A_6.md"),
    ("a7", "Nº 7", "Descodificando la Fe",
     YOUR_FILES / "academia-espiritu-a7/Academia del Espíritu — Códigos A_7.md"),
    ("a8", "Nº 8", "Descodificando la Palabra",
     YOUR_FILES / "academia-espiritu-a8/Academia del Espíritu — Códigos A_8.md"),
    ("a9", "Nº 9", "Descodificando la Plenitud",
     YOUR_FILES / "academia-espiritu-a9/Academia del Espíritu — Códigos A_9.md"),
    ("a10", "Nº 10", "Descodificando el Vivir en Cristo",
     YOUR_FILES / "academia-espiritu-a10/Academia del Espíritu — Códigos A_10.md"),
    ("a11", "Nº 11", "Descodificando el Nuevo Retoño",
     YOUR_FILES / "academia-espiritu-a11/Academia del Espíritu — Códigos A_11.md"),
    ("a12", "Nº 12", "Descodificando la Salvación",
     YOUR_FILES / "descodificando-la-salvacion/Academia del Espíritu — Códigos A_12.md"),
    ("a13", "Nº 13", "Descodificando el Reposo",
     YOUR_FILES / "academia-espiritu-reposo/Academia del Espíritu — Códigos Reposo.md"),
    ("camino-fe", "Serie", "Descodificando el camino de la Fe",
     GOALS / "studies-for-the-future-academy-descodificando-la-fe/files/descodificando-la-fe/academia/Academia del Espíritu — Descodificando el camino de la Fe.md"),
]


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
    if not ruta.exists():
        print(f"  AVISO: no existe {ruta}, se omite")
        return None
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
    academias = []
    for aid, numero, titulo, ruta in ACADEMIAS:
        a = parsear_academia(aid, numero, titulo, ruta)
        if a:
            academias.append(a)

    total_codigos = sum(len(a["codigos"]) for a in academias)
    paquete = {
        "version": "1.0.0",
        "generada": date.today().isoformat(),
        "nota": "Enseñanzas incluidas en la APK. Funciona sin internet.",
        "academias": academias,
    }
    destino = BASE / "src/contenido/academias.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(paquete, ensure_ascii=False, indent=1), encoding="utf-8")
    kb = destino.stat().st_size // 1024
    print(f"OK: {len(academias)} academias, {total_codigos} códigos -> {destino} ({kb} KB)")


if __name__ == "__main__":
    main()
