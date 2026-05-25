/** Mapa de colores para ejes conocidos del Plan IT. Ejes libres caen al default. */
const EJE_COLORS: Record<string, string> = {
  Infraestructura: 'bg-[#1F4E79]',
  Seguridad: 'bg-[#C00000]',
  Red: 'bg-[#375623]',
  Software: 'bg-[#7F6000]',
  'Gobierno IT': 'bg-[#4527A0]',
  Talento: 'bg-[#0F6E56]',
}

export function ejeBarClass(eje?: string | null): string {
  if (!eje) return 'bg-muted-foreground'
  return EJE_COLORS[eje] ?? 'bg-muted-foreground'
}
