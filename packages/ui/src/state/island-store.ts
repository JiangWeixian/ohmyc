import {
  animate,
  type MotionValue,
  motionValue,
} from 'framer-motion'
import { create } from 'zustand'

interface IslandState {
  isHovered: boolean
  hoverProgress: MotionValue<number>
  setHovered: (hovered: boolean) => void
  toggle: () => void
}

export const useIslandStore = create<IslandState>((set, get) => ({
  isHovered: false,
  hoverProgress: motionValue(0),
  setHovered: (hovered) => {
    set({ isHovered: hovered })
    animate(get().hoverProgress, hovered ? 1 : 0, {
      duration: hovered ? 0.42 : 0.36,
      ease: [0.23, 1, 0.32, 1],
    })
  },
  toggle: () => get().setHovered(!get().isHovered),
}))
