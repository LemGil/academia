// Presencia de cercanía con caducidad (lección de la Fase A):
// en Bitchat un teléfono que se iba seguía «presente» para siempre.
// Aquí cada par guarda CUÁNDO se le vio por última vez, la lista dice
// «visto hace X min» y quien pasa del límite deja de contar como presente
// — su relevo ya no engaña a nadie.

export interface ParPresente {
  endpointId: string
  nombre: string
  /** Clave pública LemChat si ya hizo el saludo; null mientras tanto. */
  clavePublica: string | null
  vistoEn: number
}

/** Un par se considera presente si se le vio dentro de este margen. */
export const MARGEN_PRESENCIA_MS = 90_000

export class RegistroPresencia {
  private pares = new Map<string, ParPresente>()

  tocar(endpointId: string, nombre: string, ts: number, clavePublica?: string | null) {
    const previo = this.pares.get(endpointId)
    this.pares.set(endpointId, {
      endpointId,
      nombre: nombre || previo?.nombre || 'Teléfono cercano',
      clavePublica: clavePublica ?? previo?.clavePublica ?? null,
      vistoEn: ts,
    })
  }

  olvidar(endpointId: string) {
    this.pares.delete(endpointId)
  }

  limpiar() {
    this.pares.clear()
  }

  /** Pares presentes ahora (dentro del margen), más recientes primero. */
  presentes(ahoraTs: number): ParPresente[] {
    return [...this.pares.values()]
      .filter((p) => ahoraTs - p.vistoEn <= MARGEN_PRESENCIA_MS)
      .sort((a, b) => b.vistoEn - a.vistoEn)
  }

  /** Todos los conocidos, presentes o no, con su última vez. */
  todos(): ParPresente[] {
    return [...this.pares.values()].sort((a, b) => b.vistoEn - a.vistoEn)
  }

  porClave(clavePublica: string, ahoraTs: number): ParPresente | null {
    return this.presentes(ahoraTs).find((p) => p.clavePublica === clavePublica) ?? null
  }

  porEndpoint(endpointId: string): ParPresente | null {
    return this.pares.get(endpointId) ?? null
  }
}
