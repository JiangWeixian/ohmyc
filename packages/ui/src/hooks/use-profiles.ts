// React Query hooks for profile CRUD, preflight, activation, and deactivation.
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { request } from '../lib/transport'

import type {
  CreateProfileBody,
  Profile,
  UpdateProfileBody,
} from '@ohmyc/shared'

interface ProfilesListResponse {
  profiles: Profile[]
  active: string | null
}

interface ProfileEnvelope {
  profile: Profile
}

/** Activation hooks deferred to the follow-up "Profiles Activation"
 *  slice. Until then, these two stay on raw fetch() — same pattern as
 *  slice 5 left useStoreImport on legacy fetch. The transactional
 *  activation logic (lock, undo stack, symlinks, plugin-marketplace
 *  registration) is genuinely 2x slice 5's surface and gets its own
 *  focused slice + review. */
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

// --- Preflight types (server-side shape) ---

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

// --- Query hooks ---

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: () => request<ProfilesListResponse>('profiles.list', {}),
  })
}

export function useProfile(name: string | null) {
  return useQuery({
    queryKey: ['profiles', name],
    queryFn: async () => {
      const data = await request<ProfileEnvelope>('profiles.get', { name: name! })
      return data.profile
    },
    enabled: !!name,
  })
}

// --- Mutation hooks (CRUD) ---

export function useCreateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateProfileBody) => {
      const data = await request<ProfileEnvelope>('profiles.create', { body })
      return data.profile
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, body }: { name: string; body: UpdateProfileBody }) => {
      const data = await request<ProfileEnvelope>('profiles.update', { name, body })
      return data.profile
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useDeleteProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => request<{ success: boolean }>('profiles.delete', { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

// --- Mutation hooks (activation — deferred slice) ---

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

// --- Preflight ---

export function usePreflight() {
  return useMutation({
    mutationFn: (name: string) => request<PreflightResult>('profiles.preflight', { name }),
  })
}
