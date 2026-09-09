import crypto from 'crypto'

import { CostosItClasificacion, type CostosItFuente } from '../db/models/CostosItClasificacion.js'

export const CATEGORIAS_IT = [
  'Microsoft 365',
  'Impresión',
  'Leasing de equipo',
  'Seguridad',
  'Licencias y software',
  'Cloud y hosting',
  'Hardware y equipos',
  'Comunicaciones',
  'Servicios y tercerización',
  'Capacitación',
  'Mantenimiento y soporte',
  'Personal y nómina',
  'Otros',
] as const

export type CategoriaIt = (typeof CATEGORIAS_IT)[number]

export type CostosItFila = {
  row_hash: string
  fecha: string | null
  anio: number | null
  monto: number
  descripcion: string
  proveedor: string
  documento: string
  cuenta: string
  empresa: string
  categoria_origen: string
  departamento: string
  tipo: string
  categoria: string
  fuente_categoria: CostosItFuente | 'pendiente'
  confianza: number
}

type Regla = { categoria: CategoriaIt; patrones: RegExp[] }

/** Descripciones que deben clasificarse con la categoría SAP (columna categoria_sap). */
export const PATRON_DESCRIPCION_CATEGORIA_SAP =
  /soporte\s+anual\s+control\s+presupuesto|control\s+presupuesto/i

export function debeUsarCategoriaSap(
  fila: Pick<CostosItFila, 'descripcion'>,
): boolean {
  return PATRON_DESCRIPCION_CATEGORIA_SAP.test(fila.descripcion)
}

export function clasificarSoporteControlPresupuesto(categoriaOrigen?: string): {
  categoria: CategoriaIt
  confianza: number
} {
  if (categoriaOrigen?.trim()) {
    const desdeVista = aplicarCategoriaOrigen(categoriaOrigen)
    if (desdeVista) return desdeVista
  }
  return { categoria: 'Licencias y software', confianza: 0.98 }
}

/** Reglas de negocio RCJ IT — se evalúan primero. */
const REGLAS_PRIORITARIAS: Regla[] = [
  {
    categoria: 'Licencias y software',
    patrones: [/soporte\s+anual\s+control\s+presupuesto|control\s+presupuesto/i],
  },
  {
    categoria: 'Seguridad',
    patrones: [
      /certificado\s+ssl\s+standard\s+wildcard/i,
      /certificado\s+ssl|ssl\s+standard|wildcard.*ssl|\bssl\b.*wildcard/i,
      /\bcertificado\s+digital\b/i,
      /\bssl\b.*\d+\s*meses/i,
    ],
  },
  {
    categoria: 'Microsoft 365',
    patrones: [
      /\b365\b|microsoft\s*365|office\s*365|m365/i,
      /lof025/i,
      /project\s*plan\s*3/i,
      /91_visio/i,
      /visio\s*online\s*plan\s*2/i,
    ],
  },
  {
    categoria: 'Impresión',
    patrones: [
      /sumitec/i,
      /servicio de equipo de arrendamiento de impresi[oó]n/i,
      /arrendamiento de impresi[oó]n/i,
      /volumen de copiado/i,
    ],
  },
  {
    categoria: 'Leasing de equipo',
    patrones: [/srv_renta_dell/i],
  },
  {
    categoria: 'Seguridad',
    patrones: [
      /\beset\b|eset\s+protect|mobile\s+threat\s+defense/i,
      /gladi+um|glad\s*i+\s*um/i,
      /central intercept x/i,
      /intercept x.*xdr/i,
      /xdr for server/i,
      /central email advanced/i,
    ],
  },
  {
    categoria: 'Comunicaciones',
    patrones: [
      /consumo\s+adicional/i,
      /cuota\s+m[ií]nima\s+de\s+consumo/i,
      /cuota\s+m[ií]nima.*consumo/i,
      /ventas?\s+en\s+plazos/i,
      /celular\s+presidencia/i,
      /servicio de tel[eé]fono/i,
      /^l[ií]neas?$/i,
      /\bl[ií]neas?\b/i,
      /l[ií]neas?\s+(tel|m[oó]vil|celular|fija|telef)/i,
    ],
  },
  {
    categoria: 'Hardware y equipos',
    patrones: [
      /cable de red|cable\s+(cat|utp|patch|ethernet)/i,
      /cable de video|cable.*vga|vga\s*a\s*hdmi|hdmi.*vga/i,
      /adaptador.*hdmi|usb[\s-]*c.*hdmi|hdmi-mst|adaptador usb/i,
      /equipos?\s+de\s+c[oó]mputo|equipo\s+inform[aá]tico|equipos?\s+inform[aá]ticos/i,
      /\b(macbook|imac|ipad|surface|thinkpad|optiplex|latitude|inspiron|precision|elitebook)\b/i,
      /\b(ssd|hdd|disco\s+duro|memoria\s+ram|nvme)\b/i,
      /\b(switch|router|access point|punto de acceso|patch panel|rj-?45)\b/i,
      /\b(monitor|pantalla|proyector|webcam|scanner|esc[aá]ner)\b/i,
      /\b(teclado|mouse|rat[oó]n|headset|aud[ií]fono|cargador|dock\b|docking)\b/i,
      /\b(ups|regulador|estabilizador|fuente de poder|rack|gabinete)\b/i,
      /\b(disco externo|usb flash|memoria usb|pendrive)\b/i,
      /\b(cisco|logitech|synology|qnap|apc|eaton|acer|asus|msi|kingston|seagate|western digital)\b/i,
    ],
  },
]

