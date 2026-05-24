import '@ohmyc/ui/globals.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import { Menubar } from './menubar'

ReactDOM.createRoot(document.querySelector('#root')!).render(
  <React.StrictMode>
    <Menubar />
  </React.StrictMode>,
)
