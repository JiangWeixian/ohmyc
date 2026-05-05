// React Query hooks for the OhMyC store — agents, skills, commands, model-configs, and import.
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import type {
  Agent,
  Command,
  CreateAgentBody,
  CreateCommandBody,
  CreateModelConfigBody,
  CreateSkillBody,
  ModelConfig,
  Skill,
  StoreImportRequest,
  StoreImportResult,
  UpdateAgentBody,
  UpdateCommandBody,
  UpdateModelConfigBody,
  UpdateSkillBody,
} from '@ohmyc/shared'

// --- Fetch helpers ---

async function fetchJson<Type>(url: string): Promise<Type> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}`)
  }
  return res.json()
}

async function mutateJson<Type>(url: string, method: string, body?: any): Promise<Type> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    throw Object.assign(new Error(error.error || 'Request failed'), { data: error })
  }
  return res.json()
}

// --- Store Agents ---

/** Query hook for listing all store agents. */
export function useStoreAgents() {
  return useQuery({
    queryKey: ['store', 'agents'],
    queryFn: () => fetchJson<{ agents: Agent[] }>('/api/store/agents').then(d => d.agents),
  })
}

/** Query hook for fetching a single store agent by name. */
export function useStoreAgent(name: string | null) {
  return useQuery({
    queryKey: ['store', 'agents', name],
    queryFn: () => fetchJson<{ agent: Agent }>(`/api/store/agents/${encodeURIComponent(name!)}`).then(d => d.agent),
    enabled: !!name,
  })
}

/** Mutation hook for creating a store agent. */
export function useCreateStoreAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAgentBody) => mutateJson<{ agent: Agent }>('/api/store/agents', 'POST', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  })
}

/** Mutation hook for updating a store agent. */
export function useUpdateStoreAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateAgentBody }) =>
      mutateJson<{ agent: Agent }>(`/api/store/agents/${encodeURIComponent(name)}`, 'PUT', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  })
}

/** Mutation hook for deleting a store agent. */
export function useDeleteStoreAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      mutateJson(`/api/store/agents/${encodeURIComponent(name)}${force ? '?force=true' : ''}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  })
}

// --- Store Skills ---

/** Query hook for listing all store skills. */
export function useStoreSkills() {
  return useQuery({
    queryKey: ['store', 'skills'],
    queryFn: () => fetchJson<{ skills: Skill[] }>('/api/store/skills').then(d => d.skills),
  })
}

/** Query hook for fetching a single store skill by name. */
export function useStoreSkill(name: string | null) {
  return useQuery({
    queryKey: ['store', 'skills', name],
    queryFn: () => fetchJson<{ skill: Skill }>(`/api/store/skills/${encodeURIComponent(name!)}`).then(d => d.skill),
    enabled: !!name,
  })
}

/** Mutation hook for creating a store skill. */
export function useCreateStoreSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSkillBody) => mutateJson<{ skill: Skill }>('/api/store/skills', 'POST', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  })
}

/** Mutation hook for updating a store skill. */
export function useUpdateStoreSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateSkillBody }) =>
      mutateJson<{ skill: Skill }>(`/api/store/skills/${encodeURIComponent(name)}`, 'PUT', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  })
}

/** Mutation hook for deleting a store skill. */
export function useDeleteStoreSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      mutateJson(`/api/store/skills/${encodeURIComponent(name)}${force ? '?force=true' : ''}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  })
}

// --- Store Commands ---

/** Query hook for listing all store commands. */
export function useStoreCommands() {
  return useQuery({
    queryKey: ['store', 'commands'],
    queryFn: () => fetchJson<{ commands: Command[] }>('/api/store/commands').then(d => d.commands),
  })
}

/** Query hook for fetching a single store command by name. */
export function useStoreCommand(name: string | null) {
  return useQuery({
    queryKey: ['store', 'commands', name],
    queryFn: () => fetchJson<{ command: Command }>(`/api/store/commands/${encodeURIComponent(name!)}`).then(d => d.command),
    enabled: !!name,
  })
}

/** Mutation hook for creating a store command. */
export function useCreateStoreCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCommandBody) => mutateJson<{ command: Command }>('/api/store/commands', 'POST', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  })
}

/** Mutation hook for updating a store command. */
export function useUpdateStoreCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateCommandBody }) =>
      mutateJson<{ command: Command }>(`/api/store/commands/${encodeURIComponent(name)}`, 'PUT', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  })
}

/** Mutation hook for deleting a store command. */
export function useDeleteStoreCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      mutateJson(`/api/store/commands/${encodeURIComponent(name)}${force ? '?force=true' : ''}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  })
}

// --- Store Model Configs ---

/** Query hook for listing all store model configs. */
export function useStoreModelConfigs() {
  return useQuery({
    queryKey: ['store', 'model-configs'],
    queryFn: () => fetchJson<{ modelConfigs: ModelConfig[] }>('/api/store/model-configs').then(d => d.modelConfigs),
  })
}

/** Query hook for fetching a single store model config by name. */
export function useStoreModelConfig(name: string | null) {
  return useQuery({
    queryKey: ['store', 'model-configs', name],
    queryFn: () => fetchJson<{ modelConfig: ModelConfig }>(`/api/store/model-configs/${encodeURIComponent(name!)}`).then(d => d.modelConfig),
    enabled: !!name,
  })
}

/** Mutation hook for creating a store model config. */
export function useCreateStoreModelConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateModelConfigBody) => mutateJson<{ modelConfig: ModelConfig }>('/api/store/model-configs', 'POST', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store', 'model-configs'] })
      qc.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}

/** Mutation hook for updating a store model config. */
export function useUpdateStoreModelConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateModelConfigBody }) =>
      mutateJson<{ modelConfig: ModelConfig }>(`/api/store/model-configs/${encodeURIComponent(name)}`, 'PUT', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store', 'model-configs'] })
      qc.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}

/** Mutation hook for deleting a store model config. */
export function useDeleteStoreModelConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      mutateJson(`/api/store/model-configs/${encodeURIComponent(name)}${force ? '?force=true' : ''}`, 'DELETE'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store', 'model-configs'] })
      qc.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}

// --- Store Import ---

/**
 * Mutation hook for importing components into the store.
 * Provides `previewImport` (dry-run) and `applyImport` helpers.
 */
export function useStoreImport() {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (request: StoreImportRequest) =>
      mutateJson<StoreImportResult>('/api/store/import', 'POST', request),
    onSuccess: (_result, request) => {
      // Only refetch when actual import happened (not dry-run preview)
      if (!request.dryRun) {
        qc.refetchQueries({ queryKey: ['store'] })
      }
    },
  })

  return {
    ...mutation,
    previewImport: (sourceDir: string) =>
      mutation.mutateAsync({ sourceDir, dryRun: true, overwrite: false }),
    applyImport: (sourceDir: string, overwrite = false) =>
      mutation.mutateAsync({ sourceDir, dryRun: false, overwrite }),
  }
}
