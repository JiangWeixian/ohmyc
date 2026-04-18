import { cn } from '../cn';

interface DeleteConfirmDialogProps {
  name: string;
  referencedBy: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({ name, referencedBy, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  const isReferenced = referencedBy.length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className={cn(
        "p-6 max-w-md w-full mx-4 space-y-4",
        "bg-[var(--surface-raised)] border border-[var(--border-default)]",
        "rounded-[var(--radius-xl)]"
      )}>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {isReferenced
            ? 'This component is still referenced by profiles. Delete anyway?'
            : 'Delete this store component?'}
        </h3>
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
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className={cn(
            "px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)]",
            "bg-[var(--surface-overlay)] text-[var(--text-secondary)]",
            "hover:bg-[var(--border-hover)] hover:text-[var(--text-primary)]",
            "transition-colors duration-150"
          )}>Cancel</button>
          <button onClick={onConfirm} className={cn(
            "px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)]",
            "bg-[var(--accent-red)] text-white",
            "hover:bg-[var(--accent-red)]/90",
            "transition-colors duration-150"
          )}>
            {isReferenced ? 'Delete anyway?' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
