import { z } from 'zod'

export const SettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  defaultAgent: z.string().optional(),
  mcpServers: z.record(z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
  })).optional(),
})

export const ClaudeMdSchema = z.object({
  content: z.string(),
})

export type Settings = z.infer<typeof SettingsSchema>
export type ClaudeMd = z.infer<typeof ClaudeMdSchema>
