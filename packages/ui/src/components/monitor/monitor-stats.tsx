import {
  animate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  type EventsResult,
  useTimelineEvents,
  useTimelineStatus,
} from '@/hooks/use-timeline'

export interface MonitorStats {
  sessions: number
  tokens: number
  lastSyncLabel: string
  scopeLabel: string
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMonitorStats(): {
  stats: MonitorStats
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
} {
  const { data: status, isLoading: statusLoading, isError: statusError } = useTimelineStatus()
  const { data: events, isLoading: eventsLoading, isError: eventsError } = useTimelineEvents({})

  const stats = useMemo(
    () => deriveMonitorStats(status, events),
    [status, events],
  )
  const isLoading = statusLoading || eventsLoading
  const isError = statusError || eventsError
  const isEmpty = !isLoading
    && !isError
    && (status?.sessionCount ?? 0) === 0
    && (events?.days ?? []).length === 0

  return {
    stats,
    isLoading,
    isError,
    isEmpty,
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function deriveMonitorStats(status?: { lastSyncAt: number | null }, events?: EventsResult): MonitorStats {
  const days = events?.days ?? []
  const sessions = days.reduce((sum, day) => sum + day.session_count, 0)
  const tokens = days.reduce((sum, day) => sum + day.token_count, 0)

  return {
    sessions,
    tokens,
    lastSyncLabel: formatLastSync(status?.lastSyncAt ?? null),
    scopeLabel: 'latest timeline window',
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatLastSync(lastSyncAt: number | null): string {
  if (!lastSyncAt) {
    return 'never'
  }

  const diffMs = Math.max(0, Date.now() - lastSyncAt)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) {
    return 'now'
  }
  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h`
  }

  const days = Math.floor(hours / 24)
  return `${days}d`
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`
  }
  return String(value)
}

export function AnimatedNumber({
  value,
  formatter = formatCompactNumber,
}: {
  value: number
  formatter?: (value: number) => string
}) {
  const reducedMotion = useReducedMotion() ?? false
  const motionValue = useMotionValue(reducedMotion ? value : 0)
  const rounded = useTransform(motionValue, latest => Math.round(latest))
  const [display, setDisplay] = useState(() => formatter(value))

  useEffect(() => {
    const unsubscribe = rounded.on('change', latest => setDisplay(formatter(latest)))
    const controls = animate(motionValue, value, {
      duration: reducedMotion ? 0 : 0.55,
      ease: 'easeOut',
    })

    return () => {
      unsubscribe()
      controls.stop()
    }
  }, [formatter, motionValue, reducedMotion, rounded, value])

  return <span>{display}</span>
}
