import { cn } from '@/lib/utils';
import { Input as ShadcnInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <Label className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
          {label}
        </Label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
            {icon}
          </div>
        )}
        <ShadcnInput
          className={cn(
            icon && 'pl-9',
            error && 'border-[var(--accent-red)] focus:border-[var(--accent-red)]',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <span className="text-[12px] text-[var(--accent-red)]">
          {error}
        </span>
      )}
    </div>
  );
}
