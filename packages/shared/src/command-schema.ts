import { z } from 'zod'

import { ScopeEnum } from './agent-schema'
import { OriginEnum, RenderBadgeSchema } from './provider'
import { StoreComponentProvenanceSchema } from './store-schema'

export const CommandFrontmatterSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  'argument-hint': z.string().optional(),
  'disable-model-invocation': z.boolean().optional(),
  'user-invocable': z.boolean().optional(),
  'allowed-tools': z.string().optional(),
  model: z.string().optional(),
  effort: z.enum(['low', 'medium', 'high', 'max']).optional(),
  context: z.enum(['fork']).optional(),
  agent: z.string().optional(),
  hooks: z.any().optional(),
}).passthrough()

export const CommandSchema = z.object({
  id: z.string(),
  frontmatter: CommandFrontmatterSchema,
  content: z.string(),
  raw: z.string(),
  filename: z.string(),
  source: z.enum(['local', 'plugin', 'project']),
  scope: ScopeEnum.optional(),
  pluginId: z.string().optional(),
  provenance: StoreComponentProvenanceSchema.optional(),
  origins: z.array(OriginEnum).optional(),
  badges: z.array(RenderBadgeSchema).optional(),
})

export const CreateCommandBodySchema = z.object({
  frontmatter: CommandFrontmatterSchema,
  content: z.string(),
})

export const UpdateCommandBodySchema = z.object({
  frontmatter: CommandFrontmatterSchema.partial().optional(),
  content: z.string().optional(),
})

export type CommandFrontmatter = z.infer<typeof CommandFrontmatterSchema>
export type Command = z.infer<typeof CommandSchema>
export type CreateCommandBody = z.infer<typeof CreateCommandBodySchema>
export type UpdateCommandBody = z.infer<typeof UpdateCommandBodySchema>
