import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import Fastify from 'fastify';
import { agentsRoutes } from '../agents';

describe('agents routes', () => {
  let tmpRoot: string;
  let tmpDir: string;
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'agents-route-test-'));
    tmpDir = path.join(tmpRoot, 'agents');
    mkdirSync(tmpDir, { recursive: true });
    app = Fastify();
    await app.register(agentsRoutes, {
      agentsDir: tmpDir,
      pluginsDir: path.join(tmpRoot, '_plugins'),
      settingsPath: path.join(tmpRoot, '_settings.json'),
      baseDir: tmpRoot,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  describe('GET /api/agents', () => {
    it('returns empty list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ agents: [] });
    });

    it('returns agents list', async () => {
      writeFileSync(path.join(tmpDir, 'test.md'), '---\nname: test\ndescription: Test\n---\nprompt');
      const res = await app.inject({ method: 'GET', url: '/api/agents' });
      expect(res.statusCode).toBe(200);
      expect(res.json().agents).toHaveLength(1);
    });

    it('tags regular file as source: local', async () => {
      writeFileSync(path.join(tmpDir, 'local.md'), '---\nname: local\ndescription: Local\n---\nprompt');
      const res = await app.inject({ method: 'GET', url: '/api/agents' });
      const local = res.json().agents.find((agent: any) => agent.id === 'local');
      expect(local.source).toBe('local');
    });

    it('treats non-profile symlinks as local', async () => {
      const realFile = path.join(tmpDir, '_real.md');
      writeFileSync(realFile, '---\nname: linked\ndescription: Linked\n---\nprompt');
      symlinkSync(realFile, path.join(tmpDir, 'linked.md'));
      const res = await app.inject({ method: 'GET', url: '/api/agents' });
      const linked = res.json().agents.find((a: any) => a.id === 'linked');
      expect(linked.source).toBe('local');
    });

    it('marks only symlinks inside the active profile directory as profile', async () => {
      const activeProfileDir = path.join(tmpRoot, 'profiles', 'daily');
      mkdirSync(path.join(activeProfileDir, 'agents'), { recursive: true });
      writeFileSync(path.join(tmpRoot, 'profiles', '.active'), activeProfileDir);

      const storeFile = path.join(tmpRoot, 'store-agent.md');
      writeFileSync(storeFile, '---\nname: linked\ndescription: Linked\n---\nprompt');
      symlinkSync(storeFile, path.join(tmpDir, 'linked.md'));

      const activeLinkPath = path.join(activeProfileDir, 'agents', 'linked.md');
      symlinkSync(storeFile, activeLinkPath);
      rmSync(path.join(tmpDir, 'linked.md'));
      symlinkSync(activeLinkPath, path.join(tmpDir, 'linked.md'));

      const res = await app.inject({ method: 'GET', url: '/api/agents' });
      const linked = res.json().agents.find((a: any) => a.id === 'linked');

      expect(linked.source).toBe('profile');
    });

    it('keeps local and profile items distinct in the same listing', async () => {
      writeFileSync(path.join(tmpDir, 'local.md'), '---\nname: local\ndescription: Local\n---\nprompt');

      const activeProfileDir = path.join(tmpRoot, 'profiles', 'daily');
      mkdirSync(path.join(activeProfileDir, 'agents'), { recursive: true });
      writeFileSync(path.join(tmpRoot, 'profiles', '.active'), activeProfileDir);
      const storeFile = path.join(tmpRoot, 'linked-source.md');
      writeFileSync(storeFile, '---\nname: linked\ndescription: Linked\n---\nprompt');
      const activeLinkPath = path.join(activeProfileDir, 'agents', 'linked.md');
      symlinkSync(storeFile, activeLinkPath);
      symlinkSync(activeLinkPath, path.join(tmpDir, 'linked.md'));

      const res = await app.inject({ method: 'GET', url: '/api/agents' });
      const { agents } = res.json();

      expect(agents.find((agent: any) => agent.id === 'local')?.source).toBe('local');
      expect(agents.find((agent: any) => agent.id === 'linked')?.source).toBe('profile');
    });
  });

  describe('GET /api/agents/:name', () => {
    it('returns 404 for nonexistent agent', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents/nope' });
      expect(res.statusCode).toBe(404);
    });

    it('returns agent', async () => {
      writeFileSync(path.join(tmpDir, 'test.md'), '---\nname: test\ndescription: Test\n---\nprompt');
      const res = await app.inject({ method: 'GET', url: '/api/agents/test' });
      expect(res.statusCode).toBe(200);
      expect(res.json().agent.id).toBe('test');
    });
  });
});
