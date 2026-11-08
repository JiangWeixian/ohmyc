import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { useMenuBarPreviewTilt } from '@/components/settings/use-menu-bar-preview-tilt'

let finePointer = true
let reducedMotion = false
let frameId = 0
let frameTime = 0
let callbacks = new Map<number, FrameRequestCallback>()

function Slide({ active = true }: { active?: boolean }) {
  const { slideRef, previewRef } = useMenuBarPreviewTilt({ active, position: 'active' })
  return (
    <div ref={slideRef} data-testid="slide">
      <div ref={previewRef} data-testid="preview" />
    </div>
  )
}

function advanceFrames(count = 120) {
  for (let index = 0; index < count; index += 1) {
    const pending = [...callbacks.values()]
    callbacks.clear()
    frameTime += 16.67
    for (const callback of pending) {
      callback(frameTime)
    }
  }
}

describe('useMenuBarPreviewTilt', () => {
  beforeEach(() => {
    finePointer = true
    reducedMotion = false
    frameId = 0
    frameTime = 0
    callbacks = new Map()
    vi.spyOn(globalThis, 'matchMedia').mockImplementation(query => ({
      matches: query.includes('prefers-reduced-motion') ? reducedMotion : finePointer,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }) as MediaQueryList)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameId += 1
      callbacks.set(frameId, callback)
      return frameId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 100,
      y: 100,
      width: 367,
      height: 500,
      top: 100,
      left: 100,
      right: 467,
      bottom: 600,
      toJSON: () => ({}),
    }) as DOMRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('responds at the upper-right, scales subtly, and resets on leave', () => {
    render(<Slide />)
    const slide = screen.getByTestId('slide')
    const preview = screen.getByTestId('preview')

    fireEvent.pointerEnter(slide, { clientX: 450, clientY: 120, pointerType: 'mouse' })
    expect(preview).toHaveAttribute('data-tilting', 'true')
    advanceFrames()
    expect(preview.style.transform).toContain('rotateX(')
    expect(preview.style.transform).toContain('rotateY(')
    const scale = Number(preview.style.transform.match(/scale\(([\d.]+)\)/)?.[1])
    expect(scale).toBeCloseTo(1.02, 3)

    fireEvent.pointerLeave(slide, { pointerType: 'mouse' })
    advanceFrames(240)
    expect(preview.style.getPropertyValue('--glow-opacity')).toBe('0')
    expect(preview).not.toHaveAttribute('data-tilting')
    expect(preview.style.transform).toBe('')
  })

  it('does not animate for reduced motion', () => {
    reducedMotion = true
    render(<Slide />)
    fireEvent.pointerEnter(screen.getByTestId('slide'), { clientX: 450, clientY: 120, pointerType: 'mouse' })
    expect(screen.getByTestId('preview')).not.toHaveAttribute('data-tilting')
    expect(screen.getByTestId('preview').style.getPropertyValue('--glow-opacity')).not.toBe('1')
  })

  it('does not animate for coarse pointers', () => {
    finePointer = false
    render(<Slide />)
    fireEvent.pointerEnter(screen.getByTestId('slide'), { clientX: 450, clientY: 120, pointerType: 'touch' })
    expect(screen.getByTestId('preview')).not.toHaveAttribute('data-tilting')
  })

  it('clears stale transform and glow when the slide becomes inactive', () => {
    const { rerender } = render(<Slide />)
    const slide = screen.getByTestId('slide')
    const preview = screen.getByTestId('preview')
    fireEvent.pointerEnter(slide, { clientX: 450, clientY: 120, pointerType: 'mouse' })
    advanceFrames(20)
    expect(preview).toHaveAttribute('data-tilting', 'true')

    rerender(<Slide active={false} />)
    expect(preview.style.transform).toBe('')
    expect(preview.style.getPropertyValue('--glow-opacity')).toBe('0')
    expect(preview).not.toHaveAttribute('data-tilting')
  })
})
