import type { GastosItCategoria } from '../db/models/GastosItCategoriaConfig.js'
import { GastosItCategoriaConfig } from '../db/models/GastosItCategoriaConfig.js'

export const CATEGORIAS_GASTOS_IT_DEFAULT: GastosItCategoria[] = [
  {
    id: 'infraestructura',
    nombre: 'Infraestructura',
    activo: true,
    subcategorias: [
      { id: 'servidores', nombre: 'Servidores', activo: true },
      { id: 'cloud', nombre: 'Cloud', activo: true },
      { id: 'hosting', nombre: 'Hosting', activo: true },
      { id: 'dominios', nombre: 'Dominios', activo: true },
      { id: 'backup', nombre: 'Backup', activo: true },
      { id: 'storage', nombre: 'Storage', activo: true },
      { id: 'redes', nombre: 'Redes', activo: true },
      { id: 'internet', nombre: 'Internet', activo: true },
      { id: 'datacenter', nombre: 'Data Center', activo: true },
    ],
  },
  {
    id: 'software',
    nombre: 'Software y Licencias',
    activo: true,
    subcategorias: [
      { id: 'microsoft', nombre: 'Microsoft', activo: true },
      { id: 'sap', nombre: 'SAP', activo: true },
      { id: 'powerbi', nombre: 'Power BI', activo: true },
      { id: 'adobe', nombre: 'Adobe', activo: true },
      { id: 'antivirus', nombre: 'Antivirus / EDR', activo: true },
      { id: 'dev_tools', nombre: 'Herramientas de desarrollo', activo: true },
      { id: 'mgmt_tools', nombre: 'Herramientas de gestión', activo: true },
      { id: 'saas', nombre: 'SaaS', activo: true },
      { id: 'suscripciones', nombre: 'Suscripciones', activo: true },
    ],
  },
  {
    id: 'hardware',
    nombre: 'Hardware',
    activo: true,
    subcategorias: [
      { id: 'computadoras', nombre: 'Computadoras', activo: true },
      { id: 'laptops', nombre: 'Laptops', activo: true },
      { id: 'monitores', nombre: 'Monitores', activo: true },
      { id: 'servidores_hw', nombre: 'Servidores', activo: true },
      { id: 'networking', nombre: 'Networking', activo: true },
      { id: 'perifericos', nombre: 'Periféricos', activo: true },
      { id: 'impresoras', nombre: 'Impresoras', activo: true },
      { id: 'leasing', nombre: 'Leasing de equipo', activo: true },
    ],
  },
  {
    id: 'servicios',
    nombre: 'Servicios profesionales',
    activo: true,
    subcategorias: [
      { id: 'consultoria', nombre: 'Consultoría', activo: true },
      { id: 'soporte_ext', nombre: 'Soporte externo', activo: true },
      { id: 'desarrollo_ext', nombre: 'Desarrollo externo', activo: true },
      { id: 'implementaciones', nombre: 'Implementaciones', activo: true },
      { id: 'servicios_tec', nombre: 'Servicios técnicos', activo: true },
    ],
  },
  {
    id: 'telecom',
    nombre: 'Comunicaciones',
    activo: true,
    subcategorias: [
      { id: 'telefonia', nombre: 'Telefonía', activo: true },
      { id: 'internet_tel', nombre: 'Internet', activo: true },
      { id: 'movil', nombre: 'Servicios móviles', activo: true },
    ],
  },
  {
    id: 'personal',
    nombre: 'Personal / Operación',
    activo: true,
    subcategorias: [
      { id: 'capacitacion', nombre: 'Capacitación', activo: true },
      { id: 'viaticos', nombre: 'Viáticos', activo: true },
      { id: 'transporte', nombre: 'Transporte', activo: true },
      { id: 'operativos', nombre: 'Otros gastos operativos', activo: true },
    ],
  },
  {
    id: 'seguridad',
    nombre: 'Seguridad',
    activo: true,
    subcategorias: [
      { id: 'gladium', nombre: 'Gladium', activo: true },
      { id: 'edr', nombre: 'EDR / Antivirus', activo: true },
      { id: 'firewall', nombre: 'Firewall', activo: true },
      { id: 'ssl', nombre: 'Certificados SSL', activo: true },
      { id: 'otros_seg', nombre: 'Otros servicios de seguridad', activo: true },
    ],
  },
  {
    id: 'impresion',
    nombre: 'Impresión',
    activo: true,
    subcategorias: [
      { id: 'arrendamiento', nombre: 'Arrendamiento impresión', activo: true },
      { id: 'consumibles', nombre: 'Consumibles / copiado', activo: true },
    ],
  },
  {
    id: 'otros',
    nombre: 'Otros',
    activo: true,
    subcategorias: [{ id: 'no_clasificado', nombre: 'Gastos no clasificados', activo: true }],
  },
  {
    id: 'por_clasificar',
    nombre: 'Por clasificar',
    activo: true,
    subcategorias: [{ id: 'pendiente', nombre: 'Pendiente de clasificación', activo: true }],
  },
]

