import type { CostosItFuente } from '../db/models/CostosItClasificacion.js'
import { CostosItClasificacion } from '../db/models/CostosItClasificacion.js'

export type TipoGasto = 'recurrente' | 'no_recurrente' | 'extraordinario'

export type ClasificacionGasto = {
  categoria_id: string
  subcategoria_id: string
  fuente: CostosItFuente | 'regla'
  confianza: number
}

type ReglaAvanzada = {
  categoria_id: string
  subcategoria_id: string
  patrones: RegExp[]
}

const REGLAS_PRIORITARIAS: ReglaAvanzada[] = [
  {
    categoria_id: 'software',
    subcategoria_id: 'sap',
    patrones: [/soporte\s+anual\s+control\s+presupuesto|control\s+presupuesto/i],
  },
  {
    categoria_id: 'seguridad',
    subcategoria_id: 'ssl',
    patrones: [
      /certificado\s+ssl\s+standard\s+wildcard/i,
      /certificado\s+ssl|ssl\s+standard|wildcard.*ssl|\bssl\b.*wildcard/i,
      /\bcertificado\s+digital\b/i,
      /\bssl\b.*\d+\s*meses/i,
      /\bssl\b/i,
    ],
  },
  { categoria_id: 'seguridad', subcategoria_id: 'gladium', patrones: [/gladi+um|glad\s*i+\s*um/i] },
  {
    categoria_id: 'seguridad',
    subcategoria_id: 'edr',
    patrones: [
      /\beset\b|eset\s+protect|mobile\s+threat\s+defense|cifrado\s+de\s+disco|sandboxing/i,
      /crowdstrike|sentinel|defender|antivirus|\bxdr\b/i,
    ],
  },
  {
    categoria_id: 'seguridad',
    subcategoria_id: 'edr',
    patrones: [/central intercept x|intercept x.*xdr|xdr for server/i],
  },
  {
    categoria_id: 'seguridad',
    subcategoria_id: 'otros_seg',
    patrones: [/central email advanced/i],
  },
  {
    categoria_id: 'telecom',
    subcategoria_id: 'telefonia',
    patrones: [/^l[ií]neas?$/i, /\bl[ií]neas?\b/i, /servicio de tel[eé]fono/i],
  },
  {
    categoria_id: 'telecom',
    subcategoria_id: 'movil',
    patrones: [
      /consumo\s+adicional/i,
      /cuota\s+m[ií]nima\s+de\s+consumo/i,
      /cuota\s+m[ií]nima.*consumo/i,
      /ventas?\s+en\s+plazos/i,
      /celular\s+presidencia/i,
      /l[ií]neas?\s+(tel|m[oó]vil|celular|fija|telef)/i,
    ],
  },
  {
    categoria_id: 'hardware',
    subcategoria_id: 'networking',
    patrones: [
      /cable de red|cable\s+(cat|utp|patch|ethernet)/i,
      /\b(switch|router|access point|punto de acceso|patch panel|rj-?45)\b/i,
    ],
  },
  {
    categoria_id: 'hardware',
    subcategoria_id: 'perifericos',
    patrones: [
      /cable de video|cable.*vga|vga\s*a\s*hdmi|hdmi.*vga/i,
      /adaptador.*hdmi|usb[\s-]*c.*hdmi|hdmi-mst|adaptador usb/i,
      /\b(teclado|mouse|rat[oó]n|headset|aud[ií]fono|cargador|dock\b|docking)\b/i,
      /\b(disco externo|usb flash|memoria usb|pendrive)\b/i,
      /\b(ups|regulador|estabilizador|fuente de poder|rack|gabinete)\b/i,
      /\b(logitech|apc|eaton|kingston|seagate|western digital)\b/i,
    ],
  },
  {
    categoria_id: 'hardware',
    subcategoria_id: 'computadoras',
    patrones: [
      /equipos?\s+de\s+c[oó]mputo|equipo\s+inform[aá]tico|equipos?\s+inform[aá]ticos/i,
      /\b(macbook|imac|ipad|surface|thinkpad|optiplex|latitude|inspiron|precision|elitebook)\b/i,
      /\b(ssd|hdd|disco\s+duro|memoria\s+ram|nvme)\b/i,
      /\b(cisco|synology|qnap|acer|asus|msi)\b/i,
    ],
  },
  {
    categoria_id: 'hardware',
    subcategoria_id: 'monitores',
    patrones: [/\b(monitor|pantalla|proyector|webcam)\b/i],
  },
  {
    categoria_id: 'hardware',
    subcategoria_id: 'impresoras',
    patrones: [/\b(scanner|esc[aá]ner|impresora|printer)\b/i],
  },
]

