import { cn } from '@/lib/utils';

interface ActivationBlockedDialogProps {
  profileName: string;
  missing: string[];
  onClose: () => void;
}

export function ActivationBlockedDialog({
  profileName,
  missing,
  onClose,
}: ActivationBlockedDialogProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className={cn(
          "p-6 max-w-md w-full mx-4 space-y-4",
          "bg-[var(--surface-raised)] border border-[var(--border-default)]",
          "rounded-[var(--radius-xl)]"
        )}
        autoFocus
      >
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          Cannot activate {profileName}
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)]">
          This profile references store components that no longer exist. Fix the profile before activating.
        </p>

        {missing.length > 0 && (
          <div className="bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/30 rounded-[var(--radius-md)] p-3">
            <p className="text-[var(--accent-amber)] text-[13px] font-medium mb-1">Missing components</p>
            <ul className="text-[var(--accent-amber)]/80 text-[13px] list-disc list-inside">
              {missing.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={cn(
            "px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)]",
            "bg-[var(--surface-overlay)] text-[var(--text-secondary)]",
            "hover:bg-[var(--border-hover)] hover:text-[var(--text-primary)]",
            "transition-colors duration-150"
          )}>Close</button>
        </div>
      </div>
    </div>
  );
}
