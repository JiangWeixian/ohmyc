import '@ohmyc/ui/globals.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import { Menubar } from './menubar'

// Transparent window: html/body must NOT paint their own background, otherwise
// the rounded-corner mask on the root element wouldn't show the desktop through.
document.documentElement.style.background = 'transparent'
document.body.style.background = 'transparent'

ReactDOM.createRoot(document.querySelector('#root')!).render(
  <React.StrictMode>
    <Menubar />
  </React.StrictMode>,
)
