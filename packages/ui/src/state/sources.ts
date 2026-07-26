// Zustand store for which provider origins (codex/claude/opencode) the Explorer is filtered to.
// Persisted to localStorage under `ohmyc.sources`. Last-on guard prevents zero-state.
import { create } from 'zustand'

import type { Origin } from '@ohmyc/shared'

const STORAGE_KEY = 'ohmyc.sources'

export const REGISTERED_ORIGINS: readonly Origin[] = ['codex', 'claude', 'opencode']

interface SourcesStore {
  selected: Set<Origin>
  toggle: (origin: Origin) => void
  set: (origins: Origin[]) => void
  hydrate: () => void
}

function readStored(): Set<Origin> | null {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return null
    }
    const filtered = parsed.filter((p): p is Origin =>
      (REGISTERED_ORIGINS as readonly string[]).includes(p),
    )
    if (filtered.length === 0) {
      return null
    }
    return new Set(filtered)
  } catch {
    return null
  }
}

function persist(selected: Set<Origin>) {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected].toSorted()))
  } catch {
    // localStorage write failure is non-fatal — selection still works in-memory.
  }
}

export const useSources = create<SourcesStore>((set, get) => ({
  selected: readStored() ?? new Set(REGISTERED_ORIGINS),
  toggle: (origin) => {
    const current = new Set(get().selected)
    if (current.has(origin)) {
      if (current.size <= 1) {
        return
      } // last-on guard
      current.delete(origin)
    } else {
      current.add(origin)
    }
    persist(current)
    set({ selected: current })
  },
  set: (origins) => {
    const next = new Set(origins.filter((o): o is Origin =>
      (REGISTERED_ORIGINS as readonly string[]).includes(o),
    ))
    if (next.size === 0) {
      return
    }
    persist(next)
    set({ selected: next })
  },
  hydrate: () => {
    set({ selected: readStored() ?? new Set(REGISTERED_ORIGINS) })
  },
}))
