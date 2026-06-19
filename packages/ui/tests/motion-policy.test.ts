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

  it('does not use transition-all in UI primitives or shell controls', () => {
    const files = [
      '../src/components/ui/button.tsx',
      '../src/components/ui/badge.tsx',
      '../src/components/ui/switch.tsx',
      '../src/components/ui/tabs.tsx',
      '../src/components/uitripled/native-dialog.tsx',
      '../src/components/command-palette-trigger.tsx',
      '../src/components/config-section.tsx',
    ]

    for (const file of files) {
      expect(readSource(file), file).not.toContain('transition-all')
    }
  })

  it('uses reduced-motion variants for scroll, select, and dropdown motion', () => {
    expect(readSource('../src/components/timeline/timeline-view.tsx')).toContain('(prefers-reduced-motion: reduce)')
    expect(readSource('../src/components/ui/select.tsx')).toContain('motion-reduce:data-[state=open]:animate-none')
    expect(readSource('../src/components/ui/dropdown-menu.tsx')).toContain('motion-reduce:data-[state=open]:animate-none')
  })

  it('does not use Framer x/y shorthand in Monitor DOM motion', () => {
    const monitor = readSource('../src/components/monitor/monitor-view.tsx')

    expect(monitor).not.toMatch(/\bx:\s/)
    expect(monitor).not.toMatch(/\by:\s/)
    expect(monitor).toContain("transform: 'translate")
  })

  it('keeps NativeButton free of Framer hover and glow motion', () => {
    const source = readSource('../src/components/uitripled/native-button.tsx')

    expect(source).not.toContain('whileHover')
    expect(source).not.toContain('whileTap')
    expect(source).not.toContain('blur-xl')
    expect(source).toContain('active:scale-[0.97]')
  })
})
