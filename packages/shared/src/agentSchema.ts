import { z } from 'zod';
import { StoreComponentProvenanceSchema } from './storeSchema';

export const SAFE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const AgentFrontmatterSchema = z.object({
  name: z.string(),
  description: z.string(),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  permissionMode: z.enum(['default', 'acceptEdits', 'dontAsk', 'bypassPermissions', 'plan']).optional(),
  maxTurns: z.number().optional(),
  skills: z.array(z.string()).optional(),
  memory: z.enum(['user', 'project', 'local']).optional(),
  background: z.boolean().optional(),
  effort: z.enum(['low', 'medium', 'high', 'max']).optional(),
  isolation: z.enum(['worktree']).optional(),
  mcpServers: z.any().optional(),
  hooks: z.any().optional(),
}).passthrough();

export const AgentSchema = z.object({
  id: z.string(),
  frontmatter: AgentFrontmatterSchema,
  content: z.string(),
  raw: z.string(),
  filename: z.string(),
  source: z.enum(['local', 'profile', 'plugin', 'project']),
  pluginId: z.string().optional(),
  provenance: StoreComponentProvenanceSchema.optional(),
});

export const CreateAgentBodySchema = z.object({
  frontmatter: AgentFrontmatterSchema,
  content: z.string(),
});

export const UpdateAgentBodySchema = z.object({
  frontmatter: AgentFrontmatterSchema.partial().optional(),
  content: z.string().optional(),
});

export type AgentFrontmatter = z.infer<typeof AgentFrontmatterSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type CreateAgentBody = z.infer<typeof CreateAgentBodySchema>;
export type UpdateAgentBody = z.infer<typeof UpdateAgentBodySchema>;
