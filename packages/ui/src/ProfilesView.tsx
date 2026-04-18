import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProfilesSidebar, type SidebarSelection } from './components/profiles/ProfilesSidebar';
import { ProfileCard } from './components/profiles/ProfileCard';
import { ProfileEditor } from './components/profiles/ProfileEditor';
import { StoreComponentList } from './components/store/StoreComponentList';
import { useProfiles, useProfile, useActivateProfile, useDeactivateProfile, useDeleteProfile } from './hooks/useProfiles';
import { useToast } from './components/ui/Toast';

function parseSelection(params: Record<string, string | undefined>): SidebarSelection | null {
  const { '*': rest } = params;
  if (!rest) return null;
  if (rest === 'new') return { type: 'new-profile' };
  if (rest === 'agents') return { type: 'components', category: 'agents' };
  if (rest === 'skills') return { type: 'components', category: 'skills' };
  if (rest === 'commands') return { type: 'components', category: 'commands' };
  if (rest === 'model-configs') return { type: 'components', category: 'model-configs' };
  return { type: 'profile', name: rest };
}

interface ProfilesViewProps {
  viewSwitcher?: React.ReactNode;
}

export function ProfilesView({ viewSwitcher }: ProfilesViewProps) {
  const params = useParams();
  const navigate = useNavigate();
  const selection = parseSelection(params);
  const [editing, setEditing] = useState(false);
  const { success, error } = useToast();

  const { data, isLoading } = useProfiles();
  const profiles = data?.profiles ?? [];
  const active = data?.active ?? null;

  const selectedProfileName = selection?.type === 'profile' ? selection.name : null;
  const { data: selectedProfile } = useProfile(selectedProfileName);

  const activateMut = useActivateProfile();
  const deactivateMut = useDeactivateProfile();
  const deleteMut = useDeleteProfile();

  const handleSelect = (sel: SidebarSelection) => {
    setEditing(false);
    if (sel.type === 'new-profile') navigate('/profiles/new');
    else if (sel.type === 'components') navigate(`/profiles/${sel.category}`);
    else if (sel.type === 'profile') navigate(`/profiles/${sel.name}`);
  };

  const handleActivate = (name: string) => {
    activateMut.mutate(name, {
      onSuccess: (result) => {
        if (result.warnings?.length) {
          success(`Activated ${name}`);
        } else {
          success(`Activated ${name}`);
        }
      },
      onError: () => {
        error(`Failed to activate ${name}`);
      }
    });
  };

  const handleDeactivate = (name: string) => {
    deactivateMut.mutate(name, {
      onSuccess: () => {
        success(`Deactivated ${name}`);
      },
      onError: () => {
        error(`Failed to deactivate ${name}`);
      }
    });
  };

  const handleDelete = (name: string) => {
    if (!confirm(`Delete ${name}? This removes the saved composition only. Store components stay in your library.`)) return;
    deleteMut.mutate(name, {
      onSuccess: () => {
        success(`Deleted ${name}`);
        navigate('/profiles');
      },
      onError: () => {
        error(`Failed to delete ${name}`);
      }
    });
  };

  return (
    <div className="flex h-full min-w-0">
      <ProfilesSidebar
        profiles={profiles}
        active={active}
        selection={selection}
        onSelect={handleSelect}
        headerSlot={viewSwitcher}
      />

      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(94,106,210,0.08),_transparent_26%),_var(--surface-base)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={isLoading ? 'loading' : selection?.type || 'empty'}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="mx-auto w-full max-w-6xl px-8 py-8"
          >
            {isLoading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center py-20"
              >
                <Loader2 size={20} className="animate-spin text-[var(--text-tertiary)]" />
              </motion.div>
            ) : selection === null ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel-subtle py-16 text-center text-[var(--text-tertiary)]">
                Select a profile or component type from the sidebar.
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                {selection.type === 'profile' && selectedProfile && (
                  editing ? (
                    <motion.div
                      key="editor"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ProfileEditor
                        profile={selectedProfile}
                        onSaved={() => { setEditing(false); }}
                        onCancel={() => setEditing(false)}
                      />
                    </motion.div>
                  ) : (
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
                      onSaved={(name) => navigate(`/profiles/${name}`)}
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
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
