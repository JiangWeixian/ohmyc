import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { toast } from 'sonner'

import { ComparePanel } from './components/compare-panel'
import { Header } from './components/header'
import { ProfileCard } from './components/profiles/profile-card'
import { ProfileEditor } from './components/profiles/profile-editor'
import { ProfilesSidebar, type SidebarSelection } from './components/profiles/profiles-sidebar'
import { StoreComponentEditor } from './components/store/store-component-editor'
import { StoreComponentList } from './components/store/store-component-list'
import {
  useActivateProfile,
  useDeactivateProfile,
  useDeleteProfile,
  useProfile,
  useProfiles,
} from './hooks/use-profiles'
import { cn } from '@/lib/utils'

import type { Profile } from '@claudeui/shared'

function getInitials(name: string): string {
  return name
    .split(/[-_\s]/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

function ProfileRow({
  profile,
  isActive,
  onActivate,
  onCompare,
  onSelect,
}: {
  profile: Profile
  isActive: boolean
  onActivate: () => void
  onCompare: () => void
  onSelect: () => void
}) {
  const agentCount = profile.agents?.length ?? 0
  const skillCount = profile.skills?.length ?? 0
  const commandCount = profile.commands?.length ?? 0
  const pluginCount = profile.plugins?.length ?? 0

  const parts: string[] = []
  if (pluginCount > 0) {
    parts.push(`${pluginCount} plugin${pluginCount === 1 ? '' : 's'}`)
  }
  if (agentCount > 0) {
    parts.push(`${agentCount} agent${agentCount === 1 ? '' : 's'}`)
  }
  if (skillCount > 0) {
    parts.push(`${skillCount} skill${skillCount === 1 ? '' : 's'}`)
  }
  if (commandCount > 0) {
    parts.push(`${commandCount} command${commandCount === 1 ? '' : 's'}`)
  }
  const detail = parts.join(' · ') || 'Empty profile'

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect()}
      className={cn(
        'group flex cursor-pointer items-center gap-4 rounded-lg border px-5 py-[18px] transition-colors duration-150',
        'bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]',
        isActive
          ? 'border-[rgba(255,255,255,0.18)]'
          : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.12)]',
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.06)] text-[12px] font-[590] tracking-[0.02em] text-[var(--text-secondary)]">
        {getInitials(profile.name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="truncate text-[15px] font-[510] text-[var(--text-primary)]">{profile.name}</span>
          {isActive && (
            <span className="shrink-0 rounded-[3px] bg-[var(--text-primary)] px-1.5 py-px text-[10px] font-[590] uppercase tracking-[0.04em] text-[var(--bg-marketing)]">
              Active
            </span>
          )}
        </div>
        <div className="font-mono text-[12px] tracking-[0.01em] text-[var(--text-tertiary)]">{detail}</div>
      </div>

      {!isActive && (
        <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCompare()
            }}
            type="button"
            className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-[12px] font-[510] text-[var(--text-secondary)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-primary)]"
          >
            Compare with active
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onActivate()
            }}
            type="button"
            className="rounded-md border-transparent bg-[var(--text-primary)] px-3 py-1.5 text-[12px] font-[510] text-[var(--bg-marketing)] transition-colors hover:bg-[var(--text-secondary)]"
          >
            Activate
          </button>
        </div>
      )}
    </div>
  )
}

interface ParsedRoute {
  selection: SidebarSelection | null
  editing: boolean
}

function parseSelection(parameters: Record<string, string | undefined>): ParsedRoute {
  const { '*': rest } = parameters
  if (!rest) {
    return { selection: null, editing: false }
  }
  if (rest === 'new') {
    return { selection: { type: 'new-profile' }, editing: false }
  }
  if (rest === 'agents') {
    return { selection: { type: 'components', category: 'agents' }, editing: false }
  }
  if (rest === 'skills') {
    return { selection: { type: 'components', category: 'skills' }, editing: false }
  }
  if (rest === 'commands') {
    return { selection: { type: 'components', category: 'commands' }, editing: false }
  }
  if (rest === 'model-configs') {
    return { selection: { type: 'components', category: 'model-configs' }, editing: false }
  }

  // Handle edit route: /profiles/:name/edit
  if (rest.endsWith('/edit')) {
    const name = rest.slice(0, -5)
    return { selection: { type: 'profile', name }, editing: true }
  }

  return { selection: { type: 'profile', name: rest }, editing: false }
}

