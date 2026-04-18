import { cn } from '../cn';
import type { ModelConfigChanges } from '../../hooks/useProfiles';

function truncateUrl(url: string, maxLen = 40): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, 20) + '...' + url.slice(-15);
}

interface ActivateConfirmDialogProps {
  targetProfile: string;
  settingsWarnings: string[];
  modelConfigChanges?: ModelConfigChanges;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ActivateConfirmDialog({
  targetProfile,
  settingsWarnings,
  modelConfigChanges,
  onConfirm,
  onCancel,
}: ActivateConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
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
          Activate {targetProfile}?
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)]">
          This profile will overwrite settings you manually configured.
        </p>

        {modelConfigChanges && modelConfigChanges.changes.length > 0 && (
          <div className="bg-[#5E6AD2]/8 border border-[#5E6AD2]/15 rounded-[var(--radius-md)] p-4">
            <p className="text-[#5E6AD2] text-[13px] font-semibold mb-1">
              Model Config: {modelConfigChanges.configName}
            </p>
            <ul className="text-[13px] font-mono space-y-0.5">
              {modelConfigChanges.changes.map(c => (
                <li key={c.key}>
                  <span className="text-[var(--accent-amber)] font-semibold">{c.action}</span>{' '}
                  <span className="text-[var(--text-secondary)]">
                    {c.action === 'REMOVE' ? c.key : `${c.key}=${c.key === 'ANTHROPIC_AUTH_TOKEN' || c.key === 'ANTHROPIC_BASE_URL' || c.key === 'API_TIMEOUT_MS' ? truncateUrl(c.value) : c.value}`}
                  </span>
                  {c.action === 'CHANGE' && c.previousValue && (
                    <span className="text-[var(--text-tertiary)]"> (was: {c.key === 'ANTHROPIC_AUTH_TOKEN' || c.key === 'ANTHROPIC_BASE_URL' || c.key === 'API_TIMEOUT_MS' ? truncateUrl(c.previousValue) : c.previousValue})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {settingsWarnings.length > 0 && (
          <div className="bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/30 rounded-[var(--radius-md)] p-3">
            <p className="text-[var(--accent-amber)] text-[13px] font-medium mb-1">Affected settings</p>
            <ul className="text-[var(--accent-amber)]/80 text-[13px] list-disc list-inside">
              {settingsWarnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className={cn(
            "px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)]",
            "bg-[var(--surface-overlay)] text-[var(--text-secondary)]",
            "hover:bg-[var(--border-hover)] hover:text-[var(--text-primary)]",
            "transition-colors duration-150"
          )}>Don't Activate</button>
          <button onClick={onConfirm} className={cn(
            "px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)]",
            "bg-[var(--accent-blue)] text-white",
            "hover:bg-[var(--accent-blue-hover)]",
            "transition-colors duration-150"
          )}>
            Activate {targetProfile}
          </button>
        </div>
      </div>
    </div>
  );
}