const REGLAS: Regla[] = [
  {
    categoria: 'Seguridad',
    patrones: [/antivirus|crowdstrike|sentinel|defender|firewall|edr|seguridad|\bssl\b|certificado\s+ssl|\beset\b|eset\s+protect/i],
  },
  {
    categoria: 'Licencias y software',
    patrones: [
      /microsoft|azure\s*ad|adobe|sap|oracle|licencia|license|vmware/i,
    ],
  },
  {
    categoria: 'Cloud y hosting',
    patrones: [/aws|amazon web|azure(?! ad)|google cloud|gcp|hosting|datacenter|colocation|digitalocean/i],
  },
  {
    categoria: 'Hardware y equipos',
    patrones: [
      /dell|hp |hewlett|lenovo|laptop|computadora|servidor|switch|router|ups|monitor|hardware|equipo|cable de red|cable de video|adaptador|vga|hdmi-mst/i,
      /\bcompra de equipo\b|\bperif[eé]rico\b|\btablet\b|\bnotebook\b|\bport[aá]til\b/i,
    ],
  },
  {
    categoria: 'Comunicaciones',
    patrones: [/claro|tigo|hondutel|internet|wan|mpls|fibra|telecom|enlace|conectividad|datos m[oó]vil|tel[eé]fon|pbx|\blineas\b|consumo\s+adicional|cuota\s+m[ií]nima|ventas?\s+en\s+plazos|celular\s+presidencia/i],
  },
  {
    categoria: 'Servicios y tercerización',
    patrones: [/consultor|outsourcing|terceriz|servicio profesional|honorario|soporte externo/i],
  },
  {
    categoria: 'Capacitación',
    patrones: [/capacitaci[oó]n|\bcurso\b|udemy|training|formaci[oó]n|seminario/i],
  },
  {
    categoria: 'Mantenimiento y soporte',
    patrones: [/mantenim|soporte técnico|help\s*desk|garantía|reparación/i],
  },
  {
    categoria: 'Personal y nómina',
    patrones: [/salario|nómina|nomina|planilla|bonificación|prestación/i],
  },
]

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export function rowHash(parts: (string | number | null | undefined)[]): string {
  const raw = parts.map((p) => String(p ?? '').trim()).join('|')
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24)
}

function textoParaReglas(fila: Pick<CostosItFila, 'descripcion' | 'proveedor' | 'cuenta' | 'categoria_origen' | 'tipo'>): string {
  return [fila.descripcion, fila.proveedor, fila.cuenta, fila.categoria_origen, fila.tipo]
    .filter(Boolean)
    .join(' ')
}

function matchReglas(texto: string, reglas: Regla[]): { categoria: CategoriaIt; confianza: number } | null {
  if (!texto.trim()) return null
  for (const regla of reglas) {
    if (regla.patrones.some((p) => p.test(texto))) {
      return { categoria: regla.categoria, confianza: 0.92 }
    }
  }
  return null
}

export function categorizarPorReglas(
  fila: Pick<CostosItFila, 'descripcion' | 'proveedor' | 'cuenta' | 'categoria_origen' | 'tipo'>,
): { categoria: CategoriaIt; confianza: number } | null {
  const texto = textoParaReglas(fila)
  return matchReglas(texto, REGLAS_PRIORITARIAS) ?? matchReglas(texto, REGLAS)
}

/** Solo reglas de negocio prioritarias (antes que categoría SAP). */
export function categorizarPorReglasPrioritarias(
  fila: Pick<CostosItFila, 'descripcion' | 'proveedor' | 'cuenta' | 'categoria_origen' | 'tipo'>,
): { categoria: CategoriaIt; confianza: number } | null {
  const texto = textoParaReglas(fila)
  return matchReglas(texto, REGLAS_PRIORITARIAS)
}

