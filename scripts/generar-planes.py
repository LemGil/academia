#!/usr/bin/env python3
# Genera los planes de lectura bíblica de la app (dentro de la APK, sin internet).
# Cada plan es una lista día -> pasajes; el progreso se calcula solo con los
# capítulos ya marcados como leídos.
#
# Uso: python3 scripts/generar-planes.py

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent


def cargar_libros():
    indice = json.loads((BASE / "src/biblia/datos/rv1909/index.json").read_text(encoding="utf-8"))
    return indice["libros"]


def lista_caps(libros, testamento=None):
    caps = []
    for l in libros:
        if testamento and l["testamento"] != testamento:
            continue
        for c in range(1, l["capitulos"] + 1):
            caps.append((l["codigo"], l["nombre"], c))
    return caps


def agrupar(trozo):
    lecturas = []
    for codigo, nombre, cap in trozo:
        if lecturas and lecturas[-1]["libro"] == codigo and lecturas[-1]["capFin"] == cap - 1:
            lecturas[-1]["capFin"] = cap
        else:
            lecturas.append({"libro": codigo, "nombreLibro": nombre, "capInicio": cap, "capFin": cap})
    return lecturas


def repartir(caps, dias, suave=False):
    """Reparte capítulos en N días.
    suave=False: bloques parejos (algunos días pueden quedar vacíos al inicio).
    suave=True:  los descansos se reparten y el día 1 siempre tiene lectura."""
    if suave:
        dias_list: list = [[] for _ in range(dias)]
        total = len(caps)
        for i, c in enumerate(caps):
            dias_list[i * dias // total].append(c)
        return [{"dia": d + 1, "lecturas": agrupar(trozo)} for d, trozo in enumerate(dias_list)]
    total = len(caps)
    out = []
    for dia in range(1, dias + 1):
        ini = (dia - 1) * total // dias
        fin = dia * total // dias
        out.append({"dia": dia, "lecturas": agrupar(caps[ini:fin])})
    return out


def guardar(plan_id, nombre, descripcion, carga, dias):
    plan = {"id": plan_id, "nombre": nombre, "descripcion": descripcion,
            "carga": carga, "dias": dias}
    destino = BASE / f"src/planes/{plan_id}.json"
    destino.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  {nombre}: {len(dias)} días -> {plan_id}.json ({destino.stat().st_size // 1024} KB)")


def main():
    print("Generando planes de lectura...")
    libros = cargar_libros()
    todos = lista_caps(libros)
    at = lista_caps(libros, "AT")
    nt = lista_caps(libros, "NT")
    assert len(todos) == 1189 and len(at) == 929 and len(nt) == 260

    # 1. Canónico: la Biblia en un año (Génesis -> Apocalipsis)
    guardar("canonico", "La Biblia en un año",
            "Plan canónico: de Génesis a Apocalipsis en 365 días.",
            "~3–4 capítulos diarios", repartir(todos, 365))

    # 2. Nuevo Testamento en un año (un capítulo al día, con descansos repartidos)
    guardar("nt-ano", "El Nuevo Testamento en un año",
            "Los 27 libros del Nuevo Testamento en 365 días, a ritmo suave.",
            "~1 capítulo diario", repartir(nt, 365, suave=True))

    # 3. Paralelo: Antiguo y Nuevo Testamento cada día
    dias_par = []
    nt_suave = repartir(nt, 365, suave=True)
    for dia in range(1, 366):
        ini_at, fin_at = (dia - 1) * len(at) // 365, dia * len(at) // 365
        lecturas = agrupar(at[ini_at:fin_at]) + nt_suave[dia - 1]["lecturas"]
        dias_par.append({"dia": dia, "lecturas": lecturas})
    guardar("paralelo", "Antiguo y Nuevo cada día",
            "Los dos testamentos en un año, leyendo de ambos cada día.",
            "~3–4 capítulos diarios", dias_par)

    # 4. Intensivo: la Biblia en 90 días
    guardar("90-dias", "La Biblia en 90 días",
            "Plan intensivo: toda la Biblia en tres meses.",
            "~13 capítulos diarios", repartir(todos, 90))

    print("OK")


if __name__ == "__main__":
    main()
