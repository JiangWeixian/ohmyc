import './menu-bar-view-gallery.css'

import {
  Check,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Plus,
  Wifi,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
} from 'react'

import { MenubarPresetContent } from '@/components/menubar/menubar-preset-content'
import { EnvNote } from '@/components/settings/quota-section'
import { useMenuBarPreviewTilt } from '@/components/settings/use-menu-bar-preview-tilt'
import { Button } from '@/components/ui/button'
import { useUpdateSettings } from '@/hooks/use-app-settings'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { cn } from '@/lib/utils'

import type { MenubarView, ResolvedSettings } from '@/hooks/use-app-settings'

const PRESETS: { id: MenubarView | 'hidden'; name: string; description: string }[] = [
  { id: 'area', name: 'Trend & Quota', description: 'A sense of momentum, with subscription pressure close by.' },
  { id: 'heatmap', name: 'Bricks & Quota', description: 'A denser activity pattern for spotting streaks and quiet days.' },
  { id: 'quota', name: 'Quota Focus', description: 'Subscription pressure only, with more room for each provider.' },
  { id: 'hidden', name: 'Menu bar hidden', description: 'Hide OhMyC from the menu bar while polling continues.' },
]

function HiddenMenuBarPreview() {
  return (
    <>
      <div className="menubar-title">Menu bar</div>
      <div className="mt-4 flex items-center justify-between rounded-md border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[10px] text-[var(--text-secondary)]">
        <span>Finder</span>
        <span className="flex items-center gap-2"><Wifi size={13} /><span>9:41</span></span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <EyeOff size={24} className="text-[var(--text-tertiary)]" />
        <p className="mt-3 text-sm font-[510]">OhMyC is hidden</p>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">Polling continues in the background.</p>
      </div>
      <p className="menubar-label text-center">Reopen from Dock or Spotlight</p>
    </>
  )
}

function GallerySlide({ item, index, active, today }: { item: (typeof PRESETS)[number]; index: number; active: number; today: Date }) {
  const isActive = index === active
  const position = index < active ? 'before' : (index > active ? 'after' : 'active')
  const { slideRef, previewRef } = useMenuBarPreviewTilt({ active: isActive, position })

  return (
    <div
      ref={slideRef}
      data-gallery-slide
      data-active={isActive}
      data-position={position}
      aria-hidden={!isActive}
      inert={!isActive}
      className={cn(
        'menu-bar-gallery-slide flex shrink-0 snap-center flex-col transition-[opacity,transform] duration-200',
        isActive ? 'scale-100 opacity-100' : 'pointer-events-none scale-[.91] opacity-30',
      )}
      style={{ flexBasis: 320, maxWidth: '85vw' }}
    >
      <span className="sr-only">{item.name}: {item.description}</span>
      {item.id === 'hidden'
        ? (
        <div ref={previewRef} className="menubar-popover menu-bar-preview relative mx-auto flex w-full max-w-sm flex-1 flex-col overflow-hidden px-5 py-[18px] text-[var(--text-primary)]">
          <HiddenMenuBarPreview />
        </div>
          )
        : <MenubarPresetContent ref={previewRef} className="menu-bar-preview" view={item.id} today={today} preview />}
    </div>
  )
}

