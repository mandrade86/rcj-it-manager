import { useCallback, useEffect, useState } from 'react'

import {
  createApiEndpointITApi,
  createChecklistItemITApi,
  createDeudaTecnicaApi,
  createSistemaITApi,
  deleteDeudaTecnicaApi,
  deleteSistemaITApi,
  getApiEndpointsITApi,
  getChecklistItemsITApi,
  getDeudaTecnicaApi,
  getSistemasITApi,
  updateApiEndpointITApi,
  updateDeudaTecnicaApi,
  updateSistemaITApi,
} from '@/lib/api/itArquitectura'
import type {
  ApiEndpointIT,
  ChecklistItemIT,
  DeudaTecnica,
  JiraStatusResumen,
  SistemaIT,
} from '@/types/itArquitectura'

function useFetch<T>(fetchFn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchFn())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, reload: load }
}

export function useSistemasIT() {
  const { data: sistemas, loading, error, reload } = useFetch(getSistemasITApi)
  const [saving, setSaving] = useState(false)

  const update = async (id: string, body: Partial<SistemaIT>) => {
    setSaving(true)
    try {
      await updateSistemaITApi(id, body)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const create = async (body: Partial<SistemaIT>) => {
    setSaving(true)
    try {
      await createSistemaITApi(body)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    await deleteSistemaITApi(id)
    await reload()
  }

  return { sistemas: sistemas ?? [], loading, error, saving, update, create, remove, reload }
}

export function useDeudaTecnica() {
  const [deuda, setDeuda] = useState<DeudaTecnica[]>([])
  const [jiraResumen, setJiraResumen] = useState<JiraStatusResumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { items, jiraResumen: resumen } = await getDeudaTecnicaApi()
      setDeuda(items)
      setJiraResumen(resumen)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const update = async (id: string, body: Partial<DeudaTecnica>) => {
    setSaving(true)
    try {
      await updateDeudaTecnicaApi(id, body)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const create = async (body: Partial<DeudaTecnica>) => {
    setSaving(true)
    try {
      await createDeudaTecnicaApi(body)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    await deleteDeudaTecnicaApi(id)
    await reload()
  }

  const applySyncResult = (items: DeudaTecnica[], resumen: JiraStatusResumen) => {
    setDeuda(items)
    setJiraResumen(resumen)
  }

  return {
    deuda,
    jiraResumen,
    loading,
    error,
    saving,
    update,
    create,
    remove,
    reload,
    applySyncResult,
  }
}

export function useApiEndpointsIT() {
  const { data: endpoints, loading, error, reload } = useFetch(getApiEndpointsITApi)

  const create = async (body: Partial<ApiEndpointIT>) => {
    await createApiEndpointITApi(body)
    await reload()
  }

  const update = async (id: string, body: Partial<ApiEndpointIT>) => {
    await updateApiEndpointITApi(id, body)
    await reload()
  }

  return { endpoints: endpoints ?? [], loading, error, create, update, reload }
}

export function useChecklistItemsIT() {
  const { data: items, loading, error, reload } = useFetch(getChecklistItemsITApi)

  const create = async (body: Partial<ChecklistItemIT>) => {
    await createChecklistItemITApi(body)
    await reload()
  }

  return { items: items ?? [], loading, error, create, reload }
}
