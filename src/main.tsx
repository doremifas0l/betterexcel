import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/shared/ErrorBoundary.tsx'

// AG Grid module registration
import { ModuleRegistry } from 'ag-grid-community'
import { AllCommunityModule } from 'ag-grid-community'

// Register all community modules
ModuleRegistry.registerModules([AllCommunityModule])

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
