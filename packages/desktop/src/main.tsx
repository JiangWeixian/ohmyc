import '@ohmyc/ui/globals.css'

import { App } from '@ohmyc/ui/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { Menubar } from './menubar'

const docStyle = document.documentElement.style
const bodyStyle = document.body.style

/**
 * Tauri opens the popover and main windows with the same WebviewUrl
 * (`index.html`). We branch on the window label here:
 *  - `popover` → transparent body, rounded-corner mask, render <Menubar />.
 *  - `main`    → opaque body, normal scroll, render full <App /> with
 *                initial route seeded to `/explore/timeline`.
 */
const label = getCurrentWebviewWindow().label

if (label === 'main') {
  bodyStyle.margin = '0'
  bodyStyle.background = 'var(--bg-marketing)'

  if (globalThis.location.pathname === '/') {
    globalThis.history.replaceState(null, '', '/explore/timeline')
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false } },
  })

  ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>
    </React.StrictMode>,
  )
} else {
  docStyle.background = 'transparent'
  bodyStyle.background = 'transparent'
  docStyle.overscrollBehavior = 'none'
  bodyStyle.overscrollBehavior = 'none'
  docStyle.overflow = 'hidden'
  bodyStyle.overflow = 'hidden'
  docStyle.height = '100vh'
  bodyStyle.height = '100vh'
  bodyStyle.margin = '0'

  ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
      <Menubar />
    </React.StrictMode>,
  )
}
