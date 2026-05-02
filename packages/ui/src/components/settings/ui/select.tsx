import { Label } from '@/components/ui/label'
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface SelectFieldProperties extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string
  options: { value: string; label: string }[]
  error?: string
  value?: string
  onChange?: (e: { target: { value: string } }) => void
}

export function Select({ label, options, error, value, onChange, className, ..._properties }: SelectFieldProperties) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <Label className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
          {label}
        </Label>
      )}
      <ShadcnSelect
        value={value}
        onValueChange={(value_) => {
          onChange?.({ target: { value: value_ ?? '' } })
        }}
      >
        <SelectTrigger className={cn('w-full', className)}>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </ShadcnSelect>
      {error && (
        <span className="text-[12px] text-[var(--accent-red)]">{error}</span>
      )}
    </div>
  )
}
