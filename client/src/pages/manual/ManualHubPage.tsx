import { BookOpen, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getManualGuideIcon, MANUAL_GUIDES } from '@/pages/manual/manualGuides'
import { AUDIENCE_LABELS, AUDIENCE_ORDER, type ManualAudience } from '@/pages/manual/manualTypes'

const APP_NAME = 'Project Management & Talent'

function guidesByAudience(audience: ManualAudience) {
  return MANUAL_GUIDES.filter((g) => g.audience === audience)
}

export function ManualHubPage() {
  return (
    <div className="space-y-8">
      <Card className="border-[var(--navy)]/20 bg-gradient-to-r from-[var(--blue-lt)] to-white">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--navy)] text-white">
              <BookOpen className="size-6" />
            </div>
            <div>
              <CardTitle className="text-2xl">Centro de ayuda</CardTitle>
              <CardDescription className="mt-1 text-base">
                Guías cortas y en español sencillo para usar {APP_NAME}. Elija el tema que necesita; no hace
                falta leerlas todas.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="border-t border-border/60 pt-4">
          <p className="text-sm text-muted-foreground">
            <strong>¿Primera vez?</strong> Empiece por{' '}
            <Link to="/manual/primeros-pasos" className="font-medium text-[var(--navy)] underline-offset-2 hover:underline">
              Primeros pasos
            </Link>
            . Si algo falla, revise{' '}
            <Link
              to="/manual/preguntas-frecuentes"
              className="font-medium text-[var(--navy)] underline-offset-2 hover:underline"
            >
              Preguntas frecuentes
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      {AUDIENCE_ORDER.map((audience) => {
        const guides = guidesByAudience(audience)
        if (!guides.length) return null
        return (
          <section key={audience}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {AUDIENCE_LABELS[audience]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {guides.map((guide) => {
                const Icon = getManualGuideIcon(guide.iconName)
                return (
                  <Link
                    key={guide.slug}
                    to={`/manual/${guide.slug}`}
                    className="group block rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-[var(--lime)] hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--lime-lt)] text-[var(--navy)]">
                        <Icon className="size-5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground group-hover:text-[var(--navy)]">
                          {guide.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{guide.subtitle}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{guide.description}</p>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
