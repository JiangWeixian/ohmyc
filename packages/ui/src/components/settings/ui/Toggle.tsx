import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-start gap-3">
      <Switch checked={checked} onCheckedChange={onChange} />
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <label
              className="text-[13px] font-medium text-[var(--text-primary)] cursor-pointer"
              onClick={() => onChange(!checked)}
            >
              {label}
            </label>
          )}
          {description && (
            <span className="text-[12px] text-[var(--text-tertiary)]">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
