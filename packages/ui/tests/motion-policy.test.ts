import { readFileSync } from 'node:fs'

import {
  describe,
  expect,
  it,
} from 'vitest'

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

describe('motion policy', () => {
  it('defines strong motion tokens and reduced-motion scroll behavior', () => {
    const css = readSource('../src/globals.css')

    expect(css).toContain('--motion-ease-out: cubic-bezier(0.23, 1, 0.32, 1);')
    expect(css).toContain('--motion-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);')
    expect(css).toContain('--motion-fast: 120ms;')
    expect(css).toContain('--motion-short: 160ms;')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('scroll-behavior: auto;')
  })

  it('keeps transition-smooth on explicit non-layout properties only', () => {
    const css = readSource('../src/globals.css')
    const start = css.indexOf('.transition-smooth')
    const end = css.indexOf('.focus-ring', start)
    const transitionSmooth = start !== -1 && end > start ? css.slice(start, end) : ''

    expect(transitionSmooth).toContain('color var(--motion-short)')
    expect(transitionSmooth).toContain('background-color var(--motion-short)')
    expect(transitionSmooth).toContain('border-color var(--motion-short)')
    expect(transitionSmooth).toContain('opacity var(--motion-short)')
    expect(transitionSmooth).toContain('transform var(--motion-short)')
    expect(transitionSmooth).not.toContain('box-shadow')
    expect(transitionSmooth).not.toContain('all')
  })

  it('keeps DESIGN.md aligned with the code motion policy', () => {
    const design = readSource('../../../DESIGN.md')

    expect(design).toContain('Do not use `transition-all` for reusable UI primitives')
    expect(design).toContain('Command palette open/close is instant or opacity-only')
    expect(design).toContain('Reduced motion removes transform, slide, blur, count-up, parallax, and smooth-scroll movement')
  })
})
