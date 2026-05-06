import {
  access,
  mkdir,
  readdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import type {
  CreateModelConfigBody,
  ModelConfig,
  UpdateModelConfigBody,
} from '@ohmyc/shared'

// Allows dots and forward slashes for names like "anthropic/claude-3.5-sonnet"
const MODEL_CONFIG_NAME_RE = /^[\w./-]+$/

/**
 * Resolves a safe, absolute file path for a model config, preventing directory traversal.
 * Returns null when the name is invalid or escapes the configs directory.
 */
function safeConfigPath(configsDir: string, name: string): string | null {
  if (!MODEL_CONFIG_NAME_RE.test(name)) {
    return null
  }
  if (name.includes('..')) {
    return null
  }
  const filePath = path.join(configsDir, `${name}.json`)
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(path.resolve(configsDir) + path.sep) && resolved !== path.resolve(configsDir)) {
    return null
  }
  return filePath
}

/**
 * CRUD service for model configuration files stored as JSON.
 * Each config is a `.json` file in the configured `configsDir`.
 * Names may include forward slashes to support nested paths (e.g. "provider/model").
 */
export class ModelConfigService {
  constructor(private configsDir: string) {}

  /** Fetches a single model config by name. Returns null if not found or name is invalid. */
  async get(name: string): Promise<ModelConfig | null> {
    const filePath = safeConfigPath(this.configsDir, name)
    if (!filePath) {
      return null
    }
    try {
      const raw = await readFile(filePath, 'utf8')
      return JSON.parse(raw) as ModelConfig
    } catch {
      return null
    }
  }

  /** Lists all model configs recursively, sorted alphabetically by relative path. */
  async list(): Promise<ModelConfig[]> {
    try {
      await access(this.configsDir)
    } catch {
      return []
    }

    const files = await readdir(this.configsDir, { recursive: true })
    const configs: ModelConfig[] = []
    for (const filename of files.filter(f => (f as string).endsWith('.json')).toSorted()) {
      try {
        const raw = await readFile(path.join(this.configsDir, filename as string), 'utf8')
        const config = JSON.parse(raw) as ModelConfig
        if (config.name) {
          configs.push(config)
        }
      } catch {
        continue
      }
    }
    return configs
  }

  /**
   * Creates a new model config file. Throws if the name is invalid or the file already exists.
   * @param data - Model config payload (name, apiKey, baseUrl, etc.).
   * @returns The newly created model config.
   */
  async create(data: CreateModelConfigBody): Promise<ModelConfig> {
    const filePath = safeConfigPath(this.configsDir, data.name)
    if (!filePath) {
      throw new Error(`Model config name "${data.name}" is invalid: must match [a-zA-Z0-9_./-] and contain no ".."`)
    }

    await mkdir(path.dirname(filePath), { recursive: true })

    try {
      await access(filePath)
      throw new Error(`Model config "${data.name}" already exists`)
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        throw error
      }
    }

    const config: ModelConfig = {
      name: data.name,
      apiKey: data.apiKey,
      baseUrl: data.baseUrl,
      modelName: data.modelName ?? '',
      provider: data.provider ?? '',
    }

    await writeFile(filePath, JSON.stringify(config, null, 2), 'utf8')
    return config
  }

  /**
   * Updates an existing model config by merging provided changes.
   * @param name - The model config identifier.
   * @param changes - Partial model config fields to merge.
   * @returns The updated model config, or null if not found.
   */
  async update(name: string, changes: UpdateModelConfigBody): Promise<ModelConfig | null> {
    const existing = await this.get(name)
    if (!existing) {
      return null
    }

    const filePath = safeConfigPath(this.configsDir, name)
    const updated: ModelConfig = { ...existing, ...changes }
    await writeFile(filePath!, JSON.stringify(updated, null, 2), 'utf8')
    return updated
  }

  /** Deletes a model config file by name. Returns true if the file existed and was removed. */
  async delete(name: string): Promise<boolean> {
    const filePath = safeConfigPath(this.configsDir, name)
    if (!filePath) {
      return false
    }
    try {
      await access(filePath)
      await unlink(filePath)
      return true
    } catch {
      return false
    }
  }
}
