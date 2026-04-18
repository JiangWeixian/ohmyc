import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import Fastify from 'fastify';
import { pluginsRoutes } from '../plugins';

describe('plugins routes', () => {
  let tmpDir: string;
  let pluginsDir: string;
  let settingsPath: string;
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'plugins-route-test-'));
    pluginsDir = path.join(tmpDir, 'plugins');
    settingsPath = path.join(tmpDir, 'settings.json');
    mkdirSync(pluginsDir, { recursive: true });

    app = Fastify();
    await app.register(pluginsRoutes, { pluginsDir, settingsPath });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/plugins', () => {
    it('returns empty list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/plugins' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ plugins: [] });
    });

    it('returns plugins with enabled state', async () => {
      writeFileSync(settingsPath, JSON.stringify({ enabledPlugins: { 'test@market': true } }));
      writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
        version: 2,
        plugins: {
          'test@market': [{ version: '1', installedAt: '', lastUpdated: '', installPath: '', scope: 'user' }],
        },
      }));

      const res = await app.inject({ method: 'GET', url: '/api/plugins' });
      expect(res.statusCode).toBe(200);
      const { plugins } = res.json();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].enabled).toBe(true);
      expect(plugins[0].id).toBe('test@market');
      expect(Array.isArray(plugins[0].installs)).toBe(true);
      expect(plugins[0].components.agents).toEqual([]);
      expect(plugins[0].components.skills).toEqual([]);
      expect(plugins[0].components.commands).toEqual([]);
    });

    it('defaults disabled and empty component collections when plugin data is sparse', async () => {
      writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
        version: 2,
        plugins: {
          'test@market': [{ version: '1', installedAt: '', lastUpdated: '', installPath: '', scope: 'user' }],
        },
      }));

      const res = await app.inject({ method: 'GET', url: '/api/plugins' });
      const { plugins } = res.json();

      expect(plugins).toHaveLength(1);
      expect(plugins[0].enabled).toBe(false);
      expect(plugins[0].components.agents).toEqual([]);
      expect(plugins[0].components.skills).toEqual([]);
      expect(plugins[0].components.commands).toEqual([]);
    });
  });

  describe('GET /api/plugins/:id', () => {
    it('returns 404 for nonexistent', async () => {
      writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: {} }));
      const res = await app.inject({ method: 'GET', url: '/api/plugins/nope' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/marketplaces', () => {
    it('returns empty list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/marketplaces' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ marketplaces: [] });
    });

    it('returns marketplaces', async () => {
      writeFileSync(path.join(pluginsDir, 'known_marketplaces.json'), JSON.stringify({
        'test-market': { source: { source: 'git', url: 'https://test.com' }, installLocation: '/tmp/t' },
      }));

      const res = await app.inject({ method: 'GET', url: '/api/marketplaces' });
      expect(res.statusCode).toBe(200);
      expect(res.json().marketplaces).toHaveLength(1);
    });
  });

  describe('GET /api/marketplaces/:id', () => {
    it('returns 404 for nonexistent', async () => {
      writeFileSync(path.join(pluginsDir, 'known_marketplaces.json'), JSON.stringify({}));
      const res = await app.inject({ method: 'GET', url: '/api/marketplaces/nope' });
      expect(res.statusCode).toBe(404);
    });
  });
});