function mapCategoriaOrigen(origen: string): CategoriaIt | null {
  const t = norm(origen)
  if (!t) return null
  if (/^l[ií]neas?$/.test(t) || t === 'lineas' || t === 'líneas') return 'Comunicaciones'
  if (/certificado\s+ssl|ssl\s+standard|wildcard|\bssl\b/i.test(t)) return 'Seguridad'
  if (/consumo\s+adicional|cuota\s+m[ií]nima|ventas?\s+en\s+plazos|celular\s+presidencia|comunicac/i.test(t)) return 'Comunicaciones'
  if (
    /^hardware$|^equipos?$|^equipo$|^perif[eé]ricos?$|^accesorios?$|^computadoras?$|^networking$/.test(
      t,
    )
  ) {
    return 'Hardware y equipos'
  }
  if (
    /computadoras?|c[oó]mputo|inform[aá]tica|perif[eé]rico|accesorio/.test(t) &&
    !/licen|software|servicio|arrendamiento|impres/i.test(t)
  ) {
    return 'Hardware y equipos'
  }
  if (t === 'sap' || /^software\s*sap$/.test(t)) return 'Licencias y software'
  if (/control\s*presupuesto|presupuesto\s*sap|soporte\s+anual\s+control/i.test(t)) return 'Licencias y software'
  for (const cat of CATEGORIAS_IT) {
    if (t.includes(norm(cat)) || norm(cat).includes(t)) return cat
  }
  if (/365|microsoft|lof025|project\s*plan|visio/i.test(t)) return 'Microsoft 365'
  if (/\bsap\b/i.test(t)) return 'Licencias y software'
  if (/impres|sumitec|volumen de copiado/i.test(t)) return 'Impresión'
  if (/leasing|renta.*dell/i.test(t)) return 'Leasing de equipo'
  if (/^antivirus$|^antivirus\s/i.test(t) || t === 'antivirus') return 'Seguridad'
  if (/gladi+um|glad\s*i+\s*um|seguridad|intercept x|xdr for server|central email advanced|ssl|certificado\s+digital|wildcard|\beset\b/i.test(t)) return 'Seguridad'
  if (/licen|soft/i.test(t)) return 'Licencias y software'
  if (/cloud|host/i.test(t)) return 'Cloud y hosting'
  if (/hard|equip|cable de red|cable de video|adaptador|vga|hdmi/i.test(t)) return 'Hardware y equipos'
  if (/conect|telecom|comunicac|tel[eé]fon|l[ií]nea/i.test(t)) return 'Comunicaciones'
  if (/servic|tercer/i.test(t)) return 'Servicios y tercerización'
  if (/capacit|capacitaci[oó]n|\bcurso\b/i.test(t)) return 'Capacitación'
  if (/manten|soporte/i.test(t) && !/control\s*presupuesto|presupuesto/i.test(t)) return 'Mantenimiento y soporte'
  if (/person|nomina|salario/i.test(t)) return 'Personal y nómina'
  return null
}

export async function loadClasificacionesMap(
  hashes: string[],
): Promise<Map<string, { categoria: string; fuente: CostosItFuente; confianza: number }>> {
  const map = new Map<string, { categoria: string; fuente: CostosItFuente; confianza: number }>()
  if (!hashes.length) return map
  const rows = await CostosItClasificacion.find({ row_hash: { $in: hashes } }).lean()
  for (const r of rows) {
    map.set(r.row_hash, {
      categoria: normalizarCategoriaPlana(r.categoria),
      fuente: r.fuente as CostosItFuente,
      confianza: r.confianza ?? 1,
    })
  }
  return map
}

export async function saveClasificaciones(
  items: Array<{ row_hash: string; categoria: string; fuente: CostosItFuente; confianza?: number }>,
): Promise<void> {
  if (!items.length) return
  const ops = items.map((item) => ({
    updateOne: {
      filter: { row_hash: item.row_hash },
      update: {
        $set: {
          categoria: item.categoria,
          fuente: item.fuente,
          confianza: item.confianza ?? 1,
        },
      },
      upsert: true,
    },
  }))
  await CostosItClasificacion.bulkWrite(ops)
}

export function normalizarCategoriaPlana(categoria: string): string {
  if (!categoria.includes('|')) return categoria
  const map: Record<string, CategoriaIt> = {
    'software|microsoft': 'Microsoft 365',
    'software|sap': 'Licencias y software',
    'software|powerbi': 'Licencias y software',
    'software|adobe': 'Licencias y software',
    'software|saas': 'Licencias y software',
    'software|dev_tools': 'Licencias y software',
    'software|antivirus': 'Seguridad',
    'seguridad|gladium': 'Seguridad',
    'seguridad|edr': 'Seguridad',
    'seguridad|firewall': 'Seguridad',
    'seguridad|ssl': 'Seguridad',
    'seguridad|otros_seg': 'Seguridad',
    'infraestructura|ssl': 'Seguridad',
    'impresion|arrendamiento': 'Impresión',
    'impresion|consumibles': 'Impresión',
    'hardware|leasing': 'Leasing de equipo',
    'hardware|computadoras': 'Hardware y equipos',
    'hardware|laptops': 'Hardware y equipos',
    'hardware|monitores': 'Hardware y equipos',
    'hardware|impresoras': 'Hardware y equipos',
    'hardware|networking': 'Hardware y equipos',
    'hardware|perifericos': 'Hardware y equipos',
    'infraestructura|redes': 'Hardware y equipos',
    'infraestructura|servidores': 'Hardware y equipos',
    'telecom|telefonia': 'Comunicaciones',
    'telecom|movil': 'Comunicaciones',
    'telecom|internet_tel': 'Comunicaciones',
  }
  return map[categoria] ?? categoria
}

export function aplicarCategoriaOrigen(origen: string): { categoria: CategoriaIt; confianza: number } | null {
  const cat = mapCategoriaOrigen(origen)
  if (!cat) return null
  return { categoria: cat, confianza: 0.95 }
}
