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
} from '@claudeui/shared'

// Allows dots and forward slashes for names like "anthropic/claude-3.5-sonnet"
const MODEL_CONFIG_NAME_RE = /^[\w./-]+$/

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

export class ModelConfigService {
  constructor(private configsDir: string) {}

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
