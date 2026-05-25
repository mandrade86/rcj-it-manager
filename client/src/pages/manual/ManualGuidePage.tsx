import { Navigate, useParams } from 'react-router-dom'

import { ManualLayout } from '@/pages/manual/components/ManualLayout'
import { getManualGuide } from '@/pages/manual/manualGuides'

export function ManualGuidePage() {
  const { slug } = useParams<{ slug: string }>()
  const guide = slug ? getManualGuide(slug) : undefined

  if (!guide) {
    return <Navigate to="/manual" replace />
  }

  return <ManualLayout guide={guide} sections={guide.sections} />
}
