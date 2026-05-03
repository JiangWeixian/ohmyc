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

export function useStoreAgents() {
  return useQuery({
    queryKey: ['store', 'agents'],
    queryFn: () => fetchJson<{ agents: Agent[] }>('/api/store/agents').then(d => d.agents),
  })
}

export function useStoreAgent(name: string | null) {
  return useQuery({
    queryKey: ['store', 'agents', name],
    queryFn: () => fetchJson<{ agent: Agent }>(`/api/store/agents/${encodeURIComponent(name!)}`).then(d => d.agent),
    enabled: !!name,
  })
}

export function useCreateStoreAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAgentBody) => mutateJson<{ agent: Agent }>('/api/store/agents', 'POST', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  })
}

export function useUpdateStoreAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateAgentBody }) =>
      mutateJson<{ agent: Agent }>(`/api/store/agents/${encodeURIComponent(name)}`, 'PUT', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  })
}

export function useDeleteStoreAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      mutateJson(`/api/store/agents/${encodeURIComponent(name)}${force ? '?force=true' : ''}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  })
}

// --- Store Skills ---

export function useStoreSkills() {
  return useQuery({
    queryKey: ['store', 'skills'],
    queryFn: () => fetchJson<{ skills: Skill[] }>('/api/store/skills').then(d => d.skills),
  })
}

export function useStoreSkill(name: string | null) {
  return useQuery({
    queryKey: ['store', 'skills', name],
    queryFn: () => fetchJson<{ skill: Skill }>(`/api/store/skills/${encodeURIComponent(name!)}`).then(d => d.skill),
    enabled: !!name,
  })
}

export function useCreateStoreSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSkillBody) => mutateJson<{ skill: Skill }>('/api/store/skills', 'POST', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  })
}

export function useUpdateStoreSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateSkillBody }) =>
      mutateJson<{ skill: Skill }>(`/api/store/skills/${encodeURIComponent(name)}`, 'PUT', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  })
}

export function useDeleteStoreSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      mutateJson(`/api/store/skills/${encodeURIComponent(name)}${force ? '?force=true' : ''}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  })
}

// --- Store Commands ---

export function useStoreCommands() {
  return useQuery({
    queryKey: ['store', 'commands'],
    queryFn: () => fetchJson<{ commands: Command[] }>('/api/store/commands').then(d => d.commands),
  })
}

export function useStoreCommand(name: string | null) {
  return useQuery({
    queryKey: ['store', 'commands', name],
    queryFn: () => fetchJson<{ command: Command }>(`/api/store/commands/${encodeURIComponent(name!)}`).then(d => d.command),
    enabled: !!name,
  })
}

export function useCreateStoreCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCommandBody) => mutateJson<{ command: Command }>('/api/store/commands', 'POST', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  })
}

export function useUpdateStoreCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateCommandBody }) =>
      mutateJson<{ command: Command }>(`/api/store/commands/${encodeURIComponent(name)}`, 'PUT', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  })
}

export function useDeleteStoreCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      mutateJson(`/api/store/commands/${encodeURIComponent(name)}${force ? '?force=true' : ''}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  })
}

// --- Store Model Configs ---

export function useStoreModelConfigs() {
  return useQuery({
    queryKey: ['store', 'model-configs'],
    queryFn: () => fetchJson<{ modelConfigs: ModelConfig[] }>('/api/store/model-configs').then(d => d.modelConfigs),
  })
}

export function useStoreModelConfig(name: string | null) {
  return useQuery({
    queryKey: ['store', 'model-configs', name],
    queryFn: () => fetchJson<{ modelConfig: ModelConfig }>(`/api/store/model-configs/${encodeURIComponent(name!)}`).then(d => d.modelConfig),
    enabled: !!name,
  })
}

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
