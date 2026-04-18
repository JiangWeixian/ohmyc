import { cn } from '../cn';
import type { ModelConfigChanges } from '../../hooks/useProfiles';

function truncateUrl(url: string, maxLen = 40): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, 20) + '...' + url.slice(-15);
}

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
          Switch profiles?
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)]">
          {currentActive} is active. Switch to {targetProfile}?
        </p>

        {modelConfigChanges?.deactivationChanges && modelConfigChanges.deactivationChanges.length > 0 && (
          <div className="bg-[#5E6AD2]/8 border border-[#5E6AD2]/15 rounded-[var(--radius-md)] p-4">
            <p className="text-[#5E6AD2] text-[13px] font-semibold mb-1">
              Deactivating {currentActive}:
            </p>
            <ul className="text-[13px] font-mono space-y-0.5">
              {modelConfigChanges.deactivationChanges.map(c => (
                <li key={c.key}>
                  <span className="text-[var(--accent-amber)] font-semibold">{c.action}</span>{' '}
                  <span className="text-[var(--text-secondary)]">{c.key}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {modelConfigChanges && modelConfigChanges.changes.length > 0 && (
          <div className="bg-[#5E6AD2]/8 border border-[#5E6AD2]/15 rounded-[var(--radius-md)] p-4">
            <p className="text-[#5E6AD2] text-[13px] font-semibold mb-1">
              Activating {targetProfile}:
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

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className={cn(
            "px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)]",
            "bg-[var(--surface-overlay)] text-[var(--text-secondary)]",
            "hover:bg-[var(--border-hover)] hover:text-[var(--text-primary)]",
            "transition-colors duration-150"
          )}>Keep Current</button>
          <button
            onClick={hasMissing ? undefined : onConfirm}
            disabled={hasMissing}
            className={cn(
              "px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)]",
              "bg-[var(--accent-blue)] text-white",
              "hover:bg-[var(--accent-blue-hover)]",
              "transition-colors duration-150",
              hasMissing && "opacity-50 cursor-not-allowed"
            )}
          >
            {hasMissing ? 'Fix missing components first' : `Switch to ${targetProfile}`}
          </button>
        </div>
      </div>
    </div>
  );
}
