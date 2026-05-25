import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { fetchProyecto } from '@/lib/api/proyectos'
import { ProyectoFormDialog } from '@/pages/proyectos/ProyectoFormDialog'
import { useProyectosStore } from '@/store/proyectosStore'
import type { Proyecto } from '@/types/proyecto'

export function ProyectoFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [editing, setEditing] = useState<Proyecto | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(isEdit)

  useEffect(() => {
    if (!isEdit || !id) {
      setEditing(null)
      setLoadErr(null)
      setLoadingEdit(false)
      return
    }
    let cancel = false
    setLoadingEdit(true)
    void fetchProyecto(id)
      .then((p) => {
        if (!cancel) {
          setEditing(p)
          setLoadErr(null)
        }
      })
      .catch((e) => {
        if (!cancel) {
          setLoadErr(e instanceof Error ? e.message : 'Error al cargar')
          setEditing(null)
        }
      })
      .finally(() => {
        if (!cancel) setLoadingEdit(false)
      })
    return () => {
      cancel = true
    }
  }, [isEdit, id])

  if (isEdit && loadingEdit) {
    return <p className="text-sm text-muted-foreground">Cargando proyecto…</p>
  }
  if (isEdit && loadErr) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <p className="text-sm text-destructive">{loadErr}</p>
        <Button type="button" variant="outline" onClick={() => navigate('/proyectos')}>
          Volver a proyectos
        </Button>
      </div>
    )
  }
  if (isEdit && !editing) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <p className="text-sm text-muted-foreground">No se encontró el proyecto.</p>
        <Button type="button" variant="outline" onClick={() => navigate('/proyectos')}>
          Volver a proyectos
        </Button>
      </div>
    )
  }

  return (
    <ProyectoFormDialog
      variant="page"
      open
      editing={isEdit ? editing : null}
      onOpenChange={(o) => {
        if (!o) {
          if (isEdit && id) navigate(`/proyectos/${encodeURIComponent(id)}`)
          else navigate('/proyectos')
        }
      }}
      onPageSaved={(pid) => navigate(`/proyectos/${encodeURIComponent(pid)}`)}
      avanceActual={editing?.porcentaje_avance}
      onSave={async (payload) => {
        if (isEdit && id) {
          await useProyectosStore.getState().update(id, payload)
        } else {
          await useProyectosStore.getState().create(payload)
        }
      }}
    />
  )
}
