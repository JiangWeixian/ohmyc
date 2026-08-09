// React application entry point — mounts the OhMyC UI with ThemeProvider, QueryClient, and BrowserRouter.
import './globals.css'
import '@fontsource/inter'
import '@fontsource/jetbrains-mono'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from './app'
import { ThemeProvider } from './theme'

/** Shared QueryClient with window-focus refetch disabled to avoid jarring UI updates. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

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