export async function loadGastosItCategorias(): Promise<GastosItCategoria[]> {
  const doc = await GastosItCategoriaConfig.findOne({ clave: 'gastos_it_categorias' }).lean()
  if (doc?.categorias?.length) return doc.categorias as GastosItCategoria[]
  return CATEGORIAS_GASTOS_IT_DEFAULT
}

export async function ensureGastosItCategorias(): Promise<void> {
  const doc = await GastosItCategoriaConfig.findOne({ clave: 'gastos_it_categorias' }).lean()
  if (!doc) {
    await GastosItCategoriaConfig.create({ clave: 'gastos_it_categorias', categorias: CATEGORIAS_GASTOS_IT_DEFAULT })
    return
  }
  const ids = new Set((doc.categorias ?? []).map((c) => c.id))
  const faltantes = CATEGORIAS_GASTOS_IT_DEFAULT.filter((c) => !ids.has(c.id))
  if (faltantes.length) {
    await GastosItCategoriaConfig.updateOne(
      { clave: 'gastos_it_categorias' },
      { $push: { categorias: { $each: faltantes } } },
    )
  }

  // Migrar subcategoría SSL de Infraestructura → Seguridad (taxonomía de Presupuesto IT)
  const doc2 = await GastosItCategoriaConfig.findOne({ clave: 'gastos_it_categorias' }).lean()
  if (doc2?.categorias?.length) {
    const categorias = doc2.categorias as GastosItCategoria[]
    let changed = false
    for (const cat of categorias) {
      if (cat.id === 'infraestructura') {
        const sslIdx = cat.subcategorias.findIndex((s) => s.id === 'ssl')
        if (sslIdx >= 0) {
          cat.subcategorias.splice(sslIdx, 1)
          changed = true
        }
      }
      if (cat.id === 'seguridad') {
        const hasSsl = cat.subcategorias.some((s) => s.id === 'ssl')
        if (!hasSsl) {
          cat.subcategorias.push({ id: 'ssl', nombre: 'Certificados SSL', activo: true })
          changed = true
        }
      }
    }
    if (changed) {
      await GastosItCategoriaConfig.updateOne(
        { clave: 'gastos_it_categorias' },
        { $set: { categorias } },
      )
    }
  }
}

export function findCategoriaNombre(categorias: GastosItCategoria[], catId: string): string {
  return categorias.find((c) => c.id === catId)?.nombre ?? catId
}

export function findSubcategoriaNombre(
  categorias: GastosItCategoria[],
  catId: string,
  subId: string,
): string {
  const cat = categorias.find((c) => c.id === catId)
  return cat?.subcategorias.find((s) => s.id === subId)?.nombre ?? subId
}

export function flattenCategorias(categorias: GastosItCategoria[]): Array<{
  categoria_id: string
  categoria: string
  subcategoria_id: string
  subcategoria: string
}> {
  const out: Array<{
    categoria_id: string
    categoria: string
    subcategoria_id: string
    subcategoria: string
  }> = []
  for (const cat of categorias) {
    if (!cat.activo) continue
    for (const sub of cat.subcategorias) {
      if (!sub.activo) continue
      out.push({
        categoria_id: cat.id,
        categoria: cat.nombre,
        subcategoria_id: sub.id,
        subcategoria: sub.nombre,
      })
    }
  }
  return out
}
