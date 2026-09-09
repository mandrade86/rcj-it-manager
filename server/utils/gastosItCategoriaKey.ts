import type { GastosItCategoria } from '../db/models/GastosItCategoriaConfig.js'
import { findCategoriaNombre, findSubcategoriaNombre } from './gastosItCategorias.js'

/** Clave compuesta alineada con Presupuesto IT (categoria_id|subcategoria_id). */
export function categoriaCompositeKey(categoriaId: string, subcategoriaId?: string | null): string {
  return `${categoriaId}|${subcategoriaId ?? ''}`
}

/** Normaliza claves legacy de presupuesto/clasificación hacia la taxonomía actual. */
export function normalizarCategoriaPresupuestoKey(categoriaId: string, subcategoriaId?: string | null): string {
  const sub = subcategoriaId ?? ''
  if (categoriaId === 'infraestructura' && sub === 'ssl') {
    return categoriaCompositeKey('seguridad', 'ssl')
  }
  return categoriaCompositeKey(categoriaId, sub)
}

export function parseCategoriaCompositeKey(key: string): { categoria_id: string; subcategoria_id: string } {
  const [categoria_id, subcategoria_id = ''] = key.split('|')
  return { categoria_id, subcategoria_id }
}

export function labelCategoriaSubcategoria(
  categorias: GastosItCategoria[],
  categoriaId: string,
  subcategoriaId: string,
): { categoria: string; subcategoria: string; etiqueta: string } {
  const categoria = findCategoriaNombre(categorias, categoriaId)
  const subcategoria = subcategoriaId
    ? findSubcategoriaNombre(categorias, categoriaId, subcategoriaId)
    : ''
  const etiqueta = subcategoria ? `${categoria} → ${subcategoria}` : categoria
  return { categoria, subcategoria, etiqueta }
}

export function normalizarCategoriaPresupuestoIds(
  categoriaId: string,
  subcategoriaId?: string | null,
): { categoria_id: string; subcategoria_id: string } {
  const key = normalizarCategoriaPresupuestoKey(categoriaId, subcategoriaId)
  return parseCategoriaCompositeKey(key)
}
