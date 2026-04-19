import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useStoreImport } from '../../hooks/useStore';
import type { StoreImportResult } from '@claudeui/shared';

interface ImportComponentsDialogProps {
  onClose: () => void;
}

export function ImportComponentsDialog({ onClose }: ImportComponentsDialogProps) {
  const [sourceDir, setSourceDir] = useState('');
  const [preview, setPreview] = useState<StoreImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const importMutation = useStoreImport();

  const runPreview = async () => {
    if (!sourceDir.trim()) {
      setError('Source directory is required');
      return;
    }

    setError(null);
    setPreview(null);

    try {
      const result = await importMutation.previewImport(sourceDir);
      setPreview(result);

      if ((result.conflicts?.length ?? 0) === 0) {
        setIsApplying(true);
        await importMutation.applyImport(sourceDir, false);
        onClose();
      }
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Couldn’t complete this action. Review the conflicting items or filesystem details, then try again.');
    } finally {
      setIsApplying(false);
    }
  };

  const overwriteAll = async () => {
    setError(null);
    setIsApplying(true);

    try {
      await importMutation.applyImport(sourceDir, true);
      onClose();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Couldn’t complete this action. Review the conflicting items or filesystem details, then try again.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className={cn(
          "mx-4 w-full max-w-2xl space-y-4 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-raised)] p-6",
        )}
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Import Components</h2>
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Preview a Claude-compatible directory before importing it into the store.
          </p>
        </div>

        <label className="block text-[12px] text-[var(--text-tertiary)]">
          Source directory
          <input
            aria-label="Source directory"
            value={sourceDir}
            onChange={(event) => setSourceDir(event.target.value)}
            placeholder="/path/to/.claude"
            className={cn(
              "mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-[13px] text-[var(--text-primary)]",
              "focus:outline-none focus:border-[var(--accent-blue)]",
            )}
          />
        </label>

        {error ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-4 py-3 text-[13px] text-[var(--accent-red)]">
            {error}
          </div>
        ) : null}

        {preview?.conflicts?.length ? (
          <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10 p-4">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Overwrite existing components?
            </h3>
            <ul className="space-y-2 text-[13px] text-[var(--text-secondary)]">
              {preview.conflicts.map((conflict) => (
                <li key={`${conflict.type}:${conflict.id}`} className="rounded-[var(--radius-md)] bg-[var(--surface-raised)] px-3 py-2">
                  <div className="font-medium text-[var(--text-primary)]">{conflict.id}</div>
                  <div>{conflict.type}</div>
                  <div className="text-[12px] text-[var(--text-tertiary)]">{conflict.sourcePath}</div>
                  <div className="text-[12px] text-[var(--text-tertiary)]">{conflict.destinationPath}</div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-[var(--radius-md)] bg-[var(--surface-overlay)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)]",
            )}
          >
            Cancel
          </button>
          {preview?.conflicts?.length ? (
            <button
              type="button"
              onClick={overwriteAll}
              disabled={isApplying}
              className={cn(
                "rounded-[var(--radius-md)] bg-[var(--accent-red)] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50",
              )}
            >
              Overwrite All
            </button>
          ) : (
            <button
              type="button"
              onClick={runPreview}
              disabled={isApplying || importMutation.isPending}
              className={cn(
                "rounded-[var(--radius-md)] bg-[var(--accent-blue)] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50",
              )}
            >
              Import Components
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
