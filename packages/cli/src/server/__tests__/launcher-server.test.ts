import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import {
  createServer,
  resolveStaticRoot,
  startServer,
} from '../index'

describe('Launcher server', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'launcher-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('createServer with packaged static assets', () => {
    it('serves index.html from the provided static root', async () => {
      // Create a minimal static asset directory
      const staticRoot = path.join(tmpDir, 'ui-dist')
      mkdirSync(staticRoot, { recursive: true })
      writeFileSync(path.join(staticRoot, 'index.html'), '<html>SPA</html>')
      writeFileSync(path.join(staticRoot, 'app.js'), 'console.log("app")')

      const fastify = await createServer({ staticRoot })

      // Request the root — should serve index.html
      const rootRes = await fastify.inject({ method: 'GET', url: '/' })
      expect(rootRes.statusCode).toBe(200)
      expect(rootRes.body).toContain('SPA')

      // Request a known static file
      const jsRes = await fastify.inject({ method: 'GET', url: '/app.js' })
      expect(jsRes.statusCode).toBe(200)
      expect(jsRes.body).toContain('console.log')

      await fastify.close()
    })

    it('falls back to index.html for SPA routes like /profiles', async () => {
      const staticRoot = path.join(tmpDir, 'ui-dist')
      mkdirSync(staticRoot, { recursive: true })
      writeFileSync(path.join(staticRoot, 'index.html'), '<html>SPA</html>')

      const fastify = await createServer({ staticRoot })

      // SPA route that has no physical file
      const spaRes = await fastify.inject({ method: 'GET', url: '/profiles' })
      expect(spaRes.statusCode).toBe(200)
      expect(spaRes.body).toContain('SPA')

      // Another SPA route
      const exploreRes = await fastify.inject({ method: 'GET', url: '/explore/agents' })
      expect(exploreRes.statusCode).toBe(200)
      expect(exploreRes.body).toContain('SPA')

      await fastify.close()
    })

    it('serves /health endpoint', async () => {
      const staticRoot = path.join(tmpDir, 'ui-dist')
      mkdirSync(staticRoot, { recursive: true })
      writeFileSync(path.join(staticRoot, 'index.html'), '<html>SPA</html>')

      const fastify = await createServer({ staticRoot })
      const res = await fastify.inject({ method: 'GET', url: '/health' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ status: 'ok' })

      await fastify.close()
    })
  })

  describe('startServer port selection', () => {
    it('returns the actual chosen port and resolved static root', async () => {
      const staticRoot = path.join(tmpDir, 'ui-dist')
      mkdirSync(staticRoot, { recursive: true })
      writeFileSync(path.join(staticRoot, 'index.html'), '<html>SPA</html>')

      const result = await startServer({ defaultPort: 0, staticRoot })

      expect(result.port).toBeDefined()
      expect(typeof result.port).toBe('number')
      expect(result.port).toBeGreaterThan(0)
      expect(result.staticRoot).toBe(staticRoot)
      expect(result.fallback).toBe(false)

      // Verify the server actually responds
      const res = await fetch(`http://127.0.0.1:${result.port}/health`)
      expect(res.ok).toBe(true)

      // Clean up
      await result.close()
    })

    it('reports fallback when requested port is occupied', async () => {
      const staticRoot = path.join(tmpDir, 'ui-dist')
      mkdirSync(staticRoot, { recursive: true })
      writeFileSync(path.join(staticRoot, 'index.html'), '<html>SPA</html>')

      // Occupy the preferred port with a dummy server
      const dummyServer = await createServer({ staticRoot })
      const occupiedPort = await import('get-port').then(m => m.default({ port: 49_152 }))
      await dummyServer.listen({ port: occupiedPort, host: '127.0.0.1' })

      // Now start server requesting the same port — should fall back
      const result = await startServer({ defaultPort: occupiedPort, staticRoot })

      expect(result.port).toBeDefined()
      expect(result.port).not.toBe(occupiedPort)
      expect(result.fallback).toBe(true)
      expect(result.staticRoot).toBe(staticRoot)

      await result.close()
      await dummyServer.close()
    })
  })

  describe('resolveStaticRoot', () => {
    it('returns the provided staticRoot when it contains index.html', () => {
      const staticRoot = path.join(tmpDir, 'ui-dist')
      mkdirSync(staticRoot, { recursive: true })
      writeFileSync(path.join(staticRoot, 'index.html'), '<html>SPA</html>')

      const resolved = resolveStaticRoot(staticRoot)
      expect(resolved).toBe(staticRoot)
    })

    it('throws a descriptive error when no UI asset directory can be resolved', () => {
      const nonexistent = path.join(tmpDir, 'no-such-dir')

      expect(() => resolveStaticRoot(nonexistent)).toThrow(/no.*UI.*asset|cannot.*resolve.*static|missing.*index\.html/i)
    })
  })

  describe('createServer without valid static root', () => {
    it('throws a descriptive error when assets are missing', async () => {
      const nonexistent = path.join(tmpDir, 'no-such-dir')

      await expect(createServer({ staticRoot: nonexistent }))
        .rejects.toThrow(/no.*UI.*asset|cannot.*resolve.*static|missing.*index\.html/i)
    })
  })
})
