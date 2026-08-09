import '../src/globals.css'
import '@fontsource/inter'
import '@fontsource/jetbrains-mono'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from '../src/app'
import { ThemeProvider } from '../src/theme'
import { installScenario, type ScenarioName } from './mock-handlers'

const scenario = new URLSearchParams(globalThis.location.search).get('scenario') as ScenarioName | null
installScenario(scenario ?? 'ready')

;(globalThis as unknown as { __e2eSetScenario: (name: ScenarioName) => void }).__e2eSetScenario = installScenario

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

if (globalThis.location.pathname === '/') {
  globalThis.history.replaceState(null, '', '/explore/timeline')
}

ReactDOM.createRoot(document.querySelector('#root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
