import { z } from 'zod';

export const ModelConfigSchema = z.object({
  name: z.string(),
  apiKey: z.string(),
  baseUrl: z.string(),
  modelName: z.string().default(''),
  provider: z.string().default(''),
});

export const CreateModelConfigBodySchema = z.object({
  name: z.string(),
  apiKey: z.string(),
  baseUrl: z.string(),
  modelName: z.string().optional(),
  provider: z.string().optional(),
});

export const UpdateModelConfigBodySchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  modelName: z.string().optional(),
  provider: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type CreateModelConfigBody = z.infer<typeof CreateModelConfigBodySchema>;
export type UpdateModelConfigBody = z.infer<typeof UpdateModelConfigBodySchema>;
