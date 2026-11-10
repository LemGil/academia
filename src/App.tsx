import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { PantallaAcademias } from './academia/PantallaAcademias'
import { PantallaProgreso } from './academia/PantallaProgreso'
import { PantallaPlan } from './planes/PantallaPlan'
import { Biblia } from './lectura/Biblia'
import { Academia, ACADEMIAS_INCLUIDAS } from './academia/contenido'
import { cargarCatalogo, importarPaquete } from './academia/paquetes'
import { sincronizarDesbloqueos } from './academia/progreso'
import { leerNoLeidosPublicados } from './lemchat/almacen'

// LemChat (Fase B): carga perezosa — el código del chat solo se descarga
// y se ejecuta cuando el estudiante abre la pestaña CHAT. Si LemChat
// falla, el lector ni se entera (frontera de error propia abajo).
const PantallaChat = React.lazy(() =>
  import('./lemchat/PantallaChat').then((m) => ({ default: m.PantallaChat })),
)

class FronteraChat extends React.Component<{ children: React.ReactNode }, { fallo: boolean }> {
  state = { fallo: false }
  static getDerivedStateFromError() {
    return { fallo: true }
  }
  render() {
    if (this.state.fallo) {
      return (
        <div className="lista">
          <h2>💬 CHAT</h2>
          <p>
            El chat tuvo un problema y se cerró. Tus Academias, tu Biblia y tu progreso están
            intactos: sigue estudiando y vuelve a intentarlo más tarde.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

type Tab = 'academias' | 'biblia' | 'chat' | 'plan' | 'progreso'

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
  // Academia a abrir directamente (al tocarla en la pantalla de Progreso).
  const [destinoAcademia, setDestinoAcademia] = useState<{ id: string; n: number } | null>(null)

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

  // Niveles (v1.7): cuando el catálogo cambia, se guardan los niveles
  // que se acaban de desbloquear (el avance no se quita).
  useEffect(() => {
    sincronizarDesbloqueos(academias)
  }, [academias])

  /** Verifica el sello del encuentro presencial (v1.7): carga LemChat de
   *  forma perezosa, solo cuando el alumno va a sellar una conclusión. */
  const verificarSello = useCallback(async (texto: string) => {
    const { obtenerServicio } = await import('./lemchat/servicio')
    return obtenerServicio().verificarSelloEncuentro(texto)
  }, [])

  const irACapitulo = (codigo: string, cap: number) => {
    setDestino({ codigo, cap, n: Date.now() })
    setTab('biblia')
  }

  const irAAcademia = (id: string) => {
    setDestinoAcademia({ id, n: Date.now() })
    setTab('academias')
  }

  // --- LemChat: contador de no leídos y puente de entrega firmada ---
  const [noLeidosChat, setNoLeidosChat] = useState(0)
  useEffect(() => {
    const leer = () => setNoLeidosChat(leerNoLeidosPublicados())
    leer()
    const t = setInterval(leer, 4000)
    return () => clearInterval(t)
  }, [])

  const academiasRef = useRef(academias)
  academiasRef.current = academias

  /** LemChat verificó la firma; aquí solo se guarda por el camino de
   *  importación de siempre y se refresca el catálogo. */
  const archivarPaqueteLemChat = useCallback(
    async (textoPaquete: string) => {
      const res = await importarPaquete(textoPaquete, academiasRef.current)
      await refrescarCatalogo()
      return res.academia
    },
    [refrescarCatalogo],
  )

  return (
    <div className="app">
      <div className="contenido" key={tab}>
        {tab === 'academias' && (
          <PantallaAcademias
            academias={academias}
            importadas={importadas}
            alRefrescarCatalogo={refrescarCatalogo}
            destino={destinoAcademia}
            verificarSello={verificarSello}
          />
        )}
        {tab === 'biblia' && <Biblia destino={destino} />}
        {tab === 'chat' && (
          <FronteraChat>
            <Suspense
              fallback={
                <div className="lista">
                  <h2>💬 CHAT</h2>
                  <p>Abriendo…</p>
                </div>
              }
            >
              <PantallaChat
                alArchivarPaquete={archivarPaqueteLemChat}
                alAbrirAcademia={irAAcademia}
                academias={academias}
              />
            </Suspense>
          </FronteraChat>
        )}
        {tab === 'plan' && <PantallaPlan onIrACapitulo={irACapitulo} />}
        {tab === 'progreso' && <PantallaProgreso academias={academias} alAbrirAcademia={irAAcademia} />}
      </div>
      <nav className="pestanas">
        <button className={tab === 'academias' ? 'activo' : ''} onClick={() => setTab('academias')}>
          <span className="ico">📚</span>Academias
        </button>
        <button className={tab === 'biblia' ? 'activo' : ''} onClick={() => setTab('biblia')}>
          <span className="ico">📖</span>Biblia
        </button>
        <button className={tab === 'chat' ? 'activo' : ''} onClick={() => setTab('chat')}>
          <span className="ico">💬</span>CHAT
          {noLeidosChat > 0 && <span className="chat-contador pestana">{noLeidosChat}</span>}
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
