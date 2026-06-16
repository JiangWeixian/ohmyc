// Delete confirmation dialog for store components.
import { Button } from '@/components/ui/button'
import {
  NativeDialog,
  NativeDialogContent,
  NativeDialogFooter,
  NativeDialogTitle,
} from '@/components/uitripled/native-dialog'

interface DeleteConfirmDialogProperties {
  name: string
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmation dialog for deleting a store component. */
export function DeleteConfirmDialog({ name, onConfirm, onCancel }: DeleteConfirmDialogProperties) {
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
          Delete this store component?
        </NativeDialogTitle>
        <p className="text-[13px] text-[var(--text-secondary)]">{name}</p>
        <p className="text-[var(--text-secondary)] text-[13px]">This action cannot be undone.</p>
        <NativeDialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>Delete</Button>
        </NativeDialogFooter>
      </NativeDialogContent>
    </NativeDialog>
  )
}
