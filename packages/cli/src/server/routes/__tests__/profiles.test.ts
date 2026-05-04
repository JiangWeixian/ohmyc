import {
  mkdirSync,
  mkdtempSync,
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

import { profilesRoutes } from '../profiles'

describe('profiles routes', () => {
  let tmpDir: string
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'profiles-route-test-'))
    writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({}))
    app = Fastify()
    await app.register(profilesRoutes, { baseDir: tmpDir, claudeSettingsPath: path.join(tmpDir, 'settings.json'), pluginsDir: path.join(tmpDir, 'claude-plugins') })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('GET /api/profiles returns empty list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/profiles' })
    expect(res.statusCode).toBe(200)
    expect(res.json().profiles).toEqual([])
    expect(res.json().active).toBeNull()
  })

  it('POST /api/profiles creates profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/profiles',
      payload: { name: 'test', description: 'Test profile' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().profile.name).toBe('test')
  })

  it('POST /api/profiles returns 409 for duplicate', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'dup' } })
    const res = await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'dup' } })
    expect(res.statusCode).toBe(409)
  })

  it('GET /api/profiles/:name returns profile', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test' } })
    const res = await app.inject({ method: 'GET', url: '/api/profiles/test' })
    expect(res.statusCode).toBe(200)
    expect(res.json().profile.name).toBe('test')
  })

  it('PUT /api/profiles/:name updates profile', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test' } })
    const res = await app.inject({ method: 'PUT', url: '/api/profiles/test', payload: { description: 'Updated' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().profile.description).toBe('Updated')
  })

  it('DELETE /api/profiles/:name deletes profile', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test' } })
    const res = await app.inject({ method: 'DELETE', url: '/api/profiles/test' })
    expect(res.statusCode).toBe(200)
  })

  it('DELETE /api/profiles/:name returns 409 when profile is active', async () => {
    // Create store component so activation succeeds
    mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
    writeFileSync(path.join(tmpDir, 'store', 'agents', 'reviewer.md'), '---\nname: reviewer\n---\nprompt')

    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test', agents: ['reviewer'] } })
    await app.inject({ method: 'POST', url: '/api/profiles/test/activate' })

    const res = await app.inject({ method: 'DELETE', url: '/api/profiles/test' })
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toContain('Cannot delete active profile')
  })

  it('DELETE /api/profiles/:name succeeds when profile is not active', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test' } })
    const res = await app.inject({ method: 'DELETE', url: '/api/profiles/test' })
    expect(res.statusCode).toBe(200)
  })

  it('POST /api/profiles/:name/activate activates profile', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test' } })
    const res = await app.inject({ method: 'POST', url: '/api/profiles/test/activate' })
    expect(res.statusCode).toBe(200)
    expect(res.json().success).toBe(true)
    expect(res.json().warnings).toBeDefined()
    expect(Array.isArray(res.json().warnings)).toBe(true)

    const list = await app.inject({ method: 'GET', url: '/api/profiles' })
    expect(list.json().active).toBe('test')
  })

  it('POST /api/profiles/:name/activate returns 422 when components are missing', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test', agents: ['nonexistent'] } })
    const res = await app.inject({ method: 'POST', url: '/api/profiles/test/activate' })
    expect(res.statusCode).toBe(422)
    expect(res.json().error).toContain('Cannot activate profile')
    expect(res.json().missing).toContain('agent:nonexistent')
  })

  it('POST /api/profiles/:name/deactivate deactivates', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test' } })
    await app.inject({ method: 'POST', url: '/api/profiles/test/activate' })
    const res = await app.inject({ method: 'POST', url: '/api/profiles/test/deactivate' })
    expect(res.statusCode).toBe(200)

    const list = await app.inject({ method: 'GET', url: '/api/profiles' })
    expect(list.json().active).toBeNull()
  })

  describe('preflight endpoint', () => {
    it('GET /api/profiles/:name/preflight returns preflight result', async () => {
      await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test' } })
      const res = await app.inject({ method: 'GET', url: '/api/profiles/test/preflight' })
      expect(res.statusCode).toBe(200)
      expect(res.json().canActivate).toBe(true)
      expect(res.json().missing).toEqual([])
      expect(res.json().settingsWarnings).toEqual([])
      expect(res.json().currentActive).toBeNull()
    })

    it('GET /api/profiles/:name/preflight returns 404 when profile does not exist', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/profiles/nonexistent/preflight' })
      expect(res.statusCode).toBe(404)
    })

    it('GET /api/profiles/:name/preflight returns canActivate false when component missing', async () => {
      await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test', agents: ['missing-agent'] } })
      const res = await app.inject({ method: 'GET', url: '/api/profiles/test/preflight' })
      expect(res.statusCode).toBe(200)
      expect(res.json().canActivate).toBe(false)
      expect(res.json().missing).toContain('agent:missing-agent')
    })

    it('GET /api/profiles/:name/preflight returns settings warnings', async () => {
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ effort: 'low' }))
      await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test', settings: { effort: 'high' } } })
      const res = await app.inject({ method: 'GET', url: '/api/profiles/test/preflight' })
      expect(res.statusCode).toBe(200)
      expect(res.json().settingsWarnings).toContain("Settings key 'effort' would be overwritten")
    })

    it('GET /api/profiles/:name/preflight returns currentActive when a profile is active', async () => {
      await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'active' } })
      await app.inject({ method: 'POST', url: '/api/profiles/active/activate' })
      await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'other' } })

      const res = await app.inject({ method: 'GET', url: '/api/profiles/other/preflight' })
      expect(res.statusCode).toBe(200)
      expect(res.json().currentActive).toBe('active')
    })
  })
})
