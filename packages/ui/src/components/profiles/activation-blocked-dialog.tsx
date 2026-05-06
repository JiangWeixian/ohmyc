// Dialog shown when activation is blocked because the profile references
// store components that no longer exist.

import { Button } from '@/components/ui/button'
import {
  NativeDialog,
  NativeDialogContent,
  NativeDialogFooter,
  NativeDialogTitle,
} from '@/components/uitripled/native-dialog'

interface ActivationBlockedDialogProperties {
  profileName: string
  missing: string[]
  onClose: () => void
}

/** Lists missing components and explains why activation is blocked. */
export function ActivationBlockedDialog({
  profileName,
  missing,
  onClose,
}: ActivationBlockedDialogProperties) {
  return (
    <NativeDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <NativeDialogContent className="max-w-md bg-[var(--surface-raised)] border-[var(--border-default)] rounded-[var(--radius-xl)]">
        <NativeDialogTitle className="text-lg font-semibold text-[var(--text-primary)]">
          Cannot activate {profileName}
        </NativeDialogTitle>
        <p className="text-[13px] text-[var(--text-secondary)]">
          This profile references store components that no longer exist. Fix the profile before activating.
        </p>

        {missing.length > 0 && (
          <div className="bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/30 rounded-[var(--radius-md)] p-3">
            <p className="text-[var(--accent-amber)] text-[13px] font-medium mb-1">Missing components</p>
            <ul className="text-[var(--accent-amber)]/80 text-[13px] list-disc list-inside">
              {missing.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}

        <NativeDialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </NativeDialogFooter>
      </NativeDialogContent>
    </NativeDialog>
  )
}
