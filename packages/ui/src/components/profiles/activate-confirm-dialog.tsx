import { ModelConfigChangeList } from './model-config-change-list'
import { Button } from '@/components/ui/button'
import {
  NativeDialog,
  NativeDialogContent,
  NativeDialogFooter,
  NativeDialogTitle,
} from '@/components/uitripled/native-dialog'

import type { ModelConfigChanges } from '../../hooks/use-profiles'

interface ActivateConfirmDialogProperties {
  targetProfile: string
  settingsWarnings: string[]
  modelConfigChanges?: ModelConfigChanges
  onConfirm: () => void
  onCancel: () => void
}

export function ActivateConfirmDialog({
  targetProfile,
  settingsWarnings,
  modelConfigChanges,
  onConfirm,
  onCancel,
}: ActivateConfirmDialogProperties) {
  return (
    <NativeDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
    >
      <NativeDialogContent className="max-w-md bg-[var(--surface-raised)] border-[var(--border-default)] rounded-[var(--radius-xl)]">
        <NativeDialogTitle className="text-lg font-semibold text-[var(--text-primary)]">
          Activate {targetProfile}?
        </NativeDialogTitle>
        <p className="text-[13px] text-[var(--text-secondary)]">
          This profile will overwrite settings you manually configured.
        </p>

        {modelConfigChanges && modelConfigChanges.changes.length > 0 && (
          <ModelConfigChangeList
            title={`Model Config: ${modelConfigChanges.configName}`}
            changes={modelConfigChanges.changes}
          />
        )}

        {settingsWarnings.length > 0 && (
          <div className="bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/30 rounded-[var(--radius-md)] p-3">
            <p className="text-[var(--accent-amber)] text-[13px] font-medium mb-1">Affected settings</p>
            <ul className="text-[var(--accent-amber)]/80 text-[13px] list-disc list-inside">
              {settingsWarnings.map(w => <li key={w}>{w}</li>)}
            </ul>
          </div>
        )}

        <NativeDialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>Don't Activate</Button>
          <Button variant="default" size="sm" onClick={onConfirm}>
            Activate {targetProfile}
          </Button>
        </NativeDialogFooter>
      </NativeDialogContent>
    </NativeDialog>
  )
}
