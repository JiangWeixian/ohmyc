import { AnimatePresence, motion } from 'framer-motion'
import { FolderOpen, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { toast } from 'sonner'

import { ComparePanel } from './components/compare-panel'
import { ProfileCard } from './components/profiles/profile-card'
import { ProfileEditor } from './components/profiles/profile-editor'
import { ProfilesSidebar, type SidebarSelection } from './components/profiles/profiles-sidebar'
import { StoreComponentList } from './components/store/store-component-list'
import {
  useActivateProfile,
  useDeactivateProfile,
  useDeleteProfile,
  useProfile,
  useProfiles,
} from './hooks/use-profiles'

import type { Profile } from '@claudeui/shared'

function parseSelection(parameters: Record<string, string | undefined>): SidebarSelection | null {
  const { '*': rest } = parameters
  if (!rest) {
    return null
  }
  if (rest === 'new') {
    return { type: 'new-profile' }
  }
  if (rest === 'agents') {
    return { type: 'components', category: 'agents' }
  }
  if (rest === 'skills') {
    return { type: 'components', category: 'skills' }
  }
  if (rest === 'commands') {
    return { type: 'components', category: 'commands' }
  }
  if (rest === 'model-configs') {
    return { type: 'components', category: 'model-configs' }
  }
  return { type: 'profile', name: rest }
}

interface ProfilesViewProperties {
  viewSwitcher?: React.ReactNode
}

export function ProfilesView({ viewSwitcher }: ProfilesViewProperties) {
  const parameters = useParams()
  const navigate = useNavigate()
  const selection = parseSelection(parameters)
  const [editing, setEditing] = useState(false)
  const [compareTarget, setCompareTarget] = useState<Profile | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const { data, isLoading } = useProfiles()
  const profiles = data?.profiles ?? []
  const active = data?.active ?? null

  const isCompareOpen = compareTarget !== null

  const selectedProfileName = selection?.type === 'profile' ? selection.name : null
  const { data: selectedProfile } = useProfile(selectedProfileName)

  const activateMut = useActivateProfile()
  const deactivateMut = useDeactivateProfile()
  const deleteMut = useDeleteProfile()

  const handleSelect = (sel: SidebarSelection) => {
    setEditing(false)
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
      onSuccess: (result) => {
        if (result.warnings?.length) {
          toast.success(`Activated ${name}`)
        } else {
          toast.success(`Activated ${name}`)
        }
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

      // ⌘1/⌘2/⌘3 — activate 1st/2nd/3rd profile
      if ((e.metaKey || e.ctrlKey) && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault()
        const index = Number.parseInt(e.key, 10) - 1
        const profile = profiles[index]
        if (profile) {
          handleActivate(profile.name)
        }
        return
      }

      // c — open compare with first non-active profile
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && active) {
        const target = profiles.find(p => p.name !== active)
        if (target) {
          setCompareTarget(target)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, active])

  // Handle ?action=compare query param
  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'compare' && active) {
      const target = profiles.find(p => p.name !== active)
      if (target) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCompareTarget(target)
      }
      // Clear the query param
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      setSearchParams(newParams, { replace: true })
    }
  }, [searchParams, active, profiles, setSearchParams])

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

      <main className="flex-1 overflow-y-auto bg-[var(--surface-base)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={isLoading ? 'loading' : selection?.type || 'empty'}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="mx-auto w-full max-w-6xl px-8 py-8"
          >
            {isLoading
              ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <Loader2 size={20} className="animate-spin text-[var(--text-tertiary)]" />
                <p className="mt-4 text-[14px] text-[var(--text-tertiary)]">Loading profiles...</p>
              </motion.div>
                )
              : (selection === null
                  ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-panel)]">
                  <FolderOpen size={20} className="text-[var(--text-tertiary)]" />
                </div>
                <h3 className="text-[16px] font-medium text-[var(--text-primary)]">Select a profile</h3>
                <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
                  Choose a profile or component type from the sidebar to view details.
                </p>
              </motion.div>
                    )
                  : (
              <AnimatePresence mode="wait">
                {selection.type === 'profile' && selectedProfile && (
                  editing
                    ? (
                    <motion.div
                      key="editor"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ProfileEditor
                        profile={selectedProfile}
                        onSaved={() => {
                          setEditing(false)
                        }}
                        onCancel={() => setEditing(false)}
                      />
                    </motion.div>
                      )
                    : (
                    <motion.div
                      key="card"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ProfileCard
                        profile={selectedProfile}
                        isActive={active === selectedProfile.name}
                        activeProfileName={active}
                        onActivate={() => handleActivate(selectedProfile.name)}
                        onDeactivate={() => handleDeactivate(selectedProfile.name)}
                        onDelete={() => handleDelete(selectedProfile.name)}
                        onEdit={() => setEditing(true)}
                      />
                    </motion.div>
                      )
                )}
                {selection.type === 'new-profile' && (
                  <motion.div
                    key="new-editor"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ProfileEditor
                      onSaved={name => navigate(`/profiles/${name}`)}
                      onCancel={() => navigate('/profiles')}
                    />
                  </motion.div>
                )}
                {selection.type === 'components' && (
                  <motion.div
                    key={`components-${selection.category}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <StoreComponentList category={selection.category} />
                  </motion.div>
                )}
              </AnimatePresence>
                    ))}
          </motion.div>
        </AnimatePresence>
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
