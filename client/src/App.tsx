import { BrowserRouter } from 'react-router-dom'

import { AppRoutes } from '@/AppRoutes'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <AppRoutes />
      </TooltipProvider>
    </BrowserRouter>
  )
}
