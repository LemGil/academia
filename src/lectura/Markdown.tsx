import React from 'react'

// Renderizador mínimo de markdown para las enseñanzas (sin dependencias).
function enLinea(texto: string, keyBase: string): React.ReactNode[] {
  const partes: React.ReactNode[] = []
  // **negrita**, *cursiva*
  const re = /(\*\*.+?\*\*|\*[^*]+?\*)/g
  let ultimo = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(texto)) !== null) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index))
    const t = m[0]
    if (t.startsWith('**')) partes.push(<strong key={`${keyBase}-${k++}`}>{t.slice(2, -2)}</strong>)
    else partes.push(<em key={`${keyBase}-${k++}`}>{t.slice(1, -1)}</em>)
    ultimo = m.index + t.length
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo))
  return partes
}

export const Markdown: React.FC<{ texto: string }> = ({ texto }) => {
  const bloques: React.ReactNode[] = []
  const lineas = texto.split('\n')
  let i = 0
  let k = 0
  while (i < lineas.length) {
    const ln = lineas[i]
    const s = ln.trim()
    if (!s) { i++; continue }
    if (s.startsWith('### ')) {
      bloques.push(<h3 key={k++}>{enLinea(s.slice(4), `h3-${k}`)}</h3>)
    } else if (s.startsWith('## ')) {
      bloques.push(<h2 key={k++}>{enLinea(s.slice(3), `h2-${k}`)}</h2>)
    } else if (s.startsWith('> ')) {
      const cita: string[] = []
      while (i < lineas.length && lineas[i].trim().startsWith('>')) {
        cita.push(lineas[i].trim().replace(/^>\s?/, ''))
        i++
      }
      bloques.push(
        <blockquote key={k++}>
          {cita.map((c, j) => <p key={j}>{enLinea(c, `q-${k}-${j}`)}</p>)}
        </blockquote>
      )
      continue
    } else if (/^[-*]\s/.test(s)) {
      const items: string[] = []
      while (i < lineas.length && /^[-*]\s/.test(lineas[i].trim())) {
        items.push(lineas[i].trim().replace(/^[-*]\s/, ''))
        i++
      }
      bloques.push(
        <ul key={k++}>
          {items.map((it, j) => <li key={j}>{enLinea(it, `li-${k}-${j}`)}</li>)}
        </ul>
      )
      continue
    } else {
      // Párrafo: junta líneas continuas
      const par: string[] = [s]
      i++
      while (i < lineas.length) {
        const nx = lineas[i].trim()
        if (!nx || nx.startsWith('#') || nx.startsWith('>') || /^[-*]\s/.test(nx)) break
        par.push(nx)
        i++
      }
      bloques.push(<p key={k++}>{enLinea(par.join(' '), `p-${k}`)}</p>)
      continue
    }
    i++
  }
  return <>{bloques}</>
}
