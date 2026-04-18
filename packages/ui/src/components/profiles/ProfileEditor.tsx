import { useState } from 'react';
import { useCreateProfile, useUpdateProfile } from '../../hooks/useProfiles';
import { useStoreAgents, useStoreSkills, useStoreCommands, useStoreModelConfigs } from '../../hooks/useStore';
import { ComponentPicker } from './ComponentPicker';
import { PluginPicker } from './PluginPicker';
import { JsonEditor } from '../JsonEditor';
import { cn } from '../cn';
import type { CreateProfileBody, Profile, UpdateProfileBody } from '@claudeui/shared';

interface ProfileEditorProps {
  profile?: Profile;
  onSaved: (name: string) => void;
  onCancel: () => void;
}

function tryParseJson(value: string): { ok: true; data: unknown } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, data: undefined };
  try {
    return { ok: true, data: JSON.parse(trimmed) };
  } catch {
    return { ok: false, error: 'must be valid JSON' };
  }
}

export function ProfileEditor({ profile, onSaved, onCancel }: ProfileEditorProps) {
  const isEdit = !!profile;
  const [name, setName] = useState(profile?.name ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [agents, setAgents] = useState<string[]>(profile?.agents ?? []);
  const [skills, setSkills] = useState<string[]>(profile?.skills ?? []);
  const [commands, setCommands] = useState<string[]>(profile?.commands ?? []);
  const [plugins, setPlugins] = useState<string[]>(profile?.plugins ?? []);
  const [modelConfig, setModelConfig] = useState<string | undefined>(profile?.modelConfig);
  const [hooksText, setHooksText] = useState(
    profile?.hooks ? JSON.stringify(profile.hooks, null, 2) : ''
  );
  const [mcpText, setMcpText] = useState(
    profile?.mcpServers ? JSON.stringify(profile.mcpServers, null, 2) : ''
  );
  const [lspText, setLspText] = useState(
    profile?.lspServers ? JSON.stringify(profile.lspServers, null, 2) : ''
  );
  const [settingsText, setSettingsText] = useState(
    profile?.settings ? JSON.stringify(profile.settings, null, 2) : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const createMut = useCreateProfile();
  const updateMut = useUpdateProfile();
  const agentsQ = useStoreAgents();
  const skillsQ = useStoreSkills();
  const commandsQ = useStoreCommands();
  const modelConfigsQ = useStoreModelConfigs();

  const isSaving = createMut.isPending || updateMut.isPending;

  const handleSave = () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Validate each JSON field individually and collect errors
    const hooksResult = tryParseJson(hooksText);
    const mcpResult = tryParseJson(mcpText);
    const lspResult = tryParseJson(lspText);
    const settingsResult = tryParseJson(settingsText);

    const newFieldErrors: Record<string, string | null> = {};

    if (!hooksResult.ok) newFieldErrors.hooks = `Hooks ${hooksResult.error}`;
    if (!mcpResult.ok) newFieldErrors.mcp = `MCP Servers ${mcpResult.error}`;
    if (!lspResult.ok) newFieldErrors.lsp = `LSP Servers ${lspResult.error}`;
    if (!settingsResult.ok) newFieldErrors.settings = `Settings Overlay ${settingsResult.error}`;

    setFieldErrors(newFieldErrors);

    if (Object.keys(newFieldErrors).length > 0) {
      return;
    }

    setError(null);

    const hooks = hooksResult.data;
    const mcpServers = mcpResult.data;
    const lspServers = lspResult.data;
    const settings = settingsResult.data as Record<string, unknown> | undefined;

    if (isEdit) {
      const body: UpdateProfileBody = {
        description: description || undefined,
        agents,
        skills,
        commands,
        plugins,
        modelConfig,
        hooks,
        mcpServers,
        lspServers,
        settings,
      };

      updateMut.mutate(
        { name: profile.name, body },
        {
          onSuccess: () => onSaved(profile.name),
          onError: (err) => setError(err.message),
        }
      );
      return;
    }

    const body: CreateProfileBody = {
      name: name.trim(),
      description: description || undefined,
      agents,
      skills,
      commands,
      plugins,
      modelConfig,
      hooks,
      mcpServers,
      lspServers,
      settings,
    };

    createMut.mutate(body, {
      onSuccess: () => onSaved(name.trim()),
      onError: (err) => setError(err.message),
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="panel flex items-start justify-between gap-4 p-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            {isEdit ? `Edit ${profile.name}` : 'New Profile'}
          </h2>
          <p className="text-pretty mt-2 max-w-2xl text-[15px] text-[var(--text-secondary)]">
            Configure reusable profile overlays and linked store components.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onCancel}
            type="button"
            className={cn(
              'rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)]',
              'transition-smooth hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            type="button"
            className={cn(
              'rounded-[var(--radius-sm)] border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)] px-3 py-1.5 text-[13px] font-medium text-white',
              'transition-smooth hover:bg-[var(--accent-blue-hover)]'
            )}
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Global error region for mutation errors */}
      {error && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-4 py-3 text-[13px] text-[var(--accent-red)]">
          {error}
        </div>
      )}

      {/* Section: Basics */}
      <section className="rounded-lg border border-[var(--border-default)] bg-[#0F1112] p-4">
        <h3 className="text-[20px] font-semibold text-[var(--text-primary)]">Basics</h3>
        <p className="mt-1 mb-4 text-[13px] text-[var(--text-secondary)]">
          Name and description for this profile
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEdit}
              placeholder="my-profile"
              className={cn(
                'mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-[13px]',
                'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                'focus:outline-none focus:border-[var(--accent-blue)]',
                'transition-smooth'
              )}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this profile is for..."
              className={cn(
                'mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 text-[13px]',
                'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                'focus:outline-none focus:border-[var(--accent-blue)]',
                'transition-smooth'
              )}
            />
          </div>
        </div>
      </section>

      {/* Section: Selections */}
      <section className="rounded-lg border border-[var(--border-default)] bg-[#0F1112] p-4">
        <h3 className="text-[20px] font-semibold text-[var(--text-primary)]">Selections</h3>
        <p className="mt-1 mb-4 text-[13px] text-[var(--text-secondary)]">
          Choose store components and plugins to include in this profile
        </p>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="panel p-5">
            <ComponentPicker
              label="Agents"
              available={(agentsQ.data ?? []).map((item) => ({
                id: item.id,
                description: item.frontmatter.description,
              }))}
              selected={agents}
              onChange={setAgents}
              isLoading={agentsQ.isLoading}
            />
          </div>
          <div className="panel p-5">
            <ComponentPicker
              label="Skills"
              available={(skillsQ.data ?? []).map((item) => ({
                id: item.id,
                description: item.frontmatter.description,
              }))}
              selected={skills}
              onChange={setSkills}
              isLoading={skillsQ.isLoading}
            />
          </div>
          <div className="panel p-5">
            <ComponentPicker
              label="Commands"
              available={(commandsQ.data ?? []).map((item) => ({
                id: item.id,
                description: item.frontmatter.description,
              }))}
              selected={commands}
              onChange={setCommands}
              isLoading={commandsQ.isLoading}
            />
          </div>
          <div className="panel p-5">
            <PluginPicker selected={plugins} onChange={setPlugins} />
          </div>
          <div className="panel p-5">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Model Config</div>
            {modelConfigsQ.isLoading ? (
              <span className="text-[13px] text-[var(--text-tertiary)]">Loading...</span>
            ) : (
              <select
                value={modelConfig ?? ''}
                onChange={(e) => setModelConfig(e.target.value || undefined)}
                className={cn(
                  "rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-[13px]",
                  "text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]",
                  "transition-colors duration-150 w-full"
                )}
              >
                <option value="">None</option>
                {(modelConfigsQ.data ?? [])
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(mc => (
                    <option key={mc.name} value={mc.name}>{mc.name}</option>
                  ))}
              </select>
            )}
          </div>
        </div>
      </section>

      {/* Section: Runtime config */}
      <section className="rounded-lg border border-[var(--border-default)] bg-[#0F1112] p-4">
        <h3 className="text-[20px] font-semibold text-[var(--text-primary)]">Runtime config</h3>
        <p className="mt-1 mb-4 text-[13px] text-[var(--text-secondary)]">
          Hooks, MCP servers, LSP servers, and settings overlay for this profile
        </p>
        <div className="space-y-6">
          <div className="panel p-5">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 block">
              Hooks
            </label>
            <p className="mb-2 text-[12px] text-[var(--text-tertiary)]">
              Define event hooks like preToolUse and postToolUse handlers.
            </p>
            <JsonEditor
              value={hooksText}
              onChange={setHooksText}
              placeholder='{ "preToolUse": [{ "matcher": "Bash", "hooks": ["echo hi"] }] }'
            />
            {fieldErrors.hooks && (
              <p className="mt-2 text-[12px] text-[var(--accent-red)]">{fieldErrors.hooks}</p>
            )}
          </div>

          <div className="panel p-5">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 block">
              MCP Servers
            </label>
            <p className="mb-2 text-[12px] text-[var(--text-tertiary)]">
              Configure Model Context Protocol servers by name.
            </p>
            <JsonEditor
              value={mcpText}
              onChange={setMcpText}
              placeholder='{ "server-name": { "command": "node", "args": ["server.js"] } }'
            />
            {fieldErrors.mcp && (
              <p className="mt-2 text-[12px] text-[var(--accent-red)]">{fieldErrors.mcp}</p>
            )}
          </div>

          <div className="panel p-5">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 block">
              LSP Servers
            </label>
            <p className="mb-2 text-[12px] text-[var(--text-tertiary)]">
              Configure Language Server Protocol servers by name.
            </p>
            <JsonEditor
              value={lspText}
              onChange={setLspText}
              placeholder='{ "typescript-language-server": { "command": "typescript-language-server" } }'
            />
            {fieldErrors.lsp && (
              <p className="mt-2 text-[12px] text-[var(--accent-red)]">{fieldErrors.lsp}</p>
            )}
          </div>

          <div className="panel p-5">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 block">
              Settings Overlay
            </label>
            <p className="mb-2 text-[12px] text-[var(--text-tertiary)]">
              Override Claude settings like model and effort level.
            </p>
            <JsonEditor
              value={settingsText}
              onChange={setSettingsText}
              placeholder='{ "model": "opus" }'
            />
            {fieldErrors.settings && (
              <p className="mt-2 text-[12px] text-[var(--accent-red)]">{fieldErrors.settings}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
