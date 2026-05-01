import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import type {
  CreateProfileBody,
  Profile,
  UpdateProfileBody,
} from '@claudeui/shared'

interface ProfilesListResponse {
  profiles: Profile[]
  active: string | null
}

async function fetchProfiles(): Promise<ProfilesListResponse> {
  const res = await fetch('/api/profiles')
  if (!res.ok) {
    throw new Error('Failed to fetch profiles')
  }
  return res.json()
}

async function fetchProfile(name: string): Promise<Profile> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}`)
  if (!res.ok) {
    throw new Error('Profile not found')
  }
  const data = await res.json()
  return data.profile
}

async function createProfile(body: CreateProfileBody): Promise<Profile> {
  const res = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to create profile')
  }
  const result = await res.json()
  return result.profile
}

async function updateProfile(name: string, body: UpdateProfileBody): Promise<Profile> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to update profile')
  }
  const result = await res.json()
  return result.profile
}

async function deleteProfile(name: string): Promise<void> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error('Failed to delete profile')
  }
}

async function activateProfile(name: string): Promise<{ warnings: string[] }> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}/activate`, { method: 'POST' })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to activate')
  }
  return res.json()
}

async function deactivateProfile(name: string): Promise<void> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}/deactivate`, { method: 'POST' })
  if (!res.ok) {
    throw new Error('Failed to deactivate')
  }
}

export interface ModelConfigEnvChange {
  action: 'CHANGE' | 'REMOVE' | 'SET'
  key: string
  value: string
  previousValue?: string
}

export interface ModelConfigChanges {
  configName: string
  changes: ModelConfigEnvChange[]
  deactivationChanges?: ModelConfigEnvChange[]
  deactivationConfigName?: string
}

export interface PreflightResult {
  canActivate: boolean
  missing: string[]
  settingsWarnings: string[]
  currentActive: string | null
  modelConfigChanges?: ModelConfigChanges
}

async function fetchPreflight(name: string): Promise<PreflightResult> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}/preflight`)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to run preflight check')
  }
  return res.json()
}

export function useProfiles() {
  return useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles })
}

export function useProfile(name: string | null) {
  return useQuery({
    queryKey: ['profiles', name],
    queryFn: () => fetchProfile(name!),
    enabled: !!name,
  })
}

export function useCreateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateProfileBody }) => updateProfile(name, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useDeleteProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useActivateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: activateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useDeactivateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deactivateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function usePreflight() {
  return useMutation({
    mutationFn: fetchPreflight,
  })
}