interface ProfilesViewProperties {
  viewSwitcher?: React.ReactNode
}

export function ProfilesView({ viewSwitcher }: ProfilesViewProperties) {
  const parameters = useParams()
  const navigate = useNavigate()
  const { selection, editing } = parseSelection(parameters)
  const [compareTarget, setCompareTarget] = useState<Profile | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const { data } = useProfiles()
  const profiles = useMemo(() => data?.profiles ?? [], [data])
  const active = data?.active ?? null

  const isCompareOpen = compareTarget !== null
  const [componentEditTarget, setComponentEditTarget]
    = useState<{ category: 'agents' | 'commands' | 'model-configs' | 'skills'; name?: string } | null>(null)
  const componentCategory = selection?.type === 'components' ? selection.category : null
  // Reset component-edit target when sidebar category or selection changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect, react/set-state-in-effect, react-hooks-extra/set-state-in-effect, react-naming-convention/set-state-in-effect */
    setComponentEditTarget(previous => (previous === null ? previous : null))
    /* eslint-enable react-hooks/set-state-in-effect, react/set-state-in-effect, react-hooks-extra/set-state-in-effect, react-naming-convention/set-state-in-effect */
  }, [componentCategory, selection?.type])
  const isEditorRoute
    = selection?.type === 'new-profile'
      || (selection?.type === 'profile' && editing)
      || (selection?.type === 'components' && componentEditTarget !== null)

  const selectedProfileName = selection?.type === 'profile' ? selection.name : null
  const { data: selectedProfile } = useProfile(selectedProfileName)

  const activateMut = useActivateProfile()
  const deactivateMut = useDeactivateProfile()
  const deleteMut = useDeleteProfile()

  const handleSelect = (sel: SidebarSelection) => {
    switch (sel.type) {
      case 'new-profile': { navigate('/profiles/new')
        break
      }
      case 'components': { navigate(`/profiles/${sel.category}`)
        break
      }
      case 'profile': { navigate(`/profiles/${sel.name}`)
        break
      }
    // No default
    }
  }

  const handleActivate = (name: string) => {
    activateMut.mutate(name, {
      onSuccess: () => {
        toast.success(`Activated ${name}`)
      },
      onError: () => {
        toast.error(`Failed to activate ${name}`)
      },
    })
  }

  const handleDeactivate = (name: string) => {
    deactivateMut.mutate(name, {
      onSuccess: () => {
        toast.success(`Deactivated ${name}`)
      },
      onError: () => {
        toast.error(`Failed to deactivate ${name}`)
      },
    })
  }

  const handleDelete = (name: string) => {
    // eslint-disable-next-line no-alert
    if (!confirm(`Delete ${name}? This removes the saved composition only. Store components stay in your library.`)) {
      return
    }
    deleteMut.mutate(name, {
      onSuccess: () => {
        toast.success(`Deleted ${name}`)
        navigate('/profiles')
      },
      onError: () => {
        toast.error(`Failed to delete ${name}`)
      },
    })
  }

  // Route-specific keyboard shortcuts
  useEffect(() => {
    const isInputFocused = () => {
      const el = document.activeElement
      return (
        el instanceof HTMLInputElement
        || el instanceof HTMLTextAreaElement
        || el?.getAttribute('contenteditable') === 'true'
      )
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) {
        return
      }

      if ((e.metaKey || e.ctrlKey) && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault()
        const index = Number.parseInt(e.key, 10) - 1
        const profile = profiles[index]
        if (profile) {
          handleActivate(profile.name)
        }
        return
      }

      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && active) {
        const target = profiles.find(p => p.name !== active)
        if (target) {
          setCompareTarget(target)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  /* eslint-disable react-hooks/exhaustive-deps, react/exhaustive-deps, react-hooks-extra/exhaustive-deps, react-naming-convention/exhaustive-deps */
  }, [profiles, active])
  /* eslint-enable react-hooks/exhaustive-deps, react/exhaustive-deps, react-hooks-extra/exhaustive-deps, react-naming-convention/exhaustive-deps */

  useEffect(() => {
    const action = searchParams.get('action')
    const compareName = searchParams.get('compare')
    if ((action === 'compare' || compareName) && active) {
      const target = compareName
        ? profiles.find(p => p.name === compareName && p.name !== active)
        : profiles.find(p => p.name !== active)
      if (target) {
        /* eslint-disable react-hooks/set-state-in-effect, react/set-state-in-effect, react-hooks-extra/set-state-in-effect, react-naming-convention/set-state-in-effect */
        setCompareTarget(target)
        /* eslint-enable react-hooks/set-state-in-effect, react/set-state-in-effect, react-hooks-extra/set-state-in-effect, react-naming-convention/set-state-in-effect */
      }
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      newParams.delete('compare')
      setSearchParams(newParams, { replace: true })
    }
  }, [searchParams, active, profiles, setSearchParams])

  const renderBody = () => {
    if (selection === null) {
      return (
        <div>
          <h1 className="mb-1 text-[24px] font-[590] leading-[1.33] tracking-[-0.2px] text-[var(--text-primary)]">Profiles</h1>
          <p className="mb-8 text-[14px] text-[var(--text-tertiary)]">
            Compose, switch, and compare your <code className="text-[var(--text-secondary)]">.claude</code> setups.
          </p>
          <div className="flex flex-col gap-2">
            {profiles.map(profile => (
              <ProfileRow
                key={profile.name}
                profile={profile}
                isActive={active === profile.name}
                onActivate={() => handleActivate(profile.name)}
                onCompare={() => setCompareTarget(profile)}
                onSelect={() => handleSelect({ type: 'profile', name: profile.name })}
              />
            ))}
            <div
              onClick={() => handleSelect({ type: 'new-profile' })}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && handleSelect({ type: 'new-profile' })}
              className="flex cursor-pointer items-center gap-4 rounded-lg border border-[rgba(255,255,255,0.08)] px-5 py-[18px] transition-colors duration-150 hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.02)]"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-[18px] font-[300] text-[var(--text-tertiary)]">+</div>
              <div>
                <div className="text-[15px] font-[510] text-[var(--text-tertiary)]">Create new profile</div>
                <div className="font-mono text-[12px] text-[var(--text-quaternary)]">Empty composition you can build from store components</div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (selection.type === 'profile' && selectedProfile) {
      if (editing) {
        return (
          <ProfileEditor
            profile={selectedProfile}
            onSaved={() => navigate(`/profiles/${selectedProfile.name}`)}
            onCancel={() => navigate(`/profiles/${selectedProfile.name}`)}
          />
        )
      }
      return (
        <ProfileCard
          profile={selectedProfile}
          isActive={active === selectedProfile.name}
          activeProfileName={active}
          onActivate={() => handleActivate(selectedProfile.name)}
          onDeactivate={() => handleDeactivate(selectedProfile.name)}
          onDelete={() => handleDelete(selectedProfile.name)}
          onEdit={() => navigate(`/profiles/${selectedProfile.name}/edit`)}
        />
      )
    }

    if (selection.type === 'new-profile') {
      return (
        <ProfileEditor
          onSaved={name => navigate(`/profiles/${name}`)}
          onCancel={() => navigate('/profiles')}
        />
      )
    }

    if (selection.type === 'components') {
      if (componentEditTarget && componentEditTarget.category === selection.category) {
        return (
          <StoreComponentEditor
            category={componentEditTarget.category}
            editName={componentEditTarget.name}
            onSaved={() => setComponentEditTarget(null)}
            onCancel={() => setComponentEditTarget(null)}
          />
        )
      }
      return (
        <StoreComponentList
          category={selection.category}
          onEdit={(category, name) => setComponentEditTarget({ category, name })}
        />
      )
    }

    return null
  }

  return (
    <div className="flex h-full min-w-0">
      <ProfilesSidebar
        profiles={profiles}
        active={active}
        selection={selection}
        onSelect={handleSelect}
        onCompare={(name) => {
          const target = profiles.find(p => p.name === name)
          if (target) {
            setCompareTarget(target)
          }
        }}
        onActivate={handleActivate}
        headerSlot={viewSwitcher}
      />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-marketing)]">
        {!isEditorRoute && <Header />}
        {isEditorRoute
          ? renderBody()
          : (
              <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[920px] px-14 py-10">
                  {renderBody()}
                </div>
              </div>
            )}
      </main>

      <ComparePanel
        open={isCompareOpen}
        onClose={() => setCompareTarget(null)}
        activeProfile={profiles.find(p => p.name === active) || null}
        targetProfile={compareTarget}
        onActivateTarget={() => {
          if (compareTarget) {
            handleActivate(compareTarget.name)
            setCompareTarget(null)
          }
        }}
      />
    </div>
  )
}