export function MenuBarViewGallery({ settings }: { settings: ResolvedSettings }) {
  const applied = settings.menubarIconVisible.value ? settings.menubarView.value : 'hidden'
  const appliedIndex = Math.max(0, PRESETS.findIndex(preset => preset.id === applied))
  const [active, setActive] = useState(appliedIndex)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [today] = useState(() => new Date())
  const carouselRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const update = useUpdateSettings()
  const preset = PRESETS[active]
  const envOverride = settings.menubarIconVisible.source === 'env'
    || (preset.id !== 'hidden' && settings.menubarView.source === 'env')
  const scrollSyncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const programmaticScroll = useRef(false)
  const programmaticTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const carousel = carouselRef.current
    const slide = carousel?.querySelectorAll<HTMLElement>('[data-gallery-slide]')[appliedIndex]
    if (carousel && slide) {
      carousel.scrollTo({ left: slide.offsetLeft - (carousel.clientWidth - slide.clientWidth) / 2, behavior: 'auto' })
    }
    return () => {
      globalThis.clearTimeout(scrollSyncTimer.current)
      globalThis.clearTimeout(programmaticTimer.current)
    }
  }, [])

  function goTo(index: number) {
    const next = Math.max(0, Math.min(PRESETS.length - 1, index))
    const carousel = carouselRef.current
    const slide = carousel?.querySelectorAll<HTMLElement>('[data-gallery-slide]')[next]
    programmaticScroll.current = true
    globalThis.clearTimeout(programmaticTimer.current)
    programmaticTimer.current = globalThis.setTimeout(() => {
      programmaticScroll.current = false
    }, 400)
    slide?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })
    setActive(next)
  }

  function syncFromScroll() {
    const carousel = carouselRef.current
    if (!carousel) {
      return
    }
    const center = carousel.getBoundingClientRect().left + carousel.clientWidth / 2
    let closest = active
    let distance = Number.POSITIVE_INFINITY
    for (const [index, slide] of carousel.querySelectorAll<HTMLElement>('[data-gallery-slide]').entries()) {
      const rect = slide.getBoundingClientRect()
      const nextDistance = Math.abs(rect.left + rect.width / 2 - center)
      if (nextDistance < distance) {
        closest = index
        distance = nextDistance
      }
    }
    if (closest !== active) {
      setActive(closest)
    }
  }

  function scheduleScrollSync() {
    if (programmaticScroll.current) {
      return
    }
    globalThis.clearTimeout(scrollSyncTimer.current)
    scrollSyncTimer.current = globalThis.setTimeout(syncFromScroll, 80)
  }

  function finishScroll() {
    programmaticScroll.current = false
    syncFromScroll()
  }

  async function apply() {
    if (saving || envOverride || preset.id === applied) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await update(preset.id === 'hidden'
        ? { menubar: { iconVisible: false } }
        : { menubar: { view: preset.id, iconVisible: true } })
    } catch {
      setError("Couldn't save menu bar view. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="relative" data-active-view={preset.id}>
        <button
          type="button"
          aria-label="Previous layout"
          disabled={active === 0}
          onClick={() => goTo(active - 1)}
          className="absolute left-0 top-[220px] z-10 flex size-9 items-center justify-center rounded-full border border-[var(--border-standard)] bg-[var(--bg-panel)] text-[var(--text-secondary)] disabled:opacity-25"
        >
          <ChevronLeft size={16} />
        </button>
        <div
          ref={carouselRef}
          role="group"
          aria-label="Available layouts. Use left and right arrow keys to browse."
          tabIndex={0}
          onScroll={scheduleScrollSync}
          onScrollEnd={finishScroll}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              goTo(active + 1)
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault()
              goTo(active - 1)
            }
          }}
          className="flex snap-x snap-mandatory gap-9 overflow-x-auto py-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingInline: 'max(24px, calc(50% - 160px))' }}
        >
          {PRESETS.map((item, index) => (
            <GallerySlide key={item.id} item={item} index={index} active={active} today={today} />
          ))}
        </div>
        <button
          type="button"
          aria-label="Next layout"
          disabled={active === PRESETS.length - 1}
          onClick={() => goTo(active + 1)}
          className="absolute right-0 top-[220px] z-10 flex size-9 items-center justify-center rounded-full border border-[var(--border-standard)] bg-[var(--bg-panel)] text-[var(--text-secondary)] disabled:opacity-25"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <h3 className="text-sm font-[510]">{preset.name}</h3>
          <Button
            type="button"
            size="icon-sm"
            disabled={saving || envOverride || preset.id === applied}
            onClick={apply}
            aria-pressed={preset.id === applied}
            aria-label={saving ? 'Saving…' : (preset.id === applied ? `${preset.name} selected` : `Use ${preset.name}`)}
          >
            {preset.id === applied ? <Check size={15} /> : <Plus size={15} />}
          </Button>
        </div>
        <div className="mt-4 flex justify-center gap-2" aria-label="Choose a layout">
          {PRESETS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Show ${item.name}`}
              aria-current={index === active}
              onClick={() => goTo(index)}
              className={cn('size-1.5 rounded-full transition-[background-color,transform]', index === active ? 'scale-125 bg-[var(--text-primary)]' : 'bg-[var(--text-quaternary)]')}
            />
          ))}
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-[var(--text-secondary)]">{error}</p>}
        {preset.id !== 'hidden' && <EnvNote setting={settings.menubarView} />}
        <EnvNote setting={settings.menubarIconVisible} />
      </div>
    </div>
  )
}