const REGLAS: ReglaAvanzada[] = [
  { categoria_id: 'software', subcategoria_id: 'microsoft', patrones: [/\b365\b|m365|office\s*365|microsoft\s*365|lof025|project\s*plan\s*3|91_visio|visio\s*online/i] },
  { categoria_id: 'software', subcategoria_id: 'microsoft', patrones: [/microsoft(?!.*azure)/i] },
  { categoria_id: 'software', subcategoria_id: 'sap', patrones: [/sap/i] },
  { categoria_id: 'software', subcategoria_id: 'powerbi', patrones: [/power\s*bi|powerbi/i] },
  { categoria_id: 'software', subcategoria_id: 'adobe', patrones: [/adobe/i] },
  { categoria_id: 'seguridad', subcategoria_id: 'edr', patrones: [/crowdstrike|sentinel|defender|antivirus|\bxdr\b|\beset\b|eset\s+protect/i] },
  { categoria_id: 'seguridad', subcategoria_id: 'firewall', patrones: [/firewall/i] },
  { categoria_id: 'software', subcategoria_id: 'saas', patrones: [/saas|suscripci[oó]n/i] },
  { categoria_id: 'software', subcategoria_id: 'dev_tools', patrones: [/github|gitlab|jira|confluence|postman|visual studio/i] },
  { categoria_id: 'infraestructura', subcategoria_id: 'cloud', patrones: [/aws|amazon web|ec2|azure(?! ad)|google cloud|gcp/i] },
  { categoria_id: 'infraestructura', subcategoria_id: 'hosting', patrones: [/hosting|datacenter|colocation/i] },
  { categoria_id: 'infraestructura', subcategoria_id: 'dominios', patrones: [/dominio|domain|\.hn\b|renovaci[oó]n.*dominio/i] },
  { categoria_id: 'infraestructura', subcategoria_id: 'backup', patrones: [/backup|respaldo|veeam/i] },
  { categoria_id: 'infraestructura', subcategoria_id: 'storage', patrones: [/storage|almacenamiento|nas|san/i] },
  { categoria_id: 'infraestructura', subcategoria_id: 'servidores', patrones: [/servidor f[ií]sico|servidor físico|server hardware/i] },
  { categoria_id: 'infraestructura', subcategoria_id: 'internet', patrones: [/internet|wan|mpls|fibra|enlace/i] },
  { categoria_id: 'infraestructura', subcategoria_id: 'redes', patrones: [/\bred\b.*servicio|network.*service/i] },
  { categoria_id: 'impresion', subcategoria_id: 'arrendamiento', patrones: [/sumitec|arrendamiento de impresi[oó]n|servicio de equipo de arrendamiento/i] },
  { categoria_id: 'impresion', subcategoria_id: 'consumibles', patrones: [/volumen de copiado|copiado|toner|t[oó]ner/i] },
  { categoria_id: 'hardware', subcategoria_id: 'leasing', patrones: [/srv_renta_dell|leasing|renta.*dell/i] },
  { categoria_id: 'hardware', subcategoria_id: 'computadoras', patrones: [/computadora|desktop|pc\b|dell|hp |lenovo|tablet|notebook|port[aá]til/i] },
  { categoria_id: 'hardware', subcategoria_id: 'monitores', patrones: [/monitor|pantalla/i] },
  { categoria_id: 'hardware', subcategoria_id: 'networking', patrones: [/switch|router|access point|wifi|cable de red|cable\s+(cat|utp|patch)/i] },
  { categoria_id: 'hardware', subcategoria_id: 'impresoras', patrones: [/impresora|printer/i] },
  { categoria_id: 'hardware', subcategoria_id: 'perifericos', patrones: [/teclado|mouse|dock|ups|perif|cable de video|adaptador|vga|hdmi-mst|compra de equipo|perif[eé]rico/i] },
  { categoria_id: 'servicios', subcategoria_id: 'consultoria', patrones: [/consultor[ií]a|consulting/i] },
  { categoria_id: 'servicios', subcategoria_id: 'soporte_ext', patrones: [/soporte externo|help\s*desk|outsourcing|terceriz/i] },
  { categoria_id: 'servicios', subcategoria_id: 'desarrollo_ext', patrones: [/desarrollo externo|honorario/i] },
  { categoria_id: 'servicios', subcategoria_id: 'implementaciones', patrones: [/implementaci[oó]n|migraci[oó]n/i] },
  { categoria_id: 'servicios', subcategoria_id: 'servicios_tec', patrones: [/servicio t[eé]cnico|mantenim/i] },
  { categoria_id: 'telecom', subcategoria_id: 'telefonia', patrones: [/telefon[ií]a|pbx|central telef|\blineas\b/i] },
  { categoria_id: 'telecom', subcategoria_id: 'internet_tel', patrones: [/claro|tigo|hondutel|internet/i] },
  { categoria_id: 'telecom', subcategoria_id: 'movil', patrones: [/m[oó]vil|celular|datos m[oó]vil|consumo\s+adicional|cuota\s+m[ií]nima|ventas?\s+en\s+plazos|celular\s+presidencia/i] },
  { categoria_id: 'personal', subcategoria_id: 'capacitacion', patrones: [/capacitaci[oó]n|\bcurso\b|udemy|training|formaci[oó]n/i] },
  { categoria_id: 'personal', subcategoria_id: 'viaticos', patrones: [/vi[aá]tico|hospedaje|hotel/i] },
  { categoria_id: 'personal', subcategoria_id: 'transporte', patrones: [/transporte|combustible|peaje/i] },
  { categoria_id: 'personal', subcategoria_id: 'operativos', patrones: [/salario|n[oó]mina|planilla/i] },
]

