/** Hex corporativos por eje (gráficas, estilos inline). */
const EJE_HEX: Record<string, string> = {
  Infraestructura: '#1F4E79',
  Seguridad: '#C00000',
  Red: '#375623',
  Software: '#7F6000',
  'Gobierno IT': '#4527A0',
  Talento: '#0F6E56',
}

/** Clases Tailwind estáticas — el JIT no detecta `bg-[${hex}]` dinámico. */
const EJE_COLORS: Record<string, string> = {
  Infraestructura: 'bg-[#1F4E79]',
  Seguridad: 'bg-[#C00000]',
  Red: 'bg-[#375623]',
  Software: 'bg-[#7F6000]',
  'Gobierno IT': 'bg-[#4527A0]',
  Talento: 'bg-[#0F6E56]',
}

export function ejeHex(eje?: string | null): string {
  if (!eje) return '#6B7280'
  return EJE_HEX[eje] ?? '#002060'
}

export function ejeBarClass(eje?: string | null): string {
  if (!eje) return 'bg-muted-foreground'
  return EJE_COLORS[eje] ?? 'bg-muted-foreground'
}
