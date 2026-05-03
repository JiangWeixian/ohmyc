import { useMutation, useQuery } from '@tanstack/react-query'

import type { SettingsJson } from '@ohmyc/shared'

export interface SettingsResponse {
  path: string
  content: SettingsJson | null
  exists: boolean
  error?: string
}

async function fetchSettings(project?: string): Promise<SettingsResponse> {
  const url = project
    ? `/api/settings?project=${encodeURIComponent(project)}`
    : '/api/settings'

  const response = await fetch(url)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to fetch settings: ${response.statusText}`)
  }

  return response.json()
}

async function saveSettings(
  content: SettingsJson,
  project?: string,
): Promise<{ success: boolean; path: string; error?: string }> {
  const url = project
    ? `/api/settings?project=${encodeURIComponent(project)}`
    : '/api/settings'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to save settings: ${response.statusText}`)
  }

  return response.json()
}

export function useSettings(project?: string) {
  const queryKey = ['settings', project] as const

  const query = useQuery({
    queryKey,
    queryFn: () => fetchSettings(project),
  })

  const mutation = useMutation({
    mutationKey: [...queryKey, 'save'],
    mutationFn: (content: SettingsJson) => saveSettings(content, project),
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
