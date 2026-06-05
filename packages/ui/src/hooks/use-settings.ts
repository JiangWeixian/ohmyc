// React Query hooks for reading and writing Claude Code settings.json.
// Backend transport is selected at build time via packages/ui/src/lib/transport.ts.
import { useMutation, useQuery } from '@tanstack/react-query'

import { request } from '@/lib/transport'

import type { SettingsJson } from '@ohmyc/shared'

export interface SettingsResponse {
  path: string
  content: SettingsJson | null
  exists: boolean
  error?: string
}

export interface SaveSettingsResponse {
  success: boolean
  path: string
  error?: string
}

export function useSettings(project?: string) {
  const queryKey = ['settings', project] as const

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const args: Record<string, unknown> = {}
      if (project) {
        args.project = project
      }
      return await request<SettingsResponse>('settings.get', args)
    },
  })

  const mutation = useMutation({
    mutationKey: [...queryKey, 'save'],
    mutationFn: async (content: SettingsJson) => {
      const args: Record<string, unknown> = { content }
      if (project) {
        args.project = project
      }
      return await request<SaveSettingsResponse>('settings.set', args)
    },
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    mutate: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error,
    saveData: mutation.data,
  }
}
