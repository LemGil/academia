import { describe, expect, it } from 'vitest'
import type { Academia } from './contenido'
import {
  agruparPorNiveles,
  estadoAcademia,
  progresoAcademia,
  resumenNivel,
  type DatosProgreso,
} from './niveles'

function academia(id: string, nivelOrden: number | undefined, nCodigos = 2): Academia {
  return {
    id,
    numero: `Nº ${id}`,
    titulo: `Academia ${id}`,
    nivel: nivelOrden === undefined ? undefined : `NIVEL ${nivelOrden}`,
    nivelOrden,
    codigos: Array.from({ length: nCodigos }, (_, i) => ({
      id: `${id}-c${i + 1}`,
      titulo: `Código ${i + 1}`,
      subtitulo: '',
      cuerpo: 'Texto.',
    })),
    cierre: '',
  }
}

function datos(parcial: Partial<DatosProgreso> = {}): DatosProgreso {
  return {
    leidos: new Set(),
    practicados: new Set(),
    concluidas: new Map(),
    desbloqueados: new Set(),
    ...parcial,
  }
}

/** Marca todos los códigos de una academia como leídos y practicados. */
function completa(a: Academia, d: DatosProgreso) {
  for (const c of a.codigos) {
    ;(d.leidos as Set<string>).add(c.id)
    ;(d.practicados as Set<string>).add(c.id)
  }
}

describe('niveles: agrupación y desbloqueo', () => {
  it('el primer nivel está abierto y el segundo bloqueado hasta concluir el primero', () => {
    const a1 = academia('lemgil-1', 1)
    const a2 = academia('lemgil-2', 2)
    const d = datos()
    let r = agruparPorNiveles([a2, a1], d)
    expect(r.grupos.map((g) => g.orden)).toEqual([1, 2])
    expect(r.grupos[0].desbloqueado).toBe(true)
    expect(r.grupos[1].desbloqueado).toBe(false)
    expect(estadoAcademia(a2, d, false)).toBe('bloqueada')

    // Concluir la del nivel 1 abre el nivel 2.
    ;(d.concluidas as Map<string, { fecha: string; encuentro: string }>).set('lemgil-1', {
      fecha: '2026-11-09',
      encuentro: 'encuentro_x',
    })
    r = agruparPorNiveles([a1, a2], d)
    expect(r.grupos[1].desbloqueado).toBe(true)
    expect(r.desbloqueadosResultantes.has(2)).toBe(true)
  })

  it('el avance no se quita: un nivel desbloqueado y guardado no se re-bloquea', () => {
    const a1 = academia('lemgil-1', 1)
    const a1Nueva = academia('lemgil-9', 1) // llega después a un nivel ya superado
    const a2 = academia('lemgil-2', 2)
    const d = datos({
      concluidas: new Map([['lemgil-1', { fecha: '2026-11-01', encuentro: 'e1' }]]),
      desbloqueados: new Set([2]),
    })
    const r = agruparPorNiveles([a1, a1Nueva, a2], d)
    const g2 = r.grupos.find((g) => g.orden === 2)!
    expect(g2.desbloqueado).toBe(true) // sigue abierto aunque el nivel 1 ya no esté completo
    const g1 = r.grupos.find((g) => g.orden === 1)!
    expect(g1.desbloqueado).toBe(true)
    // La nueva del nivel 1 se puede trabajar (su nivel está abierto)…
    expect(estadoAcademia(a1Nueva, d, g1.desbloqueado)).toBe('en-curso')
  })

  it('las academias sin nivel forman su grupo, siempre abierto, y no gatean', () => {
    const vieja = academia('lemgil-7', undefined)
    const a1 = academia('lemgil-1', 1)
    const a2 = academia('lemgil-2', 2)
    const r = agruparPorNiveles([vieja, a1, a2], datos())
    const sinNivel = r.grupos[r.grupos.length - 1]
    expect(sinNivel.orden).toBeNull()
    expect(sinNivel.nombre).toBe('Sin nivel asignado')
    expect(sinNivel.desbloqueado).toBe(true)
    expect(r.grupos[1].desbloqueado).toBe(false)
  })
})

describe('niveles: estados de la academia', () => {
  it('en curso → lista para el encuentro al 100 % → concluida solo con el sello', () => {
    const a = academia('lemgil-14', 1)
    const d = datos()
    expect(progresoAcademia(a, d).completa).toBe(false)
    expect(estadoAcademia(a, d, true)).toBe('en-curso')

    completa(a, d)
    expect(progresoAcademia(a, d).completa).toBe(true)
    // Leer y practicar NO concluye: falta el encuentro.
    expect(estadoAcademia(a, d, true)).toBe('lista-encuentro')

    ;(d.concluidas as Map<string, { fecha: string; encuentro: string }>).set(a.id, {
      fecha: '2026-11-09',
      encuentro: 'encuentro_y',
    })
    expect(estadoAcademia(a, d, true)).toBe('concluida')
  })

  it('leer sin practicar no basta para estar lista', () => {
    const a = academia('lemgil-14', 1)
    const d = datos()
    for (const c of a.codigos) (d.leidos as Set<string>).add(c.id)
    expect(progresoAcademia(a, d).completa).toBe(false)
    expect(estadoAcademia(a, d, true)).toBe('en-curso')
  })

  it('resumen del nivel: espera-encuentro cuando todo está listo pero no sellado', () => {
    const a = academia('lemgil-1', 1)
    const d = datos()
    completa(a, d)
    const { grupos } = agruparPorNiveles([a], d)
    const r = resumenNivel(grupos[0], d)
    expect(r.estado).toBe('espera-encuentro')
    expect(r.pctLeido).toBe(100)
    expect(r.pctPracticado).toBe(100)
  })
})

describe('paquetes: el nivel viaja en el paquete', () => {
  it('validarPaquete conserva nivel y nivelOrden; sin ellos quedan undefined', async () => {
    const { validarPaquete } = await import('./paquetes')
    const base = {
      tipo: 'paquete-academia',
      formato: 1,
      academia: {
        id: 'lemgil-14',
        numero: 'Nº 14',
        titulo: 'Serie de prueba',
        codigos: [{ id: 'lemgil-14-c1', titulo: 'Código 1', subtitulo: '', cuerpo: 'Texto.' }],
        cierre: '',
      },
    }
    const sin = validarPaquete(JSON.stringify(base))
    expect(sin.nivel).toBeUndefined()
    expect(sin.nivelOrden).toBeUndefined()
    const con = validarPaquete(
      JSON.stringify({
        ...base,
        academia: { ...base.academia, nivel: 'NIVEL I: FUNDAMENTOS', nivelOrden: 1 },
      }),
    )
    expect(con.nivel).toBe('NIVEL I: FUNDAMENTOS')
    expect(con.nivelOrden).toBe(1)
  })
})
