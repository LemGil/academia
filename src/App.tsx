import React, { useCallback, useEffect, useState } from 'react'
import { PantallaAcademias } from './academia/PantallaAcademias'
import { PantallaProgreso } from './academia/PantallaProgreso'
import { PantallaPlan } from './planes/PantallaPlan'
import { Biblia } from './lectura/Biblia'
import { Academia, ACADEMIAS_INCLUIDAS } from './academia/contenido'
import { cargarCatalogo } from './academia/paquetes'

type Tab = 'academias' | 'biblia' | 'plan' | 'progreso'

export interface DestinoBiblia {
  codigo: string
  cap: number
  n: number
}

const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('academias')
  const [destino, setDestino] = useState<DestinoBiblia | null>(null)
  // Catálogo de enseñanzas: incluidas en la APK + paquetes importados (v1.3).
  const [academias, setAcademias] = useState<Academia[]>(ACADEMIAS_INCLUIDAS)
  const [importadas, setImportadas] = useState<Set<string>>(new Set())

  const refrescarCatalogo = useCallback(async () => {
    try {
      const c = await cargarCatalogo()
      setAcademias(c.lista)
      setImportadas(c.importadas)
    } catch {
      // Si el almacenamiento falla, la app sigue con el contenido incluido.
    }
  }, [])

  useEffect(() => {
    refrescarCatalogo()
  }, [refrescarCatalogo])

  const irACapitulo = (codigo: string, cap: number) => {
    setDestino({ codigo, cap, n: Date.now() })
    setTab('biblia')
  }

  return (
    <div className="app">
      <div className="contenido" key={tab}>
        {tab === 'academias' && (
          <PantallaAcademias
            academias={academias}
            importadas={importadas}
            alRefrescarCatalogo={refrescarCatalogo}
          />
        )}
        {tab === 'biblia' && <Biblia destino={destino} />}
        {tab === 'plan' && <PantallaPlan onIrACapitulo={irACapitulo} />}
        {tab === 'progreso' && <PantallaProgreso academias={academias} />}
      </div>
      <nav className="pestanas">
        <button className={tab === 'academias' ? 'activo' : ''} onClick={() => setTab('academias')}>
          <span className="ico">📚</span>Academias
        </button>
        <button className={tab === 'biblia' ? 'activo' : ''} onClick={() => setTab('biblia')}>
          <span className="ico">📖</span>Biblia
        </button>
        <button className={tab === 'plan' ? 'activo' : ''} onClick={() => setTab('plan')}>
          <span className="ico">📅</span>Plan
        </button>
        <button className={tab === 'progreso' ? 'activo' : ''} onClick={() => setTab('progreso')}>
          <span className="ico">📊</span>Progreso
        </button>
      </nav>
    </div>
  )
}

export default App
