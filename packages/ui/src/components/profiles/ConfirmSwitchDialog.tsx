import { NativeDialog, NativeDialogContent, NativeDialogTitle, NativeDialogFooter } from '@/components/uitripled/native-dialog';
import { Button } from '@/components/ui/button';
import { ModelConfigChangeList } from './ModelConfigChangeList';
import type { ModelConfigChanges } from '../../hooks/useProfiles';

interface ConfirmSwitchDialogProps {
  currentActive: string;
  targetProfile: string;
  missing: string[];
  settingsWarnings: string[];
  modelConfigChanges?: ModelConfigChanges;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSwitchDialog({
  currentActive,
  targetProfile,
  missing,
  settingsWarnings,
  modelConfigChanges,
  onConfirm,
  onCancel,
}: ConfirmSwitchDialogProps) {
  const hasMissing = missing.length > 0;

  return (
    <NativeDialog open={true} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <NativeDialogContent className="max-w-md bg-[var(--surface-raised)] border-[var(--border-default)] rounded-[var(--radius-xl)]">
        <NativeDialogTitle className="text-lg font-semibold text-[var(--text-primary)]">
          Switch profiles?
        </NativeDialogTitle>
        <p className="text-[13px] text-[var(--text-secondary)]">
          {currentActive} is active. Switch to {targetProfile}?
        </p>

        {modelConfigChanges?.deactivationChanges && modelConfigChanges.deactivationChanges.length > 0 && (
          <ModelConfigChangeList
            title={`Deactivating ${currentActive}:`}
            changes={modelConfigChanges.deactivationChanges}
          />
        )}

        {modelConfigChanges && modelConfigChanges.changes.length > 0 && (
          <ModelConfigChangeList
            title={`Activating ${targetProfile}:`}
            changes={modelConfigChanges.changes}
          />
        )}

        {hasMissing && (
          <div className="bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/30 rounded-[var(--radius-md)] p-3">
            <p className="text-[var(--accent-amber)] text-[13px] font-medium mb-1">Missing components</p>
            <ul className="text-[var(--accent-amber)]/80 text-[13px] list-disc list-inside">
              {missing.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}

        {!hasMissing && settingsWarnings.length > 0 && (
          <div className="bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/30 rounded-[var(--radius-md)] p-3">
            <p className="text-[var(--accent-amber)] text-[13px] font-medium mb-1">Affected settings</p>
            <ul className="text-[var(--accent-amber)]/80 text-[13px] list-disc list-inside">
              {settingsWarnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        )}

        <NativeDialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>Keep Current</Button>
          <Button variant="default" size="sm" onClick={hasMissing ? undefined : onConfirm} disabled={hasMissing}>
            {hasMissing ? 'Fix missing components first' : `Switch to ${targetProfile}`}
          </Button>
        </NativeDialogFooter>
      </NativeDialogContent>
    </NativeDialog>
  );
}
