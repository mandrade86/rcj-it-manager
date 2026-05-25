import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { ProyectoDetailView } from '@/pages/proyectos/ProyectoDetailSheet'
import { useProyectosStore } from '@/store/proyectosStore'

export function ProyectoDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  if (!id) return <Navigate to="/proyectos" replace />

  return (
    <ProyectoDetailView
      proyectoId={id}
      onBack={() => navigate('/proyectos')}
      onProyectoUpdated={() => void useProyectosStore.getState().load()}
    />
  )
}
