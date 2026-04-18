import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Toggle } from './ui/Toggle';
import { Button } from './ui/Button';
import { Loader2 } from 'lucide-react';
import fastDeepEqual from 'fast-deep-equal';
import type { GeneralSettings } from '@claudeui/shared';

const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  model: undefined,
  availableModels: undefined,
  autoUpdatesChannel: 'stable',
  alwaysThinkingEnabled: false,
  showTurnDuration: false,
  prefersReducedMotion: false,
};

export function GeneralSettings() {
  const { data, isLoading, mutate, isSaving } = useSettings();
  const [formData, setFormData] = useState<GeneralSettings>(DEFAULT_GENERAL_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Initialize formData when data loads
  useEffect(() => {
    if (data?.content?.general) {
      setFormData({
        ...DEFAULT_GENERAL_SETTINGS,
        ...data.content.general,
      });
    }
  }, [data]);

  // Check for changes using fast-deep-equal
  useEffect(() => {
    const originalData = data?.content?.general || DEFAULT_GENERAL_SETTINGS;
    setHasChanges(!fastDeepEqual(formData, originalData));
  }, [formData, data]);

  const updateField = useCallback(
    <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setSaveStatus('idle');
    },
    []
  );

  const handleSave = useCallback(() => {
    setSaveStatus('saving');
    mutate(
      {
        ...(data?.content || {}),
        general: formData,
      },
      {
        onSuccess: () => {
          setSaveStatus('saved');
          setHasChanges(false);
        },
        onError: () => {
          setSaveStatus('error');
        },
      }
    );
  }, [mutate, data?.content, formData]);

  // Cmd+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !isSaving) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, isSaving, handleSave]);

  const handleCreateSettings = useCallback(() => {
    setSaveStatus('saving');
    mutate(
      { general: formData },
      {
        onSuccess: () => {
          setSaveStatus('saved');
          setHasChanges(false);
        },
        onError: () => {
          setSaveStatus('error');
        },
      }
    );
  }, [mutate, formData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  const settingsExists = data?.exists ?? false;

  if (!settingsExists) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">General</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Configure your general settings
          </p>
        </div>
        <div className="flex items-center justify-center py-12 border border-dashed border-[var(--border-default)] rounded-[var(--radius-lg)]">
          <Button onClick={handleCreateSettings} disabled={isSaving}>
            {isSaving ? 'Creating...' : 'Create settings.json'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">General</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Configure your general settings
        </p>
      </div>

      {/* Model Section */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-default)] pb-2">
          Model
        </h2>
        <div className="space-y-4">
          <Input
            label="Model"
            value={formData.model || ''}
            onChange={(e) => updateField('model', e.target.value || undefined)}
            placeholder="claude-opus-4-5-20250514"
          />
          <Input
            label="Available Models (comma-separated)"
            value={formData.availableModels?.join(', ') || ''}
            onChange={(e) =>
              updateField(
                'availableModels',
                e.target.value
                  ? e.target.value
                      .split(',')
                      .map((m) => m.trim())
                      .filter(Boolean)
                  : undefined
              )
            }
            placeholder="claude-opus-4-5-20250514, claude-sonnet-4-20250514"
          />
        </div>
      </section>

      {/* UI Section */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-default)] pb-2">
          UI
        </h2>
        <div className="space-y-4">
          <Select
            label="Auto Updates Channel"
            value={formData.autoUpdatesChannel || 'stable'}
            onChange={(e) =>
              updateField('autoUpdatesChannel', e.target.value as 'stable' | 'beta')
            }
            options={[
              { value: 'stable', label: 'Stable' },
              { value: 'beta', label: 'Beta' },
            ]}
          />
          <Toggle
            label="Always Thinking Enabled"
            checked={formData.alwaysThinkingEnabled || false}
            onChange={(checked) => updateField('alwaysThinkingEnabled', checked)}
          />
          <Toggle
            label="Show Turn Duration"
            checked={formData.showTurnDuration || false}
            onChange={(checked) => updateField('showTurnDuration', checked)}
          />
          <Toggle
            label="Prefers Reduced Motion"
            checked={formData.prefersReducedMotion || false}
            onChange={(checked) => updateField('prefersReducedMotion', checked)}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="flex justify-between items-center pt-4 border-t border-[var(--border-default)]">
        <span className="text-sm text-[var(--text-secondary)]">
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && 'Error saving'}
          {saveStatus === 'idle' && hasChanges && 'Unsaved changes'}
          {saveStatus === 'idle' && !hasChanges && 'No changes'}
        </span>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </footer>
    </div>
  );
}
