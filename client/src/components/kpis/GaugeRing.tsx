type Props = {
  value: number
  size?: number
  className?: string
}

/** Gauge 0–100 con anillo cónico (paleta RCJ). */
export function GaugeRing({ value, size = 112, className }: Props) {
  const v = Math.max(0, Math.min(100, value))
  const deg = v * 3.6

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `conic-gradient(var(--lime) ${deg}deg, var(--border) 0deg)`,
      }}
    >
      <div
        className="flex size-full items-center justify-center p-[10%]"
        style={{ borderRadius: '50%' }}
      >
        <div
          className="flex size-full flex-col items-center justify-center rounded-full bg-card shadow-inner"
          style={{ fontSize: size * 0.2 }}
        >
          <span className="font-semibold text-[var(--navy)]">{Math.round(v)}%</span>
          <span className="text-[10px] font-normal text-muted-foreground">avance</span>
        </div>
      </div>
    </div>
  )
}
