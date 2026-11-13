// Marcas de leído unificadas (v1.7.1): por libro y capítulo, sin versión,
// con migración automática de las marcas viejas («version:codigo:cap»).
// Sin jsdom (no es dependencia del repo): localStorage se simula con un
// objeto en memoria instalado como global antes de cada prueba.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  alternarLeido,
  cargarLeidos,
  claveCapitulo,
  conteoPorLibro,
  normalizarClave,
} from './progresoBiblia'
import { capituloLeido } from '../planes/planes'

const CLAVE = 'academia_biblia_leidos_v1'

class AlmacenFalso {
  private datos = new Map<string, string>()
  getItem(k: string) {
    return this.datos.has(k) ? this.datos.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.datos.set(k, String(v))
  }
  removeItem(k: string) {
    this.datos.delete(k)
  }
  clear() {
    this.datos.clear()
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new AlmacenFalso())
})

describe('progresoBiblia: leído sin versión', () => {
  it('la clave ya no lleva versión', () => {
    expect(claveCapitulo('gen', 1)).toBe('gen:1')
  })

  it('normaliza las claves viejas con versión y descarta basura', () => {
    expect(normalizarClave('rv1909:gen:1')).toBe('gen:1')
    expect(normalizarClave('blt:juan:3')).toBe('juan:3')
    expect(normalizarClave('gen:1')).toBe('gen:1')
    expect(normalizarClave('basura')).toBeNull()
  })

  it('al cargar, las marcas viejas se convierten y se guardan convertidas', () => {
    localStorage.setItem(
      CLAVE,
      JSON.stringify(['rv1909:gen:1', 'rvg:gen:1', 'blt:gen:2', 'vbl:exo:3']),
    )
    const leidos = cargarLeidos()
    // Génesis 1 leído en dos versiones cuenta UNA vez: es el mismo capítulo.
    expect([...leidos].sort()).toEqual(['exo:3', 'gen:1', 'gen:2'])
    const guardado = JSON.parse(localStorage.getItem(CLAVE)!) as string[]
    expect(guardado.sort()).toEqual(['exo:3', 'gen:1', 'gen:2'])
  })

  it('marcar leído en una «versión» vale para todas: la clave es una sola', () => {
    let leidos = alternarLeido(claveCapitulo('gen', 1))
    expect(capituloLeido(leidos, 'gen', 1)).toBe(true)
    expect(conteoPorLibro(leidos, 'gen')).toBe(1)
    // Desmarcar lo desmarca del todo (no queda resto por versión).
    leidos = alternarLeido(claveCapitulo('gen', 1))
    expect(capituloLeido(leidos, 'gen', 1)).toBe(false)
    expect(leidos.size).toBe(0)
  })

  it('los planes reconocen el capítulo leído con la clave nueva', () => {
    const leidos = new Set(['gen:1', 'gen:2'])
    expect(capituloLeido(leidos, 'gen', 2)).toBe(true)
    expect(capituloLeido(leidos, 'gen', 3)).toBe(false)
  })
})
