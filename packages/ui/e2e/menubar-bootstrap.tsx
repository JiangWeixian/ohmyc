import '../src/globals.css'
import '@fontsource/inter'
import '@fontsource/jetbrains-mono'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'

import { MenubarPage } from '../src/components/menubar/menubar-page'
import { installScenario, type ScenarioName } from './mock-handlers'

const scenario = new URLSearchParams(globalThis.location.search).get('scenario') as ScenarioName | null
installScenario(scenario ?? 'ready')

;(globalThis as unknown as { __e2eSetScenario: (name: ScenarioName) => void }).__e2eSetScenario = installScenario

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

ReactDOM.createRoot(document.querySelector('#root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <div style={{ width: '367px', height: '340px' }}>
        <MenubarPage />
      </div>
    </QueryClientProvider>
  </React.StrictMode>,
)
