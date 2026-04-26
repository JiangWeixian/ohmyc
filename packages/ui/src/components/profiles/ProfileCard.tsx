import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Profile } from '@claudeui/shared';
import { usePreflight } from '../../hooks/useProfiles';
import type { PreflightResult } from '../../hooks/useProfiles';
import { ConfirmSwitchDialog } from './ConfirmSwitchDialog';
import { ActivateConfirmDialog } from './ActivateConfirmDialog';
import { ActivationBlockedDialog } from './ActivationBlockedDialog';
import { useStoreModelConfigs } from '../../hooks/useStore';
import { maskApiKey } from '../../utils/maskApiKey';

interface ProfileCardProps {
  profile: Profile;
  isActive: boolean;
  activeProfileName: string | null;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

type DialogState =
  | { type: 'switch'; preflight: PreflightResult }
  | { type: 'activate-warn'; preflight: PreflightResult }
  | { type: 'blocked'; preflight: PreflightResult }
  | { type: 'delete-active-blocked' }
  | null;

interface UseActivationFlowOptions {
  profileName: string;
  onActivate: () => void;
  isActive: boolean;
  onDelete: () => void;
}

function useActivationFlow({ profileName, onActivate, isActive, onDelete }: UseActivationFlowOptions) {
  const preflightMut = usePreflight();
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [lockError, setLockError] = useState(false);

  useEffect(() => {
    if (!lockError) return;
    const timer = setTimeout(() => setLockError(false), 5000);
    return () => clearTimeout(timer);
  }, [lockError]);

  const handleActivateClick = useCallback(async () => {
    try {
      const result = await preflightMut.mutateAsync(profileName);
      if (!result.canActivate) {
        setDialogState({ type: 'blocked', preflight: result });
      } else if (result.currentActive) {
        setDialogState({ type: 'switch', preflight: result });
      } else if (result.settingsWarnings.length > 0) {
        setDialogState({ type: 'activate-warn', preflight: result });
      } else {
        onActivate();
      }
    } catch (err: any) {
      if (err?.message?.includes('Another activation is in progress')) {
        setLockError(true);
      }
    }
  }, [profileName, preflightMut, onActivate]);

  const handleDeleteClick = useCallback(() => {
    if (isActive) {
      setDialogState({ type: 'delete-active-blocked' });
    } else {
      onDelete();
    }
  }, [isActive, onDelete]);

  return { dialogState, setDialogState, lockError, preflightMut, handleActivateClick, handleDeleteClick };
}

function ComponentGroup({ label, items, emptyText }: { label: string; items: string[]; emptyText: string }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium text-[var(--text-primary)]">{label}</div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className="inline-block rounded bg-white/[0.04] px-2 py-0.5 text-[12px] text-[var(--text-secondary)] border border-[var(--border-default)]"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-[var(--text-tertiary)]">{emptyText}</p>
      )}
    </div>
  );
}

