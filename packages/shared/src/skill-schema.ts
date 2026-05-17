import { z } from 'zod'

import { ScopeEnum } from './agent-schema'
import { OriginEnum, RenderBadgeSchema } from './provider'
import { StoreComponentProvenanceSchema } from './store-schema'

export const SkillFrontmatterSchema = z.object({
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

export const SkillSchema = z.object({
  id: z.string(),
  frontmatter: SkillFrontmatterSchema,
  content: z.string(),
  raw: z.string(),
  dirName: z.string(),
  source: z.enum(['local', 'profile', 'plugin', 'project']),
  scope: ScopeEnum.optional(),
  pluginId: z.string().optional(),
  provenance: StoreComponentProvenanceSchema.optional(),
  origins: z.array(OriginEnum).optional(),
  badges: z.array(RenderBadgeSchema).optional(),
})

export const CreateSkillBodySchema = z.object({
  frontmatter: SkillFrontmatterSchema,
  content: z.string(),
})

export const UpdateSkillBodySchema = z.object({
  frontmatter: SkillFrontmatterSchema.partial().optional(),
  content: z.string().optional(),
})

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>
export type Skill = z.infer<typeof SkillSchema>
export type CreateSkillBody = z.infer<typeof CreateSkillBodySchema>
export type UpdateSkillBody = z.infer<typeof UpdateSkillBodySchema>
