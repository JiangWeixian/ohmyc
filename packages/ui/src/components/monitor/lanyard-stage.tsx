import { useReducedMotion } from 'framer-motion'
import { Atom } from 'lucide-react'
import {
  Component,
  lazy,
  Suspense,
} from 'react'

import type { ErrorInfo, ReactNode } from 'react'

const ReactBitsLanyard = lazy(() =>
  import('./react-bits-lanyard').then(module => ({ default: module.ReactBitsLanyard })),
)

export function LanyardStage() {
  const webglLanyardEnabled = import.meta.env.VITE_MONITOR_WEBGL_LANYARD === 'true'
  const reduced = useReducedMotion()

  if (!webglLanyardEnabled || reduced || !supportsWebGL()) {
    return <LanyardFallback />
  }

  return (
    <LanyardErrorBoundary>
      <Suspense fallback={<LanyardFallback />}>
        <ReactBitsLanyard />
      </Suspense>
    </LanyardErrorBoundary>
  )
}

function supportsWebGL(): boolean {
  if (typeof document === 'undefined') {
    return false
  }
  if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom')) {
    return false
  }

  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      canvas.getContext('webgl2')
      || canvas.getContext('webgl')
      || canvas.getContext('experimental-webgl'),
    )
  } catch {
    return false
  }
}

function LanyardFallback() {
  return (
    <div className="relative flex min-h-[520px] items-center justify-center max-md:min-h-[420px]">
      <div className="absolute inset-x-8 top-1/2 h-px bg-[rgba(255,255,255,0.08)]" />
      <div className="absolute size-[420px] rounded-full border border-[rgba(255,255,255,0.08)] max-md:size-[300px]" />
      <div className="absolute size-[620px] rounded-full border border-[rgba(255,255,255,0.04)] max-md:size-[420px]" />

      <div className="relative flex aspect-[0.72] h-[360px] flex-col items-center justify-center rounded-[22px] border border-[var(--border-hover)] bg-[var(--text-primary)] text-[var(--bg-marketing)] shadow-[0_30px_100px_rgba(0,0,0,0.5)] max-md:h-[280px]">
        <Atom size={138} strokeWidth={1.7} aria-hidden="true" />
        <p className="sr-only">Lanyard stage fallback. WebGL lanyard replaces this layer after the React Bits spike is verified.</p>
      </div>
    </div>
  )
}

class LanyardErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // The fallback keeps Monitor usable when WebGL initialization fails.
  }

  render() {
    if (this.state.failed) {
      return <LanyardFallback />
    }

    return this.props.children
  }
}
