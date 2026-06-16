import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { request } from '@/lib/transport'

import type {
  Agent,
  Command,
  CreateAgentBody,
  CreateCommandBody,
  CreateModelConfigBody,
  CreateSkillBody,
  ModelConfig,
  Skill,
  UpdateAgentBody,
  UpdateCommandBody,
  UpdateModelConfigBody,
  UpdateSkillBody,
} from '@ohmyc/shared'

// ---- Agents ----
export function useStoreAgents() {
  return useQuery({
    queryKey: ['store', 'agents'],
    queryFn: () => request<{ agents: Agent[] }>('store.agents.list', {}).then(d => d.agents),
  })
}

export function useStoreAgent(name: string | null) {
  return useQuery({
    queryKey: ['store', 'agents', name],
    queryFn: () => request<{ agent: Agent }>('store.agents.get', { name: name! }).then(d => d.agent),
    enabled: !!name,
  })
}

export function useCreateStoreAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAgentBody) =>
      request<{ agent: Agent }>('store.agents.create', { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  })
}

export function useUpdateStoreAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateAgentBody }) =>
      request<{ agent: Agent }>('store.agents.update', { name, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  })
}

export function useDeleteStoreAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      request<{ success: boolean }>('store.agents.delete', { name, force }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  })
}

// ---- Skills ----
export function useStoreSkills() {
  return useQuery({
    queryKey: ['store', 'skills'],
    queryFn: () => request<{ skills: Skill[] }>('store.skills.list', {}).then(d => d.skills),
  })
}

export function useStoreSkill(name: string | null) {
  return useQuery({
    queryKey: ['store', 'skills', name],
    queryFn: () => request<{ skill: Skill }>('store.skills.get', { name: name! }).then(d => d.skill),
    enabled: !!name,
  })
}

export function useCreateStoreSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSkillBody) =>
      request<{ skill: Skill }>('store.skills.create', { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  })
}

export function useUpdateStoreSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateSkillBody }) =>
      request<{ skill: Skill }>('store.skills.update', { name, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  })
}

export function useDeleteStoreSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      request<{ success: boolean }>('store.skills.delete', { name, force }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  })
}

// ---- Commands ----
export function useStoreCommands() {
  return useQuery({
    queryKey: ['store', 'commands'],
    queryFn: () => request<{ commands: Command[] }>('store.commands.list', {}).then(d => d.commands),
  })
}

export function useStoreCommand(name: string | null) {
  return useQuery({
    queryKey: ['store', 'commands', name],
    queryFn: () => request<{ command: Command }>('store.commands.get', { name: name! }).then(d => d.command),
    enabled: !!name,
  })
}

export function useCreateStoreCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCommandBody) =>
      request<{ command: Command }>('store.commands.create', { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  })
}

export function useUpdateStoreCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateCommandBody }) =>
      request<{ command: Command }>('store.commands.update', { name, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  })
}

export function useDeleteStoreCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      request<{ success: boolean }>('store.commands.delete', { name, force }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  })
}

// ---- Model Configs ----
export function useStoreModelConfigs() {
  return useQuery({
    queryKey: ['store', 'model-configs'],
    queryFn: () => request<{ modelConfigs: ModelConfig[] }>('store.model_configs.list', {}).then(d => d.modelConfigs),
  })
}

export function useStoreModelConfig(name: string | null) {
  return useQuery({
    queryKey: ['store', 'model-configs', name],
    queryFn: () => request<{ modelConfig: ModelConfig }>('store.model_configs.get', { name: name! }).then(d => d.modelConfig),
    enabled: !!name,
  })
}

export function useCreateStoreModelConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateModelConfigBody) =>
      request<{ modelConfig: ModelConfig }>('store.model_configs.create', { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store', 'model-configs'] })
    },
  })
}

export function useUpdateStoreModelConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateModelConfigBody }) =>
      request<{ modelConfig: ModelConfig }>('store.model_configs.update', { name, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store', 'model-configs'] })
    },
  })
}

export function useDeleteStoreModelConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      request<{ success: boolean }>('store.model_configs.delete', { name, force }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store', 'model-configs'] })
    },
  })
}
