// Adapted from React Bits LetterGlitch (vendor/react-bits) and productized for
// OhMyC: typed props, theme-aware low-contrast colors, and a static mode for
// prefers-reduced-motion / calm intensity. Canvas background field, not subject.
import { useEffect, useRef } from 'react'

interface Letter {
  char: string
  color: string
  targetColor: string
  colorProgress: number
}

interface LetterGlitchProps {
  /** When true, render a single static frame and skip the animation loop. */
  disabled?: boolean
  /** Glitch refresh speed in ms (higher = calmer). */
  glitchSpeed?: number
  centerVignette?: boolean
  outerVignette?: boolean
  smooth?: boolean
  /** Low-contrast frosted-ivory-lamplit palette by default. */
  colors?: string[]
  characters?: string
  className?: string
}

const DEFAULT_COLORS = ['#2b4539', '#61dca3', '#61b3dc']
const DEFAULT_CHARS
  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789'

const FONT_SIZE = 16
const CHAR_WIDTH = 10
const CHAR_HEIGHT = 20

function hexToRgb(hex: string) {
  const normalized = hex.replace(
    /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
    (_m, r, g, b) => r + r + g + g + b + b,
  )
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized)
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null
}

function interpolateColor(
  start: { r: number; g: number; b: number },
  end: { r: number; g: number; b: number },
  factor: number,
) {
  const result = {
    r: Math.round(start.r + (end.r - start.r) * factor),
    g: Math.round(start.g + (end.g - start.g) * factor),
    b: Math.round(start.b + (end.b - start.b) * factor),
  }
  return `rgb(${result.r}, ${result.g}, ${result.b})`
}

export function LetterGlitch({
  disabled = false,
  glitchSpeed = 50,
  centerVignette = false,
  outerVignette = true,
  smooth = true,
  colors = DEFAULT_COLORS,
  characters = DEFAULT_CHARS,
  className,
}: LetterGlitchProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const pool = [...characters]
    const letters: Letter[] = []
    const grid = { columns: 0, rows: 0 }
    let animationFrame: number | null = null
    let lastGlitchTime = Date.now()

    const pickChar = () => pool[Math.floor(Math.random() * pool.length)]!
    const pickColor = () => colors[Math.floor(Math.random() * colors.length)]!

    const drawLetters = () => {
      if (letters.length === 0) {
        return
      }
      const { width, height } = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, width, height)
      ctx.font = `${FONT_SIZE}px monospace`
      ctx.textBaseline = 'top'
      for (const [index, letter] of letters.entries()) {
        const x = (index % grid.columns) * CHAR_WIDTH
        const y = Math.floor(index / grid.columns) * CHAR_HEIGHT
        ctx.fillStyle = letter.color
        ctx.fillText(letter.char, x, y)
      }
    }

    const initializeLetters = (columns: number, rows: number) => {
      grid.columns = columns
      grid.rows = rows
      letters.length = 0
      for (let i = 0; i < columns * rows; i += 1) {
        letters.push({
          char: pickChar(),
          color: pickColor(),
          targetColor: pickColor(),
          colorProgress: 1,
        })
      }
    }

    const resizeCanvas = () => {
      const parent = canvas.parentElement
      if (!parent) {
        return
      }
      const dpr = window.devicePixelRatio || 1
      const rect = parent.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const columns = Math.ceil(rect.width / CHAR_WIDTH)
      const rows = Math.ceil(rect.height / CHAR_HEIGHT)
      initializeLetters(columns, rows)
      drawLetters()
    }

    const updateLetters = () => {
      if (letters.length === 0) {
        return
      }
      const updateCount = Math.max(1, Math.floor(letters.length * 0.05))
      for (let i = 0; i < updateCount; i += 1) {
        const index = Math.floor(Math.random() * letters.length)
        const letter = letters[index]
        if (!letter) {
          continue
        }
        letter.char = pickChar()
        letter.targetColor = pickColor()
        if (smooth) {
          letter.colorProgress = 0
        } else {
          letter.color = letter.targetColor
          letter.colorProgress = 1
        }
      }
    }

    const handleSmoothTransitions = () => {
      let needsRedraw = false
      for (const letter of letters) {
        if (letter.colorProgress < 1) {
          letter.colorProgress += 0.05
          if (letter.colorProgress > 1) {
            letter.colorProgress = 1
          }
          const startRgb = hexToRgb(letter.color)
          const endRgb = hexToRgb(letter.targetColor)
          if (startRgb && endRgb) {
            letter.color = interpolateColor(startRgb, endRgb, letter.colorProgress)
            needsRedraw = true
          }
        }
      }
      if (needsRedraw) {
        drawLetters()
      }
    }

    const animate = () => {
      const now = Date.now()
      if (now - lastGlitchTime >= glitchSpeed) {
        updateLetters()
        drawLetters()
        lastGlitchTime = now
      }
      if (smooth) {
        handleSmoothTransitions()
      }
      animationFrame = requestAnimationFrame(animate)
    }

    resizeCanvas()
    if (!disabled) {
      animate()
    }

    let resizeTimeout: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        if (!disabled && animationFrame) {
          cancelAnimationFrame(animationFrame)
        }
        resizeCanvas()
        if (!disabled) {
          animate()
        }
      }, 100)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
      window.removeEventListener('resize', handleResize)
    }
  }, [glitchSpeed, smooth, disabled, colors, characters])

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      {outerVignette && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle, rgba(0,0,0,0) 60%, rgba(0,0,0,1) 100%)',
          }}
        />
      )}
      {centerVignette && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 60%)',
          }}
        />
      )}
    </div>
  )
}
