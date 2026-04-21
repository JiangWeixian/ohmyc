import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { NativeButton } from '@/components/uitripled/native-button';
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
          <NativeButton onClick={handleCreateSettings} disabled={isSaving} variant="default" size="sm">
            {isSaving ? 'Creating...' : 'Create settings.json'}
          </NativeButton>
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
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input id="model" value={formData.model || ''} onChange={(e) => updateField('model', e.target.value || undefined)} placeholder="claude-opus-4-5-20250514" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="available-models">Available Models (comma-separated)</Label>
            <Input id="available-models" value={formData.availableModels?.join(', ') || ''} onChange={(e) =>
              updateField(
                'availableModels',
                e.target.value
                  ? e.target.value
                      .split(',')
                      .map((m) => m.trim())
                      .filter(Boolean)
                  : undefined
              )
            } placeholder="claude-opus-4-5-20250514, claude-sonnet-4-20250514" />
          </div>
        </div>
      </section>

      {/* UI Section */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-default)] pb-2">
          UI
        </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Auto Updates Channel</Label>
            <Select value={formData.autoUpdatesChannel || 'stable'} onValueChange={(val) =>
              updateField('autoUpdatesChannel', val as 'stable' | 'beta')
            }>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stable">Stable</SelectItem>
                <SelectItem value="beta">Beta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Always Thinking Enabled</Label>
            <Switch checked={formData.alwaysThinkingEnabled || false} onCheckedChange={(checked) => updateField('alwaysThinkingEnabled', checked)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Show Turn Duration</Label>
            <Switch checked={formData.showTurnDuration || false} onCheckedChange={(checked) => updateField('showTurnDuration', checked)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Prefers Reduced Motion</Label>
            <Switch checked={formData.prefersReducedMotion || false} onCheckedChange={(checked) => updateField('prefersReducedMotion', checked)} />
          </div>
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
        <NativeButton onClick={handleSave} disabled={!hasChanges || isSaving} variant="default" size="sm">
          {isSaving ? 'Saving...' : 'Save'}
        </NativeButton>
      </footer>
    </div>
  );
}
