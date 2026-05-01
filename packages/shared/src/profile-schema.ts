import { z } from 'zod'

export const RESERVED_PROFILE_NAMES = ['store', '.active', 'plugins', 'agents', 'skills', 'commands']

export const ProfileSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  agents: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  commands: z.array(z.string()).default([]),
  plugins: z.array(z.string()).default([]),
  modelConfig: z.string().optional(),
  hooks: z.any().optional(),
  mcpServers: z.any().optional(),
  lspServers: z.any().optional(),
  settings: z.record(z.any()).optional(),
})

export const CreateProfileBodySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  agents: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  commands: z.array(z.string()).optional(),
  plugins: z.array(z.string()).optional(),
  modelConfig: z.string().optional(),
  hooks: z.any().optional(),
  mcpServers: z.any().optional(),
  lspServers: z.any().optional(),
  settings: z.record(z.any()).optional(),
})

export const UpdateProfileBodySchema = CreateProfileBodySchema.partial().omit({ name: true })

export type Profile = z.infer<typeof ProfileSchema>
export type CreateProfileBody = z.infer<typeof CreateProfileBodySchema>
export type UpdateProfileBody = z.infer<typeof UpdateProfileBodySchema>