function RuntimeGroup({ label, keys, emptyText }: { label: string; keys: string[]; emptyText: string }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium text-[var(--text-primary)]">{label}</div>
      {keys.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {keys.map((key) => (
            <span
              key={key}
              className="inline-block rounded bg-[var(--accent-blue)]/8 px-2 py-0.5 text-[12px] font-mono text-[var(--text-secondary)] border border-[var(--accent-blue)]/15"
            >
              {key}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-[var(--text-tertiary)]">{emptyText}</p>
      )}
    </div>
  );
}

export function ProfileCard({ profile, isActive, activeProfileName, onActivate, onDeactivate, onDelete, onEdit }: ProfileCardProps) {
  const hooksKeys = profile.hooks ? Object.keys(profile.hooks) : [];
  const mcpKeys = profile.mcpServers ? Object.keys(profile.mcpServers) : [];
  const lspKeys = profile.lspServers ? Object.keys(profile.lspServers) : [];
  const settingsKeys = profile.settings ? Object.keys(profile.settings) : [];

  const modelConfigsQ = useStoreModelConfigs();
  const resolvedModelConfig = profile.modelConfig
    ? (modelConfigsQ.data ?? []).find(mc => mc.name === profile.modelConfig)
    : undefined;

  const { dialogState, setDialogState, lockError, preflightMut, handleActivateClick, handleDeleteClick } = useActivationFlow({
    profileName: profile.name,
    onActivate,
    isActive,
    onDelete,
  });

  return (
    <Card className="panel p-6">
      <CardContent className="p-0">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left column - summary rail (~35%) */}
          <div className="flex flex-col gap-4 lg:w-[35%]">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-balance text-[30px] font-semibold leading-[1.1] text-[var(--text-primary)]">{profile.name}</h2>
                {isActive && (
                  <span className="bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] text-[11px] font-medium px-2 py-0.5 rounded">
                    Active
                  </span>
                )}
              </div>
              {profile.description && (
                <p className="text-pretty mt-2 max-w-md text-[15px] text-[var(--text-secondary)]">{profile.description}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={onEdit}
                type="button"
                className={cn(
                  "rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)]",
                  "transition-smooth hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                )}
              >
                Edit
              </button>
              {isActive ? (
                <button
                  onClick={onDeactivate}
                  type="button"
                  className={cn(
                    "rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)]",
                    "transition-smooth hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                  )}
                >
                  Deactivate
                </button>
              ) : (
                <button
                  onClick={handleActivateClick}
                  disabled={preflightMut.isPending}
                  type="button"
                  className={cn(
                    "rounded-md border border-[rgba(255,255,255,0.08)] bg-[var(--text-primary)] px-3 py-1.5 text-[13px] font-medium text-[var(--bg-marketing)]",
                    "transition-smooth hover:bg-[var(--text-secondary)]",
                    preflightMut.isPending && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {preflightMut.isPending ? 'Checking...' : 'Activate'}
                </button>
              )}
              <button
                onClick={handleDeleteClick}
                type="button"
                className={cn(
                  "rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)]",
                  "transition-smooth hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]"
                )}
              >
                Delete
              </button>
            </div>

            {lockError && (
              <p className="text-[13px] text-[var(--accent-amber)]">Another activation is in progress. Wait a moment and try again.</p>
            )}
          </div>

          {/* Right column (~65%) */}
          <div className="flex flex-col gap-8 lg:w-[65%]">
            {/* Components section */}
            <div>
              <h3 className="text-[20px] font-semibold text-[var(--text-primary)]">Components</h3>
              <p className="mb-4 mt-1 text-[13px] text-[var(--text-tertiary)]">Store-managed items included in this profile</p>
              <div className="flex flex-col gap-3">
                <ComponentGroup label="Agents" items={profile.agents ?? []} emptyText="No agents selected" />
                <ComponentGroup label="Skills" items={profile.skills ?? []} emptyText="No skills selected" />
                <ComponentGroup label="Commands" items={profile.commands ?? []} emptyText="No commands selected" />
                <ComponentGroup label="Plugins" items={profile.plugins ?? []} emptyText="No plugins selected" />
                {/* Model Config */}
                <div>
                  <div className="mb-1.5 text-[13px] font-medium text-[var(--text-primary)]">Model Config</div>
                  {profile.modelConfig && resolvedModelConfig ? (
                    <div>
                      <span className="inline-block rounded bg-white/[0.04] px-2 py-0.5 text-[12px] text-[var(--text-secondary)] border border-[var(--border-default)]">
                        {resolvedModelConfig.name}
                      </span>
                      <div className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                        {[
                          resolvedModelConfig.provider,
                          resolvedModelConfig.apiKey ? maskApiKey(resolvedModelConfig.apiKey) : null,
                          resolvedModelConfig.baseUrl,
                        ].filter(Boolean).join(' | ')}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-[var(--text-tertiary)]">No model config selected</p>
                  )}
                </div>
              </div>
            </div>

            {/* Runtime config section */}
            <div>
              <h3 className="text-[20px] font-semibold text-[var(--text-primary)]">Runtime config</h3>
              <p className="mb-4 mt-1 text-[13px] text-[var(--text-tertiary)]">Configuration blocks applied when this profile is activated</p>
              <div className="flex flex-col gap-3">
                <RuntimeGroup label="Hooks" keys={hooksKeys} emptyText="No hooks configured" />
                <RuntimeGroup label="MCP" keys={mcpKeys} emptyText="No MCP servers configured" />
                <RuntimeGroup label="LSP" keys={lspKeys} emptyText="No LSP servers configured" />
                <RuntimeGroup label="Settings" keys={settingsKeys} emptyText="No settings configured" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Dialog rendering */}
      {dialogState?.type === 'switch' && (
        <ConfirmSwitchDialog
          currentActive={dialogState.preflight.currentActive!}
          targetProfile={profile.name}
          missing={dialogState.preflight.missing}
          settingsWarnings={dialogState.preflight.settingsWarnings}
          modelConfigChanges={dialogState.preflight.modelConfigChanges}
          onConfirm={() => { onActivate(); setDialogState(null); }}
          onCancel={() => setDialogState(null)}
        />
      )}

      {dialogState?.type === 'activate-warn' && (
        <ActivateConfirmDialog
          targetProfile={profile.name}
          settingsWarnings={dialogState.preflight.settingsWarnings}
          modelConfigChanges={dialogState.preflight.modelConfigChanges}
          onConfirm={() => { onActivate(); setDialogState(null); }}
          onCancel={() => setDialogState(null)}
        />
      )}

      {dialogState?.type === 'blocked' && (
        <ActivationBlockedDialog
          profileName={profile.name}
          missing={dialogState.preflight.missing}
          onClose={() => setDialogState(null)}
        />
      )}

      {dialogState?.type === 'delete-active-blocked' && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDialogState(null);
          }}
        >
          <div
            className={cn(
              "p-6 max-w-md w-full mx-4 space-y-4",
              "bg-[var(--surface-raised)] border border-[var(--border-default)]",
              "rounded-[var(--radius-xl)]"
            )}
            autoFocus
          >
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Cannot delete active profile
            </h3>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Deactivate {profile.name} before deleting it.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDialogState(null)}
                className={cn(
                  "px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)]",
                  "bg-[var(--surface-overlay)] text-[var(--text-secondary)]",
                  "hover:bg-[var(--border-hover)] hover:text-[var(--text-primary)]",
                  "transition-colors duration-150"
                )}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
