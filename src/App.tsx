import React, { useState } from 'react'
import { PantallaAcademias } from './academia/PantallaAcademias'
import { PantallaProgreso } from './academia/PantallaProgreso'
import { PantallaPlan } from './planes/PantallaPlan'
import { Biblia } from './lectura/Biblia'

type Tab = 'academias' | 'biblia' | 'plan' | 'progreso'

export interface DestinoBiblia {
  codigo: string
  cap: number
  n: number
}

const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('academias')
  const [destino, setDestino] = useState<DestinoBiblia | null>(null)

  const irACapitulo = (codigo: string, cap: number) => {
    setDestino({ codigo, cap, n: Date.now() })
    setTab('biblia')
  }

  return (
    <div className="app">
      <div className="contenido" key={tab}>
        {tab === 'academias' && <PantallaAcademias />}
        {tab === 'biblia' && <Biblia destino={destino} />}
        {tab === 'plan' && <PantallaPlan onIrACapitulo={irACapitulo} />}
        {tab === 'progreso' && <PantallaProgreso />}
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
