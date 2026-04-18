import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import Fastify from 'fastify';
import { configsRoutes } from '../configs';

describe('configs routes', () => {
  let tmpDir: string;
  let pluginsDir: string;
  let settingsPath: string;
  let app: ReturnType<typeof Fastify>;

  let projectDir: string | undefined;

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'configs-test-'));
    pluginsDir = path.join(tmpDir, 'plugins');
    mkdirSync(pluginsDir, { recursive: true });
    settingsPath = path.join(tmpDir, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({}));
    projectDir = undefined;
    app = Fastify();
    await app.register(configsRoutes, { baseDir: tmpDir, projectBaseDir: projectDir, pluginsDir, settingsPath });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // Helper: set up an enabled plugin with plugin data files
  function setupPlugin(pluginId: string, data: { mcpServers?: Record<string, any>; hooks?: Record<string, any>; lsp?: Record<string, any> }) {
    const installPath = path.join(pluginsDir, pluginId, '1.0.0');
    mkdirSync(installPath, { recursive: true });

    if (data.mcpServers) {
      writeFileSync(path.join(installPath, '.mcp.json'), JSON.stringify({ mcpServers: data.mcpServers }));
    }
    if (data.hooks) {
      mkdirSync(path.join(installPath, 'hooks'), { recursive: true });
      writeFileSync(path.join(installPath, 'hooks', 'hooks.json'), JSON.stringify({ hooks: data.hooks }));
    }
    if (data.lsp) {
      writeFileSync(path.join(installPath, '.lsp.json'), JSON.stringify(data.lsp));
    }

    // Register in installed_plugins.json
    const installedPath = path.join(pluginsDir, 'installed_plugins.json');
    let installed: any = { plugins: {} };
    try {
      const raw = require('fs').readFileSync(installedPath, 'utf-8');
      installed = JSON.parse(raw);
    } catch { /* first plugin */ }
    installed.plugins[pluginId] = [{ installPath, scope: 'user' }];
    writeFileSync(installedPath, JSON.stringify(installed));

    return installPath;
  }

  function enablePlugin(pluginId: string) {
    const settings = JSON.parse(require('fs').readFileSync(settingsPath, 'utf-8'));
    settings.enabledPlugins = settings.enabledPlugins ?? {};
    settings.enabledPlugins[pluginId] = true;
    writeFileSync(settingsPath, JSON.stringify(settings));
  }

  function disablePlugin(pluginId: string) {
    const settings = JSON.parse(require('fs').readFileSync(settingsPath, 'utf-8'));
    settings.enabledPlugins = settings.enabledPlugins ?? {};
    settings.enabledPlugins[pluginId] = false;
    writeFileSync(settingsPath, JSON.stringify(settings));
  }

  describe('GET /api/mcp', () => {
    it('returns empty array when no .mcp.json and no plugins', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/mcp' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ mcpServers: [] });
    });

    it('returns local entries with source "local"', async () => {
      writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify({
        mcpServers: { db: { command: 'node', args: ['server.js'] } },
      }));
      const res = await app.inject({ method: 'GET', url: '/api/mcp' });
      const body = res.json();
      expect(body.mcpServers).toHaveLength(1);
      expect(body.mcpServers[0]).toEqual({
        name: 'db',
        config: { command: 'node', args: ['server.js'] },
        source: 'local',
        scope: 'global',
      });
      expect(body.mcpServers[0].pluginId).toBeUndefined();
    });

    it('returns local + enabled plugin entries, plugin entries tagged with source "plugin" and pluginId', async () => {
      // Local config
      writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify({
        mcpServers: { db: { command: 'node', args: ['local.js'] } },
      }));
      // Plugin config
      setupPlugin('my-plugin', {
        mcpServers: { github: { command: 'npx', args: ['mcp-github'] } },
      });
      enablePlugin('my-plugin');

      const res = await app.inject({ method: 'GET', url: '/api/mcp' });
      const body = res.json();
      expect(body.mcpServers).toHaveLength(2);

      const localEntry = body.mcpServers.find((e: any) => e.source === 'local');
      expect(localEntry).toEqual({
        name: 'db',
        config: { command: 'node', args: ['local.js'] },
        source: 'local',
        scope: 'global',
      });

      const pluginEntry = body.mcpServers.find((e: any) => e.source === 'plugin');
      expect(pluginEntry).toEqual({
        name: 'github',
        config: { command: 'npx', args: ['mcp-github'] },
        source: 'plugin',
        scope: 'global',
        pluginId: 'my-plugin',
      });
    });

    it('does not include disabled plugin entries', async () => {
      setupPlugin('disabled-plugin', {
        mcpServers: { shouldNot: { command: 'bad' } },
      });
      disablePlugin('disabled-plugin');

      const res = await app.inject({ method: 'GET', url: '/api/mcp' });
      const body = res.json();
      expect(body.mcpServers).toHaveLength(0);
    });

    it('returns empty array when local config has no mcpServers', async () => {
      writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify({}));
      const res = await app.inject({ method: 'GET', url: '/api/mcp' });
      expect(res.json()).toEqual({ mcpServers: [] });
    });
  });

  describe('GET /api/hooks', () => {
    it('returns empty array when no settings.json hooks', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/hooks' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ hooks: [] });
    });

    it('returns local hooks with source "local"', async () => {
      writeFileSync(settingsPath, JSON.stringify({
        hooks: {
          PreToolUse: [
            { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] },
          ],
        },
      }));
      const res = await app.inject({ method: 'GET', url: '/api/hooks' });
      const body = res.json();
      expect(body.hooks).toHaveLength(1);
      expect(body.hooks[0]).toEqual({
        event: 'PreToolUse',
        name: 'PreToolUse [0]',
        data: { matcher: 'Bash', type: 'command', command: 'echo hi' },
        source: 'local',
        scope: 'global',
      });
    });

    it('returns local + enabled plugin hooks, plugin entries tagged correctly', async () => {
      writeFileSync(settingsPath, JSON.stringify({
        enabledPlugins: { 'hook-plugin': true },
        hooks: {
          PostToolUse: [
            { matcher: 'Edit', hooks: [{ type: 'command', command: 'local-hook' }] },
          ],
        },
      }));
      setupPlugin('hook-plugin', {
        hooks: {
          PreToolUse: [
            { matcher: 'Bash', hooks: [{ type: 'command', command: 'plugin-hook' }] },
          ],
        },
      });

      const res = await app.inject({ method: 'GET', url: '/api/hooks' });
      const body = res.json();
      expect(body.hooks).toHaveLength(2);

      const localEntry = body.hooks.find((e: any) => e.source === 'local');
      expect(localEntry.event).toBe('PostToolUse');
      expect(localEntry.data.command).toBe('local-hook');

      const pluginEntry = body.hooks.find((e: any) => e.source === 'plugin');
      expect(pluginEntry.event).toBe('PreToolUse');
      expect(pluginEntry.data.command).toBe('plugin-hook');
      expect(pluginEntry.pluginId).toBe('hook-plugin');
    });

    it('does not include disabled plugin hooks', async () => {
      setupPlugin('disabled-hooks', {
        hooks: { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'nope' }] }] },
      });
      disablePlugin('disabled-hooks');

      const res = await app.inject({ method: 'GET', url: '/api/hooks' });
      expect(res.json().hooks).toHaveLength(0);
    });
  });

  describe('GET /api/lsp', () => {
    it('returns empty array when no .lsp.json and no plugins', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/lsp' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ lspServers: [] });
    });

    it('returns local entries with source "local"', async () => {
      writeFileSync(path.join(tmpDir, '.lsp.json'), JSON.stringify({
        python: { command: 'pyright', extensionToLanguage: { '.py': 'python' } },
      }));
      const res = await app.inject({ method: 'GET', url: '/api/lsp' });
      const body = res.json();
      expect(body.lspServers).toHaveLength(1);
      expect(body.lspServers[0]).toEqual({
        name: 'python',
        config: { command: 'pyright', extensionToLanguage: { '.py': 'python' } },
        source: 'local',
        scope: 'global',
      });
    });

    it('returns local + enabled plugin LSP entries, plugin entries tagged correctly', async () => {
      writeFileSync(path.join(tmpDir, '.lsp.json'), JSON.stringify({
        python: { command: 'pyright' },
      }));
      setupPlugin('lsp-plugin', {
        lsp: { typescript: { command: 'tsserver' } },
      });
      enablePlugin('lsp-plugin');

      const res = await app.inject({ method: 'GET', url: '/api/lsp' });
      const body = res.json();
      expect(body.lspServers).toHaveLength(2);

      const localEntry = body.lspServers.find((e: any) => e.source === 'local');
      expect(localEntry.name).toBe('python');

      const pluginEntry = body.lspServers.find((e: any) => e.source === 'plugin');
      expect(pluginEntry).toEqual({
        name: 'typescript',
        config: { command: 'tsserver' },
        source: 'plugin',
        scope: 'global',
        pluginId: 'lsp-plugin',
      });
    });

    it('does not include disabled plugin LSP entries', async () => {
      setupPlugin('disabled-lsp', {
        lsp: { rust: { command: 'rust-analyzer' } },
      });
      disablePlugin('disabled-lsp');

      const res = await app.inject({ method: 'GET', url: '/api/lsp' });
      expect(res.json().lspServers).toHaveLength(0);
    });
  });

  describe('project-local loading', () => {
    async function createAppWithProject() {
      await app.close();
      projectDir = mkdtempSync(path.join(os.tmpdir(), 'project-configs-test-'));
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(path.join(projectDir, 'settings.json'), JSON.stringify({}));
      app = Fastify();
      await app.register(configsRoutes, { baseDir: tmpDir, projectBaseDir: projectDir, pluginsDir, settingsPath });
      await app.ready();
    }

    describe('GET /api/mcp with project', () => {
      it('returns local + project MCP entries with correct scope', async () => {
        await createAppWithProject();
        writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify({
          mcpServers: { db: { command: 'node', args: ['local.js'] } },
        }));
        writeFileSync(path.join(projectDir!, '.mcp.json'), JSON.stringify({
          mcpServers: { ci: { command: 'node', args: ['project.js'] } },
        }));

        const res = await app.inject({ method: 'GET', url: '/api/mcp' });
        const body = res.json();
        expect(body.mcpServers).toHaveLength(2);

        const local = body.mcpServers.find((e: any) => e.source === 'local');
        expect(local.scope).toBe('global');
        const proj = body.mcpServers.find((e: any) => e.source === 'project');
        expect(proj.scope).toBe('project');
        expect(proj.name).toBe('ci');
      });

      it('returns both versions when project and global define same key', async () => {
        await createAppWithProject();
        writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify({
          mcpServers: { db: { command: 'global' } },
        }));
        writeFileSync(path.join(projectDir!, '.mcp.json'), JSON.stringify({
          mcpServers: { db: { command: 'project' } },
        }));

        const res = await app.inject({ method: 'GET', url: '/api/mcp' });
        const body = res.json();
        expect(body.mcpServers).toHaveLength(2);
        expect(body.mcpServers.find((e: any) => e.scope === 'global')).toBeDefined();
        expect(body.mcpServers.find((e: any) => e.scope === 'project')).toBeDefined();
      });

      it('returns only local when projectBaseDir is null', async () => {
        writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify({
          mcpServers: { db: { command: 'node' } },
        }));

        const res = await app.inject({ method: 'GET', url: '/api/mcp' });
        const body = res.json();
        expect(body.mcpServers).toHaveLength(1);
        expect(body.mcpServers[0].scope).toBe('global');
      });
    });

    describe('GET /api/hooks with project', () => {
      it('returns local + project hooks with correct scope', async () => {
        await createAppWithProject();
        writeFileSync(settingsPath, JSON.stringify({
          hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'local-hook' }] }] },
        }));
        writeFileSync(path.join(projectDir!, 'settings.json'), JSON.stringify({
          hooks: { PostToolUse: [{ hooks: [{ type: 'command', command: 'project-hook' }] }] },
        }));

        const res = await app.inject({ method: 'GET', url: '/api/hooks' });
        const body = res.json();
        expect(body.hooks).toHaveLength(2);

        const local = body.hooks.find((e: any) => e.source === 'local');
        expect(local.scope).toBe('global');
        const proj = body.hooks.find((e: any) => e.source === 'project');
        expect(proj.scope).toBe('project');
      });
    });

    describe('GET /api/lsp with project', () => {
      it('returns local + project LSP entries with correct scope', async () => {
        await createAppWithProject();
        writeFileSync(path.join(tmpDir, '.lsp.json'), JSON.stringify({
          python: { command: 'pyright' },
        }));
        writeFileSync(path.join(projectDir!, '.lsp.json'), JSON.stringify({
          typescript: { command: 'tsserver' },
        }));

        const res = await app.inject({ method: 'GET', url: '/api/lsp' });
        const body = res.json();
        expect(body.lspServers).toHaveLength(2);

        const local = body.lspServers.find((e: any) => e.source === 'local');
        expect(local.scope).toBe('global');
        const proj = body.lspServers.find((e: any) => e.source === 'project');
        expect(proj.scope).toBe('project');
      });
    });
  });
});
