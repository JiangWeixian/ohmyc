import { ChevronDown, User } from 'lucide-react'
import { useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useActivateProfile, useProfiles } from '@/hooks/use-profiles'
import { cn } from '@/lib/utils'

interface ActiveProfileChipProps {
  onCompare?: () => void
  onNavigateToProfiles?: () => void
}

export function ActiveProfileChip({ onCompare, onNavigateToProfiles }: ActiveProfileChipProps) {
  const { data, isLoading } = useProfiles()
  const active = data?.active
  const profiles = data?.profiles ?? []
  const activateMutation = useActivateProfile()
  const [open, setOpen] = useState(false)

  const activeProfile = profiles.find(p => p.name === active)
  const hasActive = !!activeProfile

  const handleActivate = (name: string) => {
    activateMutation.mutate(name)
    setOpen(false)
  }

  const handleCompare = () => {
    setOpen(false)
    if (onCompare) {
      onCompare()
    } else {
      globalThis.location.href = '/profiles?action=compare'
    }
  }

  const handleManage = () => {
    setOpen(false)
    if (onNavigateToProfiles) {
      onNavigateToProfiles()
    } else {
      globalThis.location.href = '/profiles'
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'h-9 px-3 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]',
            'flex items-center gap-2 cursor-pointer',
            'hover:bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.14)]',
            'transition-all duration-150',
          )}
        >
          {hasActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#f7f8f8]" />
          )}
          <span className="text-[12px] font-[510]">
            {hasActive
              ? (
              <>
                <span className="text-[#8a8f98]">Active</span>{' '}
                <span className="text-[#d0d6e0]">{activeProfile.name}</span>
              </>
                )
              : (
              <span className="text-[#62666d]">
                {isLoading ? '…' : 'No active profile'}
              </span>
                )}
          </span>
          <ChevronDown size={12} className="text-[#8a8f98]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-[#191a1b] border-[rgba(255,255,255,0.08)]"
      >
        {profiles.length === 0
          ? (
          <DropdownMenuItem disabled className="text-[#8a8f98]">
            No profiles available
          </DropdownMenuItem>
            )
          : (
              profiles.map(profile => (
            <DropdownMenuItem
              key={profile.name}
              onClick={() => handleActivate(profile.name)}
              className={cn(
                'text-[13px] cursor-pointer',
                profile.name === active
                  ? 'text-[#f7f8f8] bg-[rgba(255,255,255,0.08)]'
                  : 'text-[#d0d6e0]',
              )}
            >
              <User size={14} className="mr-2" />
              {profile.name}
              {profile.name === active && (
                <span className="ml-auto text-[10px] text-[#8a8f98]">Active</span>
              )}
            </DropdownMenuItem>
              ))
            )}
        <DropdownMenuSeparator className="bg-[rgba(255,255,255,0.08)]" />
        <DropdownMenuItem
          onClick={handleCompare}
          className="text-[13px] text-[#d0d6e0] cursor-pointer"
        >
          Compare…
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleManage}
          className="text-[13px] text-[#d0d6e0] cursor-pointer"
        >
          Manage profiles →
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
