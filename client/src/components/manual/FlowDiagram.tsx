import { useEffect, useId, useState } from 'react'

let mermaidReady = false

async function ensureMermaid() {
  if (mermaidReady) return (await import('mermaid')).default
  const mermaid = (await import('mermaid')).default
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '14px',
      primaryColor: '#EAF5D9',
      primaryTextColor: '#002060',
      primaryBorderColor: '#70AD47',
      secondaryColor: '#DCE6F1',
      secondaryTextColor: '#002060',
      secondaryBorderColor: '#002060',
      tertiaryColor: '#F8F9FA',
      tertiaryTextColor: '#1A1A2E',
      lineColor: '#002060',
      textColor: '#002060',
      mainBkg: '#FFFFFF',
      nodeBorder: '#70AD47',
      clusterBkg: '#F8F9FA',
      clusterBorder: '#E0E4E8',
      titleColor: '#002060',
      edgeLabelBackground: '#FFFFFF',
    },
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
      padding: 16,
      nodeSpacing: 40,
      rankSpacing: 48,
    },
  })
  mermaidReady = true
  return mermaid
}

type Props = {
  chart: string
  /** Texto breve bajo el diagrama (accesibilidad). */
  caption?: string
}

export function FlowDiagram({ chart, caption }: Props) {
  const reactId = useId().replace(/:/g, '')
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const diagram = chart.trim()

    async function render() {
      setLoading(true)
      setError(null)
      try {
        const mermaid = await ensureMermaid()
        const renderId = `flow-${reactId}-${Date.now()}`
        const { svg: out } = await mermaid.render(renderId, diagram)
        if (!cancelled) {
          setSvg(out)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo generar el diagrama')
          setLoading(false)
        }
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [chart, reactId])

  return (
    <figure className="my-5">
      <div
        className={[
          'flow-diagram relative min-h-[120px] overflow-x-auto rounded-lg border border-border bg-white p-4 shadow-sm',
          '[&_svg]:mx-auto [&_svg]:block [&_svg]:max-w-full [&_svg]:h-auto',
          '[&_.nodeLabel]:text-sm',
        ].join(' ')}
        role="img"
        aria-label={caption ?? 'Diagrama de flujo'}
      >
        {loading && !svg && (
          <p className="py-8 text-center text-sm text-muted-foreground">Generando diagrama…</p>
        )}
        {error && (
          <p className="py-4 text-center text-sm text-destructive">
            {error}
          </p>
        )}
        {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : null}
      </div>
      {caption ? (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  )
}
