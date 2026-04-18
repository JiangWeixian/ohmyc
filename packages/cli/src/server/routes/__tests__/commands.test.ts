import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import Fastify from 'fastify';
import { commandsRoutes } from '../commands';

describe('commands routes', () => {
  let tmpRoot: string;
  let tmpDir: string;
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'commands-route-test-'));
    tmpDir = path.join(tmpRoot, 'commands');
    mkdirSync(tmpDir, { recursive: true });
    app = Fastify();
    await app.register(commandsRoutes, {
      commandsDir: tmpDir,
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

  describe('GET /api/commands', () => {
    it('returns empty list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/commands' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ commands: [] });
    });

    it('returns commands list', async () => {
      writeFileSync(path.join(tmpDir, 'deploy.md'), '---\nname: deploy\ndescription: Deploy\n---\nprompt');
      const res = await app.inject({ method: 'GET', url: '/api/commands' });
      expect(res.statusCode).toBe(200);
      expect(res.json().commands).toHaveLength(1);
    });

    it('tags regular file as source: local', async () => {
      writeFileSync(path.join(tmpDir, 'local.md'), '---\nname: local\ndescription: Local\n---\nprompt');
      const res = await app.inject({ method: 'GET', url: '/api/commands' });
      const local = res.json().commands.find((command: any) => command.id === 'local');
      expect(local.source).toBe('local');
    });

    it('treats non-profile symlinks as local', async () => {
      const realFile = path.join(tmpDir, '_real.md');
      writeFileSync(realFile, '---\nname: linked\ndescription: Linked\n---\nprompt');
      symlinkSync(realFile, path.join(tmpDir, 'linked.md'));
      const res = await app.inject({ method: 'GET', url: '/api/commands' });
      const linked = res.json().commands.find((c: any) => c.id === 'linked');
      expect(linked.source).toBe('local');
    });

    it('marks only symlinks inside the active profile directory as profile', async () => {
      const activeProfileDir = path.join(tmpRoot, 'profiles', 'daily');
      mkdirSync(path.join(activeProfileDir, 'commands'), { recursive: true });
      writeFileSync(path.join(tmpRoot, 'profiles', '.active'), activeProfileDir);

      const storeFile = path.join(tmpRoot, 'linked-source.md');
      writeFileSync(storeFile, '---\nname: linked\ndescription: Linked\n---\nprompt');
      const activeLinkPath = path.join(activeProfileDir, 'commands', 'linked.md');
      symlinkSync(storeFile, activeLinkPath);
      symlinkSync(activeLinkPath, path.join(tmpDir, 'linked.md'));

      const res = await app.inject({ method: 'GET', url: '/api/commands' });
      const linked = res.json().commands.find((c: any) => c.id === 'linked');

      expect(linked.source).toBe('profile');
    });

    it('keeps local and profile commands distinct in the same listing', async () => {
      writeFileSync(path.join(tmpDir, 'local.md'), '---\nname: local\ndescription: Local\n---\nprompt');
      const activeProfileDir = path.join(tmpRoot, 'profiles', 'daily');
      mkdirSync(path.join(activeProfileDir, 'commands'), { recursive: true });
      writeFileSync(path.join(tmpRoot, 'profiles', '.active'), activeProfileDir);
      const storeFile = path.join(tmpRoot, 'linked-source.md');
      writeFileSync(storeFile, '---\nname: linked\ndescription: Linked\n---\nprompt');
      const activeLinkPath = path.join(activeProfileDir, 'commands', 'linked.md');
      symlinkSync(storeFile, activeLinkPath);
      symlinkSync(activeLinkPath, path.join(tmpDir, 'linked.md'));

      const res = await app.inject({ method: 'GET', url: '/api/commands' });
      const { commands } = res.json();

      expect(commands.find((command: any) => command.id === 'local')?.source).toBe('local');
      expect(commands.find((command: any) => command.id === 'linked')?.source).toBe('profile');
    });
  });

  describe('GET /api/commands/:name', () => {
    it('returns 404 for nonexistent', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/commands/nope' });
      expect(res.statusCode).toBe(404);
    });

    it('returns command', async () => {
      writeFileSync(path.join(tmpDir, 'deploy.md'), '---\nname: deploy\ndescription: Deploy\n---\nprompt');
      const res = await app.inject({ method: 'GET', url: '/api/commands/deploy' });
      expect(res.statusCode).toBe(200);
      expect(res.json().command.id).toBe('deploy');
    });
  });
});
