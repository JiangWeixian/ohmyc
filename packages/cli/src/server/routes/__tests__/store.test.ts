import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Fastify from 'fastify'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { storeRoutes } from '../store'

describe('store routes', () => {
  let tmpDir: string
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'store-route-test-'))
    app = Fastify()
    await app.register(storeRoutes, { baseDir: tmpDir })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('GET /api/store/agents returns empty', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/store/agents' })
    expect(res.statusCode).toBe(200)
    expect(res.json().agents).toEqual([])
  })

  it('POST /api/store/agents creates agent in store', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/store/agents',
      payload: { frontmatter: { name: 'test', description: 'Test' }, content: 'prompt' },
    })
    expect(res.statusCode).toBe(201)
    expect(existsSync(path.join(tmpDir, 'store', 'agents', 'test.md'))).toBe(true)
  })

  it('DELETE /api/store/agents/:name returns 409 when referenced', async () => {
    // Create agent in store
    mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
    writeFileSync(path.join(tmpDir, 'store', 'agents', 'ref.md'), '---\nname: ref\ndescription: Ref\n---\np')
    // Create profile referencing it
    mkdirSync(path.join(tmpDir, 'profiles', 'prof'), { recursive: true })
    writeFileSync(path.join(tmpDir, 'profiles', 'prof', 'profile.json'), JSON.stringify({
      name: 'prof', agents: ['ref'], skills: [], commands: [],
    }))

    const res = await app.inject({ method: 'DELETE', url: '/api/store/agents/ref' })
    expect(res.statusCode).toBe(409)
    expect(res.json().referencedBy).toEqual(['prof'])
  })

  it('DELETE /api/store/agents/:name?force=true bypasses reference check', async () => {
    mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
    writeFileSync(path.join(tmpDir, 'store', 'agents', 'ref.md'), '---\nname: ref\ndescription: Ref\n---\np')
    mkdirSync(path.join(tmpDir, 'profiles', 'prof'), { recursive: true })
    writeFileSync(path.join(tmpDir, 'profiles', 'prof', 'profile.json'), JSON.stringify({
      name: 'prof', agents: ['ref'], skills: [], commands: [],
    }))

    const res = await app.inject({ method: 'DELETE', url: '/api/store/agents/ref?force=true' })
    expect(res.statusCode).toBe(200)
  })

  it('POST /api/store/import imports from directory', async () => {
    const source = path.join(tmpDir, 'source')
    mkdirSync(path.join(source, 'agents'), { recursive: true })
    writeFileSync(
      path.join(source, 'agents', 'imported.md'),
      '---\nname: imported\ndescription: Imported\n---\nagent',
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/store/import',
      payload: { sourceDir: source },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().imported).toBe(1)
    expect(res.json().overwritten).toBe(0)
    expect(res.json().conflicts).toEqual([])
  })

  it('POST /api/store/import returns typed conflicts on dry-run', async () => {
    mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'store', 'agents', 'imported.md'),
      '---\nname: imported\ndescription: Existing\n---\nold',
    )

    const source = path.join(tmpDir, 'source')
    mkdirSync(path.join(source, 'agents'), { recursive: true })
    writeFileSync(
      path.join(source, 'agents', 'imported.md'),
      '---\nname: imported\ndescription: Imported\n---\nagent',
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/store/import',
      payload: { sourceDir: source, dryRun: true },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      imported: 0,
      skipped: 0,
      overwritten: 0,
      errors: [],
      conflicts: [
        {
          type: 'agents',
          id: 'imported',
          sourcePath: path.join(source, 'agents', 'imported.md'),
          destinationPath: path.join(tmpDir, 'store', 'agents', 'imported.md'),
        },
      ],
    })
    expect(readFileSync(path.join(tmpDir, 'store', 'agents', 'imported.md'), 'utf8')).toContain('Existing')
  })

  it('POST /api/store/import rejects overwrite on dry-run', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/store/import',
      payload: { sourceDir: tmpDir, dryRun: true, overwrite: true },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('overwrite cannot be true when dryRun is true')
  })

  it('POST /api/store/import overwrites existing agents when confirmed', async () => {
    mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'store', 'agents', 'imported.md'),
      '---\nname: imported\ndescription: Existing\n---\nold',
    )

    const source = path.join(tmpDir, 'source')
    mkdirSync(path.join(source, 'agents'), { recursive: true })
    writeFileSync(
      path.join(source, 'agents', 'imported.md'),
      '---\nname: imported\ndescription: Imported\n---\nnew',
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/store/import',
      payload: { sourceDir: source, overwrite: true },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().overwritten).toBe(1)
    expect(res.json().conflicts).toHaveLength(1)
    expect(readFileSync(path.join(tmpDir, 'store', 'agents', 'imported.md'), 'utf8')).toContain('new')
  })

  it('GET store list/detail responses include provenance after import', async () => {
    const source = path.join(tmpDir, 'source')
    mkdirSync(path.join(source, 'agents'), { recursive: true })
    writeFileSync(
      path.join(source, 'agents', 'imported.md'),
      '---\nname: imported\ndescription: Imported\n---\nagent',
    )

    const importRes = await app.inject({
      method: 'POST',
      url: '/api/store/import',
      payload: { sourceDir: source },
    })

    expect(importRes.statusCode).toBe(200)

    const listRes = await app.inject({ method: 'GET', url: '/api/store/agents' })
    expect(listRes.statusCode).toBe(200)
    expect(listRes.json().agents[0].provenance.importPath).toBe(path.join(source, 'agents', 'imported.md'))

    const detailRes = await app.inject({ method: 'GET', url: '/api/store/agents/imported' })
    expect(detailRes.statusCode).toBe(200)
    expect(detailRes.json().agent.provenance.importPath).toBe(path.join(source, 'agents', 'imported.md'))
  })

  describe('model config routes', () => {
    it('GET /api/store/model-configs returns empty', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/store/model-configs' })
      expect(res.statusCode).toBe(200)
      expect(res.json().modelConfigs).toEqual([])
    })

    it('POST /api/store/model-configs creates config', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'claude-pro', apiKey: 'sk-123', baseUrl: 'https://api.anthropic.com' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().modelConfig).toMatchObject({
        name: 'claude-pro',
        apiKey: 'sk-123',
        baseUrl: 'https://api.anthropic.com',
      })
    })

    it('POST /api/store/model-configs rejects duplicate with 409', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'dup', apiKey: 'sk-1', baseUrl: 'https://api.anthropic.com' },
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'dup', apiKey: 'sk-2', baseUrl: 'https://api.anthropic.com' },
      })
      expect(res.statusCode).toBe(409)
    })

    it('POST /api/store/model-configs accepts any string for baseUrl', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'any-url', apiKey: 'sk-1', baseUrl: 'literally-anything-here' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().modelConfig.baseUrl).toBe('literally-anything-here')
    })

    it('POST /api/store/model-configs accepts any string for modelName', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'any-model', apiKey: 'sk-1', baseUrl: 'https://api.anthropic.com', modelName: 'claude-3-opus-20240229' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().modelConfig.modelName).toBe('claude-3-opus-20240229')
    })

    it('GET /api/store/model-configs/:name returns config', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'test-cfg', apiKey: 'sk-1', baseUrl: 'https://api.anthropic.com' },
      })
      const res = await app.inject({ method: 'GET', url: '/api/store/model-configs/test-cfg' })
      expect(res.statusCode).toBe(200)
      expect(res.json().modelConfig.name).toBe('test-cfg')
    })

    it('GET /api/store/model-configs/:name returns 404 for missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/store/model-configs/nonexistent' })
      expect(res.statusCode).toBe(404)
    })

    it('PUT /api/store/model-configs/:name updates fields', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'upd-me', apiKey: 'sk-1', baseUrl: 'https://api.anthropic.com' },
      })
      const res = await app.inject({
        method: 'PUT',
        url: '/api/store/model-configs/upd-me',
        payload: { apiKey: 'sk-updated' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().modelConfig.apiKey).toBe('sk-updated')
    })

    it('PUT /api/store/model-configs/:name returns 404 for missing', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/store/model-configs/nope',
        payload: { apiKey: 'sk-1' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('DELETE /api/store/model-configs/:name returns success', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'del-me', apiKey: 'sk-1', baseUrl: 'https://api.anthropic.com' },
      })
      const res = await app.inject({ method: 'DELETE', url: '/api/store/model-configs/del-me' })
      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('DELETE /api/store/model-configs/:name returns 409 when referenced by profile', async () => {
      // Create config
      await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'claude-pro', apiKey: 'sk-123', baseUrl: 'https://api.anthropic.com' },
      })
      // Create profile referencing it
      mkdirSync(path.join(tmpDir, 'profiles', 'myprofile'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'profiles', 'myprofile', 'profile.json'), JSON.stringify({
        name: 'myprofile', agents: [], skills: [], commands: [], modelConfig: 'claude-pro',
      }))

      const res = await app.inject({ method: 'DELETE', url: '/api/store/model-configs/claude-pro' })
      expect(res.statusCode).toBe(409)
      expect(res.json().referencedBy).toEqual(['myprofile'])
    })

    it('DELETE /api/store/model-configs/:name?force=true bypasses check', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'forced', apiKey: 'sk-1', baseUrl: 'https://api.anthropic.com' },
      })
      mkdirSync(path.join(tmpDir, 'profiles', 'force-prof'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'profiles', 'force-prof', 'profile.json'), JSON.stringify({
        name: 'force-prof', agents: [], skills: [], commands: [], modelConfig: 'forced',
      }))

      const res = await app.inject({ method: 'DELETE', url: '/api/store/model-configs/forced?force=true' })
      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('DELETE /api/store/model-configs/:name returns 404 for nonexistent', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/store/model-configs/nonexistent' })
      expect(res.statusCode).toBe(404)
    })

    it('GET /api/store/model-configs returns list with configs after creation', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'cfg-a', apiKey: 'sk-1', baseUrl: 'https://a.com' },
      })
      await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'cfg-b', apiKey: 'sk-2', baseUrl: 'https://b.com' },
      })
      const res = await app.inject({ method: 'GET', url: '/api/store/model-configs' })
      expect(res.statusCode).toBe(200)
      expect(res.json().modelConfigs).toHaveLength(2)
    })

    it('GET /api/store/model-configs/:name returns 400 for invalid name', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/store/model-configs/bad name!' })
      expect(res.statusCode).toBe(400)
    })

    it('POST /api/store/model-configs rejects missing required fields with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'no-key' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('PUT /api/store/model-configs/:name rejects empty body with 400', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/store/model-configs',
        payload: { name: 'empty-body', apiKey: 'sk-1', baseUrl: 'https://api.anthropic.com' },
      })
      const res = await app.inject({
        method: 'PUT',
        url: '/api/store/model-configs/empty-body',
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })
  })
})
