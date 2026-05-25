import { useMemo } from 'react'
import { Calendar } from 'lucide-react'

import {
  barLayoutInRange,
  formatRangeLabel,
  monthTicks,
  todayMarkerPercent,
  weekTicks,
  type TimelineRange,
  type TimelineScale,
} from '@/lib/roadmapTimeline'
import { cn } from '@/lib/utils'

export type TimelineGanttRow = {
  id: string
  label: string
  sublabel?: string
  level?: number
  isGroup?: boolean
  expanded?: boolean
  fecha_inicio?: string | null
  fecha_fin?: string | null
  /** 0–100 avance dentro de la barra */
  progress?: number
  barClassName?: string
  tooltip?: string
  onClick?: () => void
  onToggleExpand?: () => void
  leading?: React.ReactNode
}

type Props = {
  rows: TimelineGanttRow[]
  range: TimelineRange
  scale?: TimelineScale
  labelWidth?: number
  labelColumnTitle?: string
  minChartWidth?: number
  emptyMessage?: string
  headerNote?: string
}

const DEFAULT_LABEL_W = 280

function GridLines({
  range,
  ticks,
}: {
  range: TimelineRange
  ticks: { t: number }[]
}) {
  return (
    <>
      {ticks.map((tick) => {
        const left = ((tick.t - range.start) / range.spanMs) * 100
        return (
          <div
            key={tick.t}
            className="pointer-events-none absolute inset-y-0 border-l border-border/60"
            style={{ left: `${left}%` }}
          />
        )
      })}
    </>
  )
}

function TodayLine({ range }: { range: TimelineRange }) {
  const pct = todayMarkerPercent(range)
  if (pct == null) return null
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-[5] w-0.5 bg-[var(--lime)] shadow-[0_0_0_1px_rgba(112,173,71,0.4)]"
      style={{ left: `${pct}%` }}
      title="Hoy"
    />
  )
}

export function TimelineGanttChart({
  rows,
  range,
  scale = 'mes',
  labelWidth = DEFAULT_LABEL_W,
  labelColumnTitle = 'Proyecto',
  minChartWidth = 720,
  emptyMessage = 'Sin filas para mostrar en el timeline.',
  headerNote,
}: Props) {
  const months = useMemo(() => monthTicks(range), [range])
  const weeks = useMemo(() => weekTicks(range), [range])
  const ticks = scale === 'semana' ? weeks : months
  const rangeLabel = formatRangeLabel(range)
  const todayPct = todayMarkerPercent(range)

  if (!rows.length) {
    return (
      <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  const tickMinW = scale === 'semana' ? 44 : 56
  const chartMinW = Math.max(minChartWidth, ticks.length * tickMinW)

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      {(headerNote || rangeLabel) && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-4 py-2 text-xs text-muted-foreground">
          <Calendar className="size-3.5 shrink-0 text-[var(--lime)]" />
          {headerNote && <span>{headerNote}</span>}
          <span className={headerNote ? 'text-border' : ''}>{headerNote ? '·' : ''}</span>
          <span>{rangeLabel}</span>
          {todayPct != null && (
            <span className="rounded bg-[var(--lime-lt)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--navy)]">
              Hoy marcado en verde
            </span>
          )}
        </p>
      )}

      <div className="overflow-x-auto">
        <div style={{ minWidth: labelWidth + chartMinW }}>
          <div className="flex border-b border-border bg-muted/30">
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-border bg-muted/30 px-2 py-2 text-xs font-medium text-muted-foreground"
              style={{ width: labelWidth }}
            >
              {labelColumnTitle}
            </div>
            <div className="relative flex min-w-0 flex-1 flex-col" style={{ minWidth: chartMinW }}>
              {scale === 'semana' && months.length > 0 && (
                <div className="flex border-b border-border/70">
                  {months.map((m, i) => {
                    const next = months[i + 1]?.t ?? range.end
                    const w = ((next - m.t) / range.spanMs) * 100
                    return (
                      <div
                        key={m.t}
                        className="border-l border-border/50 py-1 text-center text-[10px] font-medium text-muted-foreground"
                        style={{ width: `${w}%` }}
                      >
                        {m.label}
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex">
                {ticks.map((tick) => (
                  <div
                    key={tick.t}
                    className="min-w-0 flex-1 border-l border-border py-1.5 text-center text-[10px] text-muted-foreground"
                    style={{ minWidth: tickMinW }}
                  >
                    {tick.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {rows.map((row) => (
            <TimelineGanttRowView
              key={row.id}
              row={row}
              range={range}
              labelWidth={labelWidth}
              chartMinW={chartMinW}
              ticks={ticks}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TimelineGanttRowView({
  row,
  range,
  labelWidth,
  chartMinW,
  ticks,
}: {
  row: TimelineGanttRow
  range: TimelineRange
  labelWidth: number
  chartMinW: number
  ticks: { t: number }[]
}) {
  const { left, width } = barLayoutInRange(row.fecha_inicio, row.fecha_fin, range)
  const indent = (row.level ?? 0) * 14
  const hasBar = Boolean(row.fecha_inicio || row.fecha_fin)
  const progress = Math.min(100, Math.max(0, row.progress ?? 0))

  return (
    <div
      className={cn(
        'flex border-b border-border',
        row.isGroup ? 'bg-muted/15 hover:bg-muted/20' : 'hover:bg-muted/10',
      )}
    >
      <div
        className={cn(
          'sticky left-0 z-10 flex shrink-0 items-center border-r border-border py-1.5 pr-2',
          row.isGroup ? 'bg-muted/25' : 'bg-card',
        )}
        style={{ width: labelWidth, paddingLeft: 8 + indent }}
      >
        {row.leading}
        <button
          type="button"
          onClick={row.onToggleExpand ?? row.onClick}
          className="min-w-0 flex-1 text-left"
          disabled={!row.onClick && !row.onToggleExpand}
        >
          <p className="line-clamp-2 text-xs font-medium text-foreground">{row.label}</p>
          {row.sublabel && (
            <p className="line-clamp-1 text-[10px] text-muted-foreground">{row.sublabel}</p>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={row.onClick}
        disabled={!row.onClick}
        className={cn(
          'relative min-h-10 min-w-0 flex-1',
          row.onClick && 'cursor-pointer',
          !row.onClick && 'cursor-default',
        )}
        style={{ minWidth: chartMinW }}
        aria-label={row.label}
      >
        <GridLines range={range} ticks={ticks} />
        <TodayLine range={range} />
        {hasBar && (
          <>
            <div
              className={cn(
                'absolute top-2.5 z-[2] h-5 rounded-sm shadow-sm ring-1 ring-black/10 transition hover:brightness-110',
                row.barClassName ?? 'bg-muted-foreground',
                row.isGroup && 'top-3 h-3.5 opacity-75',
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={row.tooltip}
            />
            {!row.isGroup && progress > 0 && (
              <div
                className="absolute top-2.5 z-[3] h-5 rounded-l-sm bg-white/40"
                style={{
                  left: `${left}%`,
                  width: `${(width * progress) / 100}%`,
                }}
                title={`Avance ${progress}%`}
              />
            )}
          </>
        )}
      </button>
    </div>
  )
}
