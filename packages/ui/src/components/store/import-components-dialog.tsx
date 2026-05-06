// Import components dialog — previews a Claude-compatible directory before
// importing into the store, with conflict resolution when items already exist.
import { useState } from 'react'

import { useStoreImport } from '../../hooks/use-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  NativeDialog,
  NativeDialogContent,
  NativeDialogFooter,
  NativeDialogTitle,
} from '@/components/uitripled/native-dialog'

import type { StoreImportResult } from '@ohmyc/shared'

interface ImportComponentsDialogProperties {
  onClose: () => void
}

/**
 * Modal dialog that previews and imports store components from an external directory.
 * When no conflicts are found the import applies immediately; otherwise the user
 * must explicitly choose "Overwrite All" to proceed.
 */
export function ImportComponentsDialog({ onClose }: ImportComponentsDialogProperties) {
  const [sourceDir, setSourceDir] = useState('')
  const [preview, setPreview] = useState<StoreImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const importMutation = useStoreImport()

  // Preview-then-apply: run a dry-run first; auto-apply only if zero conflicts.
  const runPreview = async () => {
    if (!sourceDir.trim()) {
      setError('Source directory is required')
      return
    }

    setError(null)
    setPreview(null)

    try {
      const result = await importMutation.previewImport(sourceDir)
      setPreview(result)

      // No conflicts — apply immediately without user confirmation.
      if ((result.conflicts?.length ?? 0) === 0) {
        setIsApplying(true)
        await importMutation.applyImport(sourceDir, false)
        onClose()
      }
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Couldn\'t complete this action. Review the conflicting items or filesystem details, then try again.')
    } finally {
      setIsApplying(false)
    }
  }

  // User explicitly chose to overwrite existing items after seeing conflict list.
  const overwriteAll = async () => {
    setError(null)
    setIsApplying(true)

    try {
      await importMutation.applyImport(sourceDir, true)
      onClose()
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Couldn\'t complete this action. Review the conflicting items or filesystem details, then try again.')
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <NativeDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <NativeDialogContent className="max-w-2xl bg-[var(--surface-raised)] border-[var(--border-default)] rounded-[var(--radius-xl)]">
        <NativeDialogTitle className="text-lg font-semibold text-[var(--text-primary)]">Import Components</NativeDialogTitle>
        <p className="text-[13px] text-[var(--text-tertiary)]">
          Preview a Claude-compatible directory before importing it into the store.
        </p>

        <Input
          aria-label="Source directory"
          value={sourceDir}
          onChange={e => setSourceDir(e.target.value)}
          placeholder="/path/to/.claude"
        />

        {error && (
          <div className="rounded-[var(--radius-md)] border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-4 py-3 text-[13px] text-[var(--accent-red)]">
            {error}
          </div>
        )}

        {preview?.conflicts?.length
          ? (
          <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10 p-4">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Overwrite existing components?
            </h3>
            <ul className="space-y-2 text-[13px] text-[var(--text-secondary)]">
              {preview.conflicts.map(conflict => (
                <li key={`${conflict.type}:${conflict.id}`} className="rounded-[var(--radius-md)] bg-[var(--surface-raised)] px-3 py-2">
                  <div className="font-medium text-[var(--text-primary)]">{conflict.id}</div>
                  <div>{conflict.type}</div>
                  <div className="text-[12px] text-[var(--text-tertiary)]">{conflict.sourcePath}</div>
                  <div className="text-[12px] text-[var(--text-tertiary)]">{conflict.destinationPath}</div>
                </li>
              ))}
            </ul>
          </div>
            )
          : null}

        <NativeDialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          {preview?.conflicts?.length
            ? (
            <Button variant="destructive" size="sm" onClick={overwriteAll} disabled={isApplying}>
              Overwrite All
            </Button>
              )
            : (
            <Button variant="default" size="sm" onClick={runPreview} disabled={isApplying || importMutation.isPending}>
              Import Components
            </Button>
              )}
        </NativeDialogFooter>
      </NativeDialogContent>
    </NativeDialog>
  )
}
