import { z } from 'zod';

// General Settings Schema
export const GeneralSettingsSchema = z.object({
  model: z.string().optional(),
  availableModels: z.array(z.string()).optional(),
  modelOverrides: z.record(z.string()).optional(),
  language: z.string().optional(),
  autoUpdatesChannel: z.enum(['stable', 'beta']).optional(),
  alwaysThinkingEnabled: z.boolean().optional(),
  fastModePerSessionOptIn: z.boolean().optional(),
  showTurnDuration: z.boolean().optional(),
  prefersReducedMotion: z.boolean().optional(),
  plansDirectory: z.string().optional(),
  outputStyle: z.string().optional(),
  cleanupPeriodDays: z.number().optional(),
  respectGitignore: z.boolean().optional(),
  includeGitInstructions: z.boolean().optional(),
  includeCoAuthoredBy: z.boolean().optional(),
  terminalProgressBarEnabled: z.boolean().optional(),
  spinnerTipsEnabled: z.boolean().optional(),
  spinnerTipsOverride: z.boolean().optional(),
  spinnerVerbs: z.array(z.string()).optional(),
  statusLine: z.record(z.any()).optional(),
  fileSuggestion: z.record(z.any()).optional(),
  apiKeyHelper: z.record(z.any()).optional(),
  forceLoginMethod: z.string().optional()
});

// Permission Settings Schema
export const PermissionSettingsSchema = z.object({
  allow: z.array(z.string()).optional(),
  ask: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
  defaultMode: z.enum(['allow', 'ask', 'deny']).optional(),
  additionalDirectories: z.array(z.string()).optional(),
  disableBypassPermissionsMode: z.boolean().optional()
});

// Sandbox Settings Schema
export const SandboxSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  autoAllowBashIfSandboxed: z.boolean().optional(),
  excludedCommands: z.array(z.string()).optional(),
  allowUnsandboxedCommands: z.boolean().optional(),
  filesystem: z.object({
    allowWrite: z.array(z.string()).optional(),
    denyWrite: z.array(z.string()).optional(),
    denyRead: z.array(z.string()).optional()
  }).optional(),
  network: z.object({
    allowUnixSockets: z.boolean().optional(),
    allowAllUnixSockets: z.boolean().optional(),
    allowLocalBinding: z.boolean().optional(),
    allowedDomains: z.array(z.string()).optional(),
    allowManagedDomainsOnly: z.boolean().optional(),
    httpProxyPort: z.number().optional(),
    socksProxyPort: z.number().optional()
  }).optional(),
  enableWeakerNestedSandbox: z.boolean().optional(),
  enableWeakerNetworkIsolation: z.boolean().optional()
});

// Hook Settings Schema (simplified)
export const HookSettingsSchema = z.record(z.string(), z.any());

// Attribution Settings Schema
export const AttributionSettingsSchema = z.object({
  commit: z.boolean().optional(),
  pr: z.boolean().optional()
});

// MCP Control Settings Schema
export const McpControlSettingsSchema = z.object({
  enableAllProjectMcpServers: z.boolean().optional(),
  enabledMcpjsonServers: z.array(z.string()).optional(),
  disabledMcpjsonServers: z.array(z.string()).optional(),
  allowedMcpServers: z.array(z.string()).optional(),
  deniedMcpServers: z.array(z.string()).optional(),
  allowManagedMcpServersOnly: z.boolean().optional()
});

// Plugin Settings Schema
export const PluginSettingsSchema = z.object({
  enabledPlugins: z.array(z.string()).optional(),
  pluginTrustMessage: z.string().optional(),
  extraKnownMarketplaces: z.array(z.string()).optional(),
  strictKnownMarketplaces: z.array(z.string()).optional(),
  blockedMarketplaces: z.array(z.string()).optional()
});

// Env Settings Schema
export const EnvSettingsSchema = z.record(z.string());

// Combined Settings JSON Schema
export const SettingsJsonSchema = z.object({
  general: GeneralSettingsSchema.optional(),
  permissions: PermissionSettingsSchema.optional(),
  sandbox: SandboxSettingsSchema.optional(),
  hooks: HookSettingsSchema.optional(),
  attribution: AttributionSettingsSchema.optional(),
  mcpControl: McpControlSettingsSchema.optional(),
  plugins: PluginSettingsSchema.optional(),
  env: EnvSettingsSchema.optional()
}).passthrough();

// Type exports
export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;
export type PermissionSettings = z.infer<typeof PermissionSettingsSchema>;
export type SandboxSettings = z.infer<typeof SandboxSettingsSchema>;
export type HookSettings = z.infer<typeof HookSettingsSchema>;
export type AttributionSettings = z.infer<typeof AttributionSettingsSchema>;
export type McpControlSettings = z.infer<typeof McpControlSettingsSchema>;
export type PluginSettings = z.infer<typeof PluginSettingsSchema>;
export type EnvSettings = z.infer<typeof EnvSettingsSchema>;
export type SettingsJson = z.infer<typeof SettingsJsonSchema>;
