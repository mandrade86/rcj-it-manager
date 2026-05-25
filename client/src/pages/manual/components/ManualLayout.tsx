import { BookOpen, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { ManualGuideDef, ManualSection } from '@/pages/manual/manualTypes'

const APP_NAME = 'Project Management & Talent'

type Props = {
  guide: ManualGuideDef
  sections: ManualSection[]
}

function SectionNav({
  sections,
  activeId,
  onSelect,
}: {
  sections: ManualSection[]
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <nav className="space-y-0.5">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          className={cn(
            'flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
            activeId === s.id
              ? 'bg-[var(--lime-lt)] font-medium text-[var(--navy)]'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <ChevronRight
            className={cn('size-3.5 shrink-0', activeId === s.id ? 'opacity-100' : 'opacity-0')}
          />
          {s.title}
        </button>
      ))}
      <Link
        to="/manual"
        className="mt-3 block rounded-md px-2 py-1.5 text-sm text-[var(--navy)] underline-offset-2 hover:underline"
      >
        ← Todas las guías
      </Link>
    </nav>
  )
}

export function ManualLayout({ guide, sections }: Props) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && sections.some((s) => s.id === hash)) {
      setActiveId(hash)
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [sections])

  function scrollToSection(id: string) {
    setActiveId(id)
    window.history.replaceState(null, '', `/manual/${guide.slug}#${id}`)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-6">
      <Card className="border-[var(--navy)]/20 bg-gradient-to-r from-[var(--blue-lt)] to-white">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--navy)] text-white">
              <BookOpen className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {APP_NAME}
              </p>
              <CardTitle className="text-xl">{guide.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{guide.subtitle}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="hidden w-56 shrink-0 lg:block">
          <Card className="sticky top-4">
            <CardHeader className="py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                En esta guía
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[calc(100vh-14rem)]">
                <SectionNav sections={sections} activeId={activeId} onSelect={scrollToSection} />
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          {sections.map((section) => (
            <Card
              key={section.id}
              id={section.id}
              className="scroll-mt-20"
              onMouseEnter={() => setActiveId(section.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="max-w-none text-sm leading-relaxed text-foreground [&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:font-semibold [&_h4]:text-[var(--navy)] [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
                {section.content}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
