import { formatLps } from '@/lib/format'

type PayloadItem = { name: string; value: number; fill?: string; color?: string }

export function BiChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: PayloadItem[]
  label?: string
  formatter?: (value: number, name: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3 text-xs shadow-xl">
      {label && <p className="mb-1.5 font-semibold text-[var(--text)]">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.fill ?? p.color }}>{p.name}</span>
          <span className="tabular-nums font-medium">
            {formatter ? formatter(p.value, p.name) : formatLps(p.value)}
          </span>
        </p>
      ))}
    </div>
  )
}

export function BiPctTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: PayloadItem[]
  label?: string
}) {
  return (
    <BiChartTooltip
      active={active}
      payload={payload}
      label={label}
      formatter={(v) => `${v.toFixed(1)}%`}
    />
  )
}
