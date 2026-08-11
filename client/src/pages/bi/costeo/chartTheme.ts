/** Paleta viva para BI costeo — decisiones visuales rápidas. */
export const BI_CHART = {
  navy: '#002060',
  lime: '#70AD47',
  coral: '#FF6B35',
  amber: '#FFB020',
  purple: '#7C3AED',
  teal: '#0D9488',
  magenta: '#DB2777',
  sky: '#0284C7',
  red: '#C00000',
  olive: '#375623',
} as const

export const INGREDIENT_COLORS = [
  BI_CHART.coral,
  BI_CHART.amber,
  BI_CHART.lime,
  BI_CHART.purple,
  BI_CHART.teal,
  BI_CHART.magenta,
  BI_CHART.sky,
  BI_CHART.red,
  BI_CHART.navy,
  BI_CHART.olive,
]

export function ingredientColor(i: number): string {
  return INGREDIENT_COLORS[i % INGREDIENT_COLORS.length]!
}
