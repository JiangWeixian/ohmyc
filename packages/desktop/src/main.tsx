import '@ohmyc/ui/globals.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import { Menubar } from './menubar'

// Transparent window: html/body must NOT paint their own background, otherwise
// the rounded-corner mask on the root element wouldn't show the desktop through.
// Also disable macOS elastic scroll bounce — popover content always fits the
// window, so the elastic effect is pure noise.
const docStyle = document.documentElement.style
const bodyStyle = document.body.style
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
