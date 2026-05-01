import { z } from 'zod'

export const StoreComponentTypeSchema = z.enum(['agents', 'skills', 'commands', 'model-configs'])

export const StoreComponentProvenanceSchema = z.object({
  importPath: z.string(),
  importedAt: z.string(),
})

export const StoreImportConflictSchema = z.object({
  type: StoreComponentTypeSchema,
  id: z.string(),
  sourcePath: z.string(),
  destinationPath: z.string(),
})

export const StoreImportRequestSchema = z.object({
  sourceDir: z.string(),
  dryRun: z.boolean().optional(),
  overwrite: z.boolean().optional(),
})

export const StoreImportResultSchema = z.object({
  imported: z.number(),
  skipped: z.number(),
  overwritten: z.number(),
  errors: z.array(z.string()),
  conflicts: z.array(StoreImportConflictSchema),
})

export type StoreComponentType = z.infer<typeof StoreComponentTypeSchema>
export type StoreComponentProvenance = z.infer<typeof StoreComponentProvenanceSchema>
export type StoreImportConflict = z.infer<typeof StoreImportConflictSchema>
export type StoreImportRequest = z.infer<typeof StoreImportRequestSchema>
export type StoreImportResult = z.infer<typeof StoreImportResultSchema>