function textoFila(fila: {
  descripcion: string
  proveedor: string
  cuenta: string
  categoria_origen: string
  tipo: string
}): string {
  return [fila.descripcion, fila.proveedor, fila.cuenta, fila.categoria_origen, fila.tipo]
    .filter(Boolean)
    .join(' ')
}

export function clasificarSoporteControlPresupuestoAvanzado(categoriaOrigen?: string): ClasificacionGasto {
  if (categoriaOrigen?.trim()) {
    const desdeSap = clasificarPorCategoriaSap(categoriaOrigen)
    if (desdeSap) return desdeSap
  }
  return { categoria_id: 'software', subcategoria_id: 'sap', fuente: 'regla', confianza: 0.98 }
}

export function clasificarPorCategoriaSap(origen: string): ClasificacionGasto | null {
  const t = origen.trim().toLowerCase()
  if (!t) return null
  if (/^l[ií]neas?$/.test(t) || t === 'lineas' || t === 'líneas') {
    return { categoria_id: 'telecom', subcategoria_id: 'telefonia', fuente: 'regla', confianza: 0.98 }
  }
  if (/certificado\s+ssl|ssl\s+standard|wildcard|\bssl\b/i.test(t)) {
    return { categoria_id: 'seguridad', subcategoria_id: 'ssl', fuente: 'regla', confianza: 0.98 }
  }
  if (
    /^hardware$|^equipos?$|^equipo$|^perif[eé]ricos?$|^accesorios?$|^computadoras?$|^networking$/.test(
      t,
    )
  ) {
    return { categoria_id: 'hardware', subcategoria_id: 'computadoras', fuente: 'regla', confianza: 0.98 }
  }
  if (
    /computadoras?|c[oó]mputo|inform[aá]tica|perif[eé]rico|accesorio/.test(t) &&
    !/licen|software|servicio|arrendamiento|impres/i.test(t)
  ) {
    return { categoria_id: 'hardware', subcategoria_id: 'computadoras', fuente: 'regla', confianza: 0.92 }
  }
  if (/control\s*presupuesto|presupuesto\s*sap|soporte\s+anual\s+control/i.test(t)) {
    return { categoria_id: 'software', subcategoria_id: 'sap', fuente: 'regla', confianza: 0.98 }
  }
  if (t === 'sap' || /^software\s*sap$/.test(t) || /\bsap\b/.test(t)) {
    return { categoria_id: 'software', subcategoria_id: 'sap', fuente: 'regla', confianza: 0.95 }
  }
  if (/licen|soft/i.test(t)) {
    return { categoria_id: 'software', subcategoria_id: 'saas', fuente: 'regla', confianza: 0.9 }
  }
  if (/manten|soporte/i.test(t) && !/control\s*presupuesto|presupuesto/i.test(t)) {
    return { categoria_id: 'servicios', subcategoria_id: 'soporte_ext', fuente: 'regla', confianza: 0.9 }
  }
  if (/^antivirus$/.test(t) || t === 'antivirus') {
    return { categoria_id: 'seguridad', subcategoria_id: 'edr', fuente: 'regla', confianza: 0.98 }
  }
  if (/seguridad|ssl|certificado\s+digital|wildcard|\beset\b/i.test(t)) {
    return { categoria_id: 'seguridad', subcategoria_id: 'otros_seg', fuente: 'regla', confianza: 0.9 }
  }
  if (/hardware|equipo/i.test(t) && !/arrendamiento|impres/i.test(t)) {
    return { categoria_id: 'hardware', subcategoria_id: 'perifericos', fuente: 'regla', confianza: 0.85 }
  }
  if (/consumo\s+adicional|cuota\s+m[ií]nima|ventas?\s+en\s+plazos|celular\s+presidencia/i.test(t)) {
    return { categoria_id: 'telecom', subcategoria_id: 'movil', fuente: 'regla', confianza: 0.92 }
  }
  if (/telecom|comunicac|tel[eé]fon|lineas|líneas/i.test(t)) {
    return { categoria_id: 'telecom', subcategoria_id: 'telefonia', fuente: 'regla', confianza: 0.85 }
  }
  return null
}

