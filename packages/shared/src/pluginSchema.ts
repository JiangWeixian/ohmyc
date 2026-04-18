import { z } from 'zod';

// Individual plugin installation record
export const PluginInstallSchema = z.object({
  version: z.string(),
  installedAt: z.string(),
  lastUpdated: z.string(),
  installPath: z.string(),
  gitCommitSha: z.string().optional(),
  isLocal: z.boolean().optional(),
  scope: z.enum(['user', 'project']),
  projectPath: z.string().optional(),
  source: z.string().optional(),
  installedByPresets: z.array(z.string()).optional(),
}).passthrough();

// Plugin manifest (plugin.json) - optional
export const PluginManifestSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  author: z.union([
    z.string(),
    z.object({ name: z.string(), email: z.string().optional() }),
  ]).optional(),
  repository: z.string().optional(),
  license: z.string().optional(),
  keywords: z.array(z.string()).optional(),
}).passthrough();

// Summary of a plugin's bundled components
export const PluginComponentSummarySchema = z.object({
  agents: z.array(z.string()),       // e.g. ["code-reviewer", "debugger"]
  skills: z.array(z.string()),       // e.g. ["gitlab-action"]
  commands: z.array(z.string()),     // e.g. ["commit-push", "create-pr"]
  hooks: z.any().nullable(),         // raw hooks/hooks.json content
  mcpServers: z.any().nullable(),    // raw .mcp.json content
  lspServers: z.any().nullable(),    // raw .lsp.json content
});

// Resolved plugin for API response
export const InstalledPluginSchema = z.object({
  id: z.string(),                    // e.g. "gitlab@tmates-plugins"
  name: z.string(),                  // e.g. "gitlab"
  marketplace: z.string(),           // e.g. "tmates-plugins"
  enabled: z.boolean(),              // from settings.json enabledPlugins
  installs: z.array(PluginInstallSchema),
  manifest: PluginManifestSchema.nullable(),
  components: PluginComponentSummarySchema,
});

// Marketplace source
const MarketplaceSourceSchema = z.object({
  source: z.string(),
  repo: z.string().optional(),
  url: z.string().optional(),
}).passthrough();

export const MarketplaceSchema = z.object({
  id: z.string(),
  source: MarketplaceSourceSchema,
  installLocation: z.string(),
  lastUpdated: z.string().optional(),
  autoUpdate: z.boolean().optional(),
});

export type PluginInstall = z.infer<typeof PluginInstallSchema>;
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export type InstalledPlugin = z.infer<typeof InstalledPluginSchema>;
export type Marketplace = z.infer<typeof MarketplaceSchema>;
