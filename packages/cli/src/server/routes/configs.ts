import { FastifyPluginAsync } from 'fastify';
import { readFile } from 'fs/promises';
import path from 'path';
import { PluginResolver } from '../services/pluginResolver';

interface ConfigRoutesOptions {
  baseDir: string;
  pluginsDir: string;
  settingsPath: string;
}

interface McpEntry {
  name: string;
  config: any;
  source: 'local' | 'plugin';
  pluginId?: string;
}

interface HookEntry {
  event: string;
  name: string;
  data: { matcher?: string; type: string; command: string };
  source: 'local' | 'plugin';
  pluginId?: string;
}

interface LspEntry {
  name: string;
  config: any;
  source: 'local' | 'plugin';
  pluginId?: string;
}

async function readJson(filePath: string): Promise<any> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function flattenHooks(hooksObj: Record<string, any>): Array<{ event: string; name: string; data: { matcher?: string; type: string; command: string } }> {
  const entries: Array<{ event: string; name: string; data: { matcher?: string; type: string; command: string } }> = [];
  for (const [eventName, groups] of Object.entries(hooksObj)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      const matcher = group.matcher;
      const hooks = group.hooks;
      if (!Array.isArray(hooks)) continue;
      for (let i = 0; i < hooks.length; i++) {
        const hook = hooks[i];
        entries.push({
          event: eventName,
          name: `${eventName} [${i}]`,
          data: {
            ...(matcher ? { matcher } : {}),
            type: hook.type,
            command: hook.command,
          },
        });
      }
    }
  }
  return entries;
}

export const configsRoutes: FastifyPluginAsync<ConfigRoutesOptions> = async (fastify, options) => {
  const { baseDir, pluginsDir, settingsPath } = options;
  const resolver = new PluginResolver(pluginsDir, settingsPath);

  // GET /api/mcp — read .mcp.json and merge with plugin contributions
  fastify.get('/api/mcp', async () => {
    const entries: McpEntry[] = [];

    // Local config
    const data = await readJson(path.join(baseDir, '.mcp.json'));
    const localServers = data?.mcpServers ?? {};
    for (const [name, config] of Object.entries(localServers)) {
      entries.push({ name, config, source: 'local' });
    }

    // Plugin contributions
    const pluginPaths = await resolver.getEnabledPluginPaths();
    for (const { id, installPath } of pluginPaths) {
      const pluginData = await readJson(path.join(installPath, '.mcp.json'));
      const pluginServers = pluginData?.mcpServers ?? {};
      for (const [name, config] of Object.entries(pluginServers)) {
        entries.push({ name, config, source: 'plugin', pluginId: id });
      }
    }

    return { mcpServers: entries };
  });

  // GET /api/hooks — read hooks from settings.json and merge with plugin contributions
  fastify.get('/api/hooks', async () => {
    const entries: HookEntry[] = [];

    // Local hooks
    const settings = await readJson(settingsPath);
    const localHooks = settings?.hooks ?? {};
    const flatLocal = flattenHooks(localHooks);
    for (const entry of flatLocal) {
      entries.push({ ...entry, source: 'local' });
    }

    // Plugin contributions
    const pluginPaths = await resolver.getEnabledPluginPaths();
    for (const { id, installPath } of pluginPaths) {
      const pluginHooksData = await readJson(path.join(installPath, 'hooks', 'hooks.json'));
      const pluginHooks = pluginHooksData?.hooks ?? {};
      const flatPlugin = flattenHooks(pluginHooks);
      for (const entry of flatPlugin) {
        entries.push({ ...entry, source: 'plugin', pluginId: id });
      }
    }

    return { hooks: entries };
  });

  // GET /api/lsp — read .lsp.json and merge with plugin contributions
  fastify.get('/api/lsp', async () => {
    const entries: LspEntry[] = [];

    // Local config - .lsp.json is a flat object (not wrapped in a top-level key)
    const data = await readJson(path.join(baseDir, '.lsp.json'));
    if (data && typeof data === 'object') {
      for (const [name, config] of Object.entries(data)) {
        entries.push({ name, config, source: 'local' });
      }
    }

    // Plugin contributions
    const pluginPaths = await resolver.getEnabledPluginPaths();
    for (const { id, installPath } of pluginPaths) {
      const pluginData = await readJson(path.join(installPath, '.lsp.json'));
      if (pluginData && typeof pluginData === 'object') {
        for (const [name, config] of Object.entries(pluginData)) {
          entries.push({ name, config, source: 'plugin', pluginId: id });
        }
      }
    }

    return { lspServers: entries };
  });
};
