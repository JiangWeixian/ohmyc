// React Query hooks for profile CRUD, activation, and deactivation.
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import type {
  CreateProfileBody,
  Profile,
  UpdateProfileBody,
} from '@ohmyc/shared'

// --- Internal fetch helpers ---

/** Shape of the GET /api/profiles response. */
interface ProfilesListResponse {
  profiles: Profile[]
  active: string | null
}

/** Fetches the list of all profiles and the active profile name. */
async function fetchProfiles(): Promise<ProfilesListResponse> {
  const res = await fetch('/api/profiles')
  if (!res.ok) {
    throw new Error('Failed to fetch profiles')
  }
  return res.json()
}

/** Fetches a single profile by name. */
async function fetchProfile(name: string): Promise<Profile> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}`)
  if (!res.ok) {
    throw new Error('Profile not found')
  }
  const data = await res.json()
  return data.profile
}

/** Creates a new profile. */
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

/** Updates an existing profile (all fields optional except name). */
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

/** Deletes a profile by name. */
async function deleteProfile(name: string): Promise<void> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error('Failed to delete profile')
  }
}

/** Activates a profile, creating symlinks and updating Claude Code settings. */
async function activateProfile(name: string): Promise<{ warnings: string[] }> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}/activate`, { method: 'POST' })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to activate')
  }
  return res.json()
}

/** Deactivates the currently active profile. */
async function deactivateProfile(name: string): Promise<void> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}/deactivate`, { method: 'POST' })
  if (!res.ok) {
    throw new Error('Failed to deactivate')
  }
}

/** A single environment variable change predicted by the preflight check. */
export interface ModelConfigEnvChange {
  action: 'CHANGE' | 'REMOVE' | 'SET'
  key: string
  value: string
  previousValue?: string
}

/** Summary of model-config environment changes for a profile activation. */
export interface ModelConfigChanges {
  configName: string
  changes: ModelConfigEnvChange[]
  deactivationChanges?: ModelConfigEnvChange[]
  deactivationConfigName?: string
}

/** Result of a profile preflight check — lists missing components and predicted side effects. */
export interface PreflightResult {
  canActivate: boolean
  missing: string[]
  settingsWarnings: string[]
  currentActive: string | null
  modelConfigChanges?: ModelConfigChanges
}

/** Fetches the preflight result for a profile before activation. */
async function fetchPreflight(name: string): Promise<PreflightResult> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}/preflight`)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to run preflight check')
  }
  return res.json()
}

// --- Query hooks ---

/** Query hook for listing all profiles and the active profile. */
export function useProfiles() {
  return useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles })
}

/** Query hook for fetching a single profile by name. */
export function useProfile(name: string | null) {
  return useQuery({
    queryKey: ['profiles', name],
    queryFn: () => fetchProfile(name!),
    enabled: !!name,
  })
}

// --- Mutation hooks (CRUD) ---

/** Mutation hook for creating a new profile. */
export function useCreateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

/** Mutation hook for updating an existing profile. */
export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateProfileBody }) => updateProfile(name, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

/** Mutation hook for deleting a profile. */
export function useDeleteProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

// --- Mutation hooks (activation) ---

/** Mutation hook for activating a profile. */
export function useActivateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: activateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

/** Mutation hook for deactivating the current profile. */
export function useDeactivateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deactivateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

// --- Preflight ---

/** Mutation hook for running a profile preflight check. */
export function usePreflight() {
  return useMutation({
    mutationFn: fetchPreflight,
  })
}
