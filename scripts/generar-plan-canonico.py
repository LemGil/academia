#!/usr/bin/env python3
# Genera el plan de lectura "Canónico": la Biblia en un año (365 días),
# de Génesis a Apocalipsis, ~3-4 capítulos por día (1189 capítulos / 365).
# Sale a src/planes/canonico.json y viaja dentro de la APK (sin internet).
#
# Uso: python3 scripts/generar-plan-canonico.py

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DIAS = 365


def main():
    indice = json.loads((BASE / "src/biblia/datos/rv1909/index.json").read_text(encoding="utf-8"))
    libros = indice["libros"]

    # Lista plana de capítulos en orden canónico: (codigo, nombre, capitulo)
    caps = []
    for l in libros:
        for c in range(1, l["capitulos"] + 1):
            caps.append((l["codigo"], l["nombre"], c))
    total = len(caps)
    assert total == 1189, f"Se esperaban 1189 capítulos, hay {total}"

    dias = []
    for dia in range(1, DIAS + 1):
        ini = (dia - 1) * total // DIAS
        fin = dia * total // DIAS
        trozo = caps[ini:fin]
        # Agrupa por libro en rangos
        lecturas = []
        for codigo, nombre, cap in trozo:
            if lecturas and lecturas[-1]["libro"] == codigo and lecturas[-1]["capFin"] == cap - 1:
                lecturas[-1]["capFin"] = cap
            else:
                lecturas.append({"libro": codigo, "nombreLibro": nombre, "capInicio": cap, "capFin": cap})
        dias.append({"dia": dia, "lecturas": lecturas})

    plan = {
        "id": "canonico",
        "nombre": "La Biblia en un año",
        "descripcion": "Plan canónico: de Génesis a Apocalipsis en 365 días.",
        "dias": dias,
    }
    destino = BASE / "src/planes/canonico.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")

    # Muestra
    d1 = dias[0]
    d365 = dias[-1]
    def txt(d):
        return ", ".join(
            f"{l['nombreLibro']} {l['capInicio']}" + (f"–{l['capFin']}" if l['capFin'] != l['capInicio'] else "")
            for l in d["lecturas"]
        )
    print(f"Día 1:   {txt(d1)}")
    print(f"Día 365: {txt(d365)}")
    print(f"OK: {len(dias)} días -> {destino} ({destino.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
