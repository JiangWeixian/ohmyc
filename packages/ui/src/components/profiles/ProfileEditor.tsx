import { useState } from 'react';
import { useCreateProfile, useUpdateProfile } from '../../hooks/useProfiles';
import { useStoreAgents, useStoreSkills, useStoreCommands, useStoreModelConfigs } from '../../hooks/useStore';
import { ComponentPicker } from './ComponentPicker';
import { PluginPicker } from './PluginPicker';
import { JsonEditor } from '../JsonEditor';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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

    const hooks = hooksResult.ok ? hooksResult.data : undefined;
    const mcpServers = mcpResult.ok ? mcpResult.data : undefined;
    const lspServers = lspResult.ok ? lspResult.data : undefined;
    const settings = settingsResult.ok ? settingsResult.data as Record<string, unknown> | undefined : undefined;

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
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Profile'}
          </Button>
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
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} disabled={isEdit} placeholder="my-profile" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-description">Description</Label>
            <Input id="profile-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this profile is for..." />
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
            <div className="space-y-2">
              <Label>Model Config</Label>
              {modelConfigsQ.isLoading ? (
                <span className="text-[13px] text-[var(--text-tertiary)]">Loading...</span>
              ) : (
                <Select value={modelConfig ?? '__none__'} onValueChange={(val) => setModelConfig(val === '__none__' ? undefined : val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {(modelConfigsQ.data ?? [])
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(mc => (
                        <SelectItem key={mc.name} value={mc.name}>{mc.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
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
            <Label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5">
              Hooks
            </Label>
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
            <Label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5">
              MCP Servers
            </Label>
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
            <Label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5">
              LSP Servers
            </Label>
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
            <Label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5">
              Settings Overlay
            </Label>
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
