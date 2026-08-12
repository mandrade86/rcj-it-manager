/**
 * Paleta BI costeo alineada al administrador RCJ
 * (navy / lime / ejes del Plan IT — sin naranjas vivos).
 */
export const BI_CHART = {
  navy: '#002060',
  lime: '#70AD47',
  /** Costo real / producción — azul infra suave */
  coral: '#1F4E79',
  /** Costo teórico — dorado soft del eje Software (apagado) */
  amber: '#7F6000',
  purple: '#4527A0',
  teal: '#0F6E56',
  magenta: '#375623',
  sky: '#3A6EA5',
  red: '#C00000',
  olive: '#547A3C',
  blueLt: '#DCE6F1',
} as const

/** Colores de ingredientes: tonalidades navy/lime/infra/gov/talento. */
export const INGREDIENT_COLORS = [
  BI_CHART.navy,
  BI_CHART.lime,
  BI_CHART.coral,
  BI_CHART.teal,
  BI_CHART.purple,
  BI_CHART.sky,
  BI_CHART.olive,
  BI_CHART.amber,
  BI_CHART.magenta,
  '#5B7C99',
]

export function ingredientColor(i: number): string {
  return INGREDIENT_COLORS[i % INGREDIENT_COLORS.length]!
}
