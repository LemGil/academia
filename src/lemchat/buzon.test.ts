import { describe, expect, it } from 'vitest'
import { Buzon, firmarFila, filaEsAutentica } from './buzon'
import { crearIdentidad } from './identidad'

describe('buzón: firma de filas', () => {
  it('una fila firmada verifica; cualquier cambio la invalida', () => {
    const lem = crearIdentidad('Lem')
    const fila = firmarFila(lem.clavePrivada, {
      de: lem.clavePublica,
      para: 'destino',
      tipo: 'texto',
      cuerpo: '{"id":"m_1","sellado":"..."}',
    })
    expect(filaEsAutentica(fila)).toBe(true)
    expect(filaEsAutentica({ ...fila, cuerpo: '{"id":"m_2"}' })).toBe(false)
    expect(filaEsAutentica({ ...fila, para: 'otro' })).toBe(false)
    expect(filaEsAutentica({ ...fila, de: crearIdentidad('X').clavePublica })).toBe(false)
  })
})

describe('buzón: cliente REST', () => {
  const config = { url: 'https://proyecto.supabase.co/', anonKey: 'anon-de-prueba' }

  it('sin configurar se reconoce como tal', () => {
    expect(new Buzon({ url: '', anonKey: '' }).configurado()).toBe(false)
    expect(new Buzon(config).configurado()).toBe(true)
  })

  it('enviar hace POST a lc_mensajes con la anon key y sin id', async () => {
    const llamadas: { url: string; init?: RequestInit }[] = []
    const fetchFalso = async (url: string, init?: RequestInit) => {
      llamadas.push({ url, init })
      return { ok: true, status: 200, json: async () => [] } as Response
    }
    const buzon = new Buzon(config, fetchFalso)
    await buzon.enviar({
      id: 'no-debe-ir',
      de: 'a',
      para: 'b',
      tipo: 'texto',
      cuerpo: 'x',
      firma: 'f',
    })
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0].url).toBe('https://proyecto.supabase.co/rest/v1/lc_mensajes')
    expect(llamadas[0].init?.method).toBe('POST')
    const cuerpo = JSON.parse(llamadas[0].init?.body as string)
    expect(cuerpo.id).toBeUndefined()
    expect(cuerpo.para).toBe('b')
    const cab = llamadas[0].init?.headers as Record<string, string>
    expect(cab.apikey).toBe('anon-de-prueba')
  })

  it('recibir consulta lo mío y lo del canal, ordenado', async () => {
    let urlPedida = ''
    const fetchFalso = async (url: string) => {
      urlPedida = url
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: '1', de: 'x', para: 'canal', tipo: 'aviso', cuerpo: 'hola', firma: 'f' }],
      } as Response
    }
    const buzon = new Buzon(config, fetchFalso)
    const filas = await buzon.recibir('mi-clave')
    expect(filas).toHaveLength(1)
    expect(urlPedida).toContain('para.eq.mi-clave')
    expect(urlPedida).toContain('para.eq.canal')
  })

  it('un error del servidor se propaga como error (no se traga)', async () => {
    const fetchFalso = async () => ({ ok: false, status: 500, json: async () => [] }) as Response
    const buzon = new Buzon(config, fetchFalso)
    await expect(buzon.recibir('x')).rejects.toThrow('500')
  })
})