export function clasificarPorReglasAvanzadas(fila: {
  descripcion: string
  proveedor: string
  cuenta: string
  categoria_origen: string
  tipo: string
}): ClasificacionGasto | null {
  const texto = textoFila(fila)
  if (!texto.trim()) return null
  for (const regla of REGLAS_PRIORITARIAS) {
    if (regla.patrones.some((p) => p.test(texto))) {
      return {
        categoria_id: regla.categoria_id,
        subcategoria_id: regla.subcategoria_id,
        fuente: 'regla',
        confianza: 0.95,
      }
    }
  }
  for (const regla of REGLAS) {
    if (regla.patrones.some((p) => p.test(texto))) {
      return {
        categoria_id: regla.categoria_id,
        subcategoria_id: regla.subcategoria_id,
        fuente: 'regla',
        confianza: 0.92,
      }
    }
  }
  return null
}

export async function loadClasificacionesAvanzadasMap(hashes: string[]): Promise<
  Map<
    string,
    {
      categoria_id: string
      subcategoria_id: string
      tipo_gasto: TipoGasto | ''
      fuente: CostosItFuente
      confianza: number
    }
  >
> {
  const map = new Map<
    string,
    {
      categoria_id: string
      subcategoria_id: string
      tipo_gasto: TipoGasto | ''
      fuente: CostosItFuente
      confianza: number
    }
  >()
  if (!hashes.length) return map
  const rows = await CostosItClasificacion.find({ row_hash: { $in: hashes } }).lean()
  for (const r of rows) {
    const cat = r.categoria
    const parts = cat.includes('|') ? cat.split('|') : [cat, r.subcategoria ?? '']
    map.set(r.row_hash, {
      categoria_id: parts[0] ?? cat,
      subcategoria_id: parts[1] ?? (r.subcategoria ?? ''),
      tipo_gasto: (r.tipo_gasto as TipoGasto) ?? '',
      fuente: r.fuente as CostosItFuente,
      confianza: r.confianza ?? 1,
    })
  }
  return map
}

export async function saveClasificacionAvanzada(item: {
  row_hash: string
  categoria_id: string
  subcategoria_id: string
  tipo_gasto?: TipoGasto | ''
  fuente: CostosItFuente
  confianza?: number
}): Promise<void> {
  await CostosItClasificacion.findOneAndUpdate(
    { row_hash: item.row_hash },
    {
      $set: {
        categoria: `${item.categoria_id}|${item.subcategoria_id}`,
        subcategoria: item.subcategoria_id,
        tipo_gasto: item.tipo_gasto ?? '',
        fuente: item.fuente,
        confianza: item.confianza ?? 1,
      },
    },
    { upsert: true },
  )
}

export const POR_CLASIFICAR: ClasificacionGasto = {
  categoria_id: 'por_clasificar',
  subcategoria_id: 'pendiente',
  fuente: 'regla',
  confianza: 0,
}

export const OTROS: ClasificacionGasto = {
  categoria_id: 'otros',
  subcategoria_id: 'no_clasificado',
  fuente: 'regla',
  confianza: 0.5,
}
