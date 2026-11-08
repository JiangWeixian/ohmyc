import { useEffect, useRef } from 'react'

import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

type PreviewPosition = 'active' | 'after' | 'before'

class SpringValue {
  value: number
  target: number
  velocity = 0

  constructor(value: number, private readonly response = 0.3) {
    this.value = value
    this.target = value
  }

  reset(value: number) {
    this.value = value
    this.target = value
    this.velocity = 0
  }

  step(dt: number) {
    const angularFrequency = (Math.PI * 2) / this.response
    const stiffness = angularFrequency * angularFrequency
    const damping = 2 * angularFrequency
    const acceleration = -stiffness * (this.value - this.target) - damping * this.velocity
    this.velocity += acceleration * dt
    this.value += this.velocity * dt
  }

  settled() {
    return Math.abs(this.value - this.target) < 0.01 && Math.abs(this.velocity) < 0.01
  }
}

interface TiltState {
  popover: HTMLDivElement
  rotateX: SpringValue
  rotateY: SpringValue
  scale: SpringValue
  opacity: SpringValue
  glowX: number
  glowY: number
  frame: number | null
  previousTime: number
}

export function useMenuBarPreviewTilt({ active, position }: { active: boolean; position: PreviewPosition }) {
  const slideRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<TiltState | null>(null)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const slide = slideRef.current
    const preview = previewRef.current
    if (!slide || !preview) {
      return
    }

    const finePointer = globalThis.matchMedia('(hover: hover) and (pointer: fine)')
    const base = {
      x: 1,
      y: position === 'before' ? -12 : (position === 'after' ? 12 : 7),
      z: position === 'before' ? -0.35 : 0.35,
    }

    const renderTilt = (state: TiltState) => {
      state.popover.style.transform = `perspective(1200px) rotateY(${state.rotateY.value}deg) rotateX(${state.rotateX.value}deg) rotateZ(${base.z}deg) scale(${state.scale.value})`
      state.popover.style.setProperty('--glow-x', `${state.glowX}px`)
      state.popover.style.setProperty('--glow-y', `${state.glowY}px`)
      state.popover.style.setProperty('--glow-opacity', state.opacity.value.toFixed(3))
    }

    const springsFor = (state: TiltState) => [state.rotateX, state.rotateY, state.scale, state.opacity]

    const finish = (state: TiltState) => {
      if (state.opacity.target === 0) {
        state.popover.style.transform = ''
        state.popover.style.setProperty('--glow-opacity', '0')
        delete state.popover.dataset.tilting
        if (tiltRef.current === state) {
          tiltRef.current = null
        }
      }
      state.frame = null
    }

    const animate = (state: TiltState, time: number) => {
      const dt = Math.min((time - state.previousTime) / 1000, 0.032)
      state.previousTime = time
      for (const spring of springsFor(state)) {
        spring.step(dt)
      }
      renderTilt(state)
      if (springsFor(state).every(spring => spring.settled())) {
        finish(state)
        return
      }
      state.frame = requestAnimationFrame(nextTime => animate(state, nextTime))
    }

    const schedule = (state: TiltState) => {
      if (state.frame !== null) {
        return
      }
      state.previousTime = performance.now()
      state.frame = requestAnimationFrame(nextTime => animate(state, nextTime))
    }

    const reset = (immediate = false) => {
      const state = tiltRef.current
      if (!state) {
        return
      }
      state.rotateX.target = base.x
      state.rotateY.target = base.y
      state.scale.target = 1
      state.opacity.target = 0
      if (immediate || reducedMotion || !active || !finePointer.matches) {
        if (state.frame !== null) {
          cancelAnimationFrame(state.frame)
        }
        state.frame = null
        state.popover.style.transform = ''
        state.popover.style.setProperty('--glow-opacity', '0')
        delete state.popover.dataset.tilting
        tiltRef.current = null
        return
      }
      schedule(state)
    }

    const track = (event: PointerEvent) => {
      if (!active || reducedMotion || !finePointer.matches || event.pointerType === 'touch') {
        return
      }
      let state = tiltRef.current
      if (!state) {
        const rotateX = new SpringValue(base.x)
        const rotateY = new SpringValue(base.y)
        const scale = new SpringValue(1)
        const opacity = new SpringValue(0)
        state = {
          popover: preview,
          rotateX,
          rotateY,
          scale,
          opacity,
          glowX: 0,
          glowY: 0,
          frame: null,
          previousTime: 0,
        }
        tiltRef.current = state
      }
      const rect = preview.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      state.rotateX.target = base.x + ((y / rect.height) - 0.5) * 6
      state.rotateY.target = base.y - ((x / rect.width) - 0.5) * 8
      state.scale.target = 1.02
      state.glowX = x
      state.glowY = y
      state.opacity.target = 1
      preview.dataset.tilting = 'true'
      schedule(state)
    }

    const leave = () => reset()
    slide.addEventListener('pointerenter', track)
    slide.addEventListener('pointermove', track)
    slide.addEventListener('pointerleave', leave)
    return () => {
      slide.removeEventListener('pointerenter', track)
      slide.removeEventListener('pointermove', track)
      slide.removeEventListener('pointerleave', leave)
      reset(true)
    }
  }, [active, position, reducedMotion])

  return { slideRef, previewRef }
}
