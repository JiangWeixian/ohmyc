import { Button } from '@/components/ui/button'
import {
  NativeDialog,
  NativeDialogContent,
  NativeDialogFooter,
  NativeDialogTitle,
} from '@/components/uitripled/native-dialog'

interface DeleteConfirmDialogProperties {
  name: string
  referencedBy: string[]
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmDialog({ name, referencedBy, onConfirm, onCancel }: DeleteConfirmDialogProperties) {
  const isReferenced = referencedBy.length > 0

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
          {isReferenced
            ? 'This component is still referenced by profiles. Delete anyway?'
            : 'Delete this store component?'}
        </NativeDialogTitle>
        <p className="text-[13px] text-[var(--text-secondary)]">{name}</p>
        {isReferenced && (
          <div className="bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/30 rounded-[var(--radius-md)] p-3">
            <p className="text-[var(--accent-amber)] text-[13px] font-medium mb-1">Referenced by profiles:</p>
            <ul className="text-[var(--accent-amber)]/80 text-[13px] list-disc list-inside">
              {referencedBy.map(r => <li key={r}>{r}</li>)}
            </ul>
          </div>
        )}
        <p className="text-[var(--text-secondary)] text-[13px]">This action cannot be undone.</p>
        <NativeDialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            {isReferenced ? 'Delete anyway?' : 'Delete'}
          </Button>
        </NativeDialogFooter>
      </NativeDialogContent>
    </NativeDialog>
  )
}
