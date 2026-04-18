# Profiler Frontend Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Profiles view UI with profile CRUD, activate/deactivate, store component management, and a view switcher between Profiles and AGENT_HOME.

**Architecture:** Add a top-level view switcher (Profiles / AGENT_HOME). Profiles view has a split sidebar (My Profiles + Store nav) with a main content area. Profile editor lets users configure component references, plugins, hooks, MCP, and settings overlay. Store views provide full CRUD for agents/skills/commands with reference-check delete. All data fetching via React Query hooks calling existing backend APIs from Plan 1.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, React Query v5, lucide-react icons, existing `@claudeui/shared` types

**Spec:** `docs/superpowers/specs/2026-03-25-profiler-design.md`

**Depends on:** Plan 1 (backend APIs: `/api/profiles/*`, `/api/store/*`)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/ui/src/hooks/useProfiles.ts` | Profile list/get/create/update/delete/activate/deactivate hooks |
| Create | `packages/ui/src/hooks/useStore.ts` | Store CRUD hooks for agents/skills/commands |
| Create | `packages/ui/src/components/ViewSwitcher.tsx` | Top-level Profiles / AGENT_HOME tab bar |
| Create | `packages/ui/src/ProfilesView.tsx` | Profiles view container (sidebar + main) |
| Create | `packages/ui/src/components/profiles/ProfilesSidebar.tsx` | My Profiles list + Store nav |
| Create | `packages/ui/src/components/profiles/ProfileCard.tsx` | Profile card in list |
| Create | `packages/ui/src/components/profiles/ProfileEditor.tsx` | Profile create/edit form |
| Create | `packages/ui/src/components/profiles/ComponentPicker.tsx` | Multi-select store components for profile |
| Create | `packages/ui/src/components/profiles/PluginPicker.tsx` | Multi-select installed plugins for profile |
| Create | `packages/ui/src/components/store/StoreComponentList.tsx` | Store agents/skills/commands list view |
| Create | `packages/ui/src/components/store/StoreComponentEditor.tsx` | Create/edit store agent/skill/command |
| Create | `packages/ui/src/components/store/DeleteConfirmDialog.tsx` | Reference-check delete confirmation |
| Modify | `packages/ui/src/App.tsx` | Add view switcher routing |
| Modify | `packages/ui/src/Explorer.tsx` | Wrap as AGENT_HOME view |

---

### Task 1: Profile & Store Data Hooks

**Files:**
- Create: `packages/ui/src/hooks/useProfiles.ts`
- Create: `packages/ui/src/hooks/useStore.ts`

- [ ] **Step 1: Create useProfiles.ts**

```typescript
// packages/ui/src/hooks/useProfiles.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Profile, CreateProfileBody, UpdateProfileBody } from '@claudeui/shared';

interface ProfilesListResponse {
  profiles: Profile[];
  active: string | null;
}

async function fetchProfiles(): Promise<ProfilesListResponse> {
  const res = await fetch('/api/profiles');
  if (!res.ok) throw new Error('Failed to fetch profiles');
  return res.json();
}

async function fetchProfile(name: string): Promise<Profile> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('Profile not found');
  const data = await res.json();
  return data.profile;
}

async function createProfile(body: CreateProfileBody): Promise<Profile> {
  const res = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create profile');
  }
  return (await res.json()).profile;
}

async function updateProfile(name: string, body: UpdateProfileBody): Promise<Profile> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update profile');
  }
  return (await res.json()).profile;
}

async function deleteProfile(name: string): Promise<void> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete profile');
}

async function activateProfile(name: string): Promise<{ warnings: string[] }> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}/activate`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to activate');
  }
  return res.json();
}

async function deactivateProfile(name: string): Promise<void> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}/deactivate`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to deactivate');
}

export function useProfiles() {
  return useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles });
}

export function useProfile(name: string | null) {
  return useQuery({
    queryKey: ['profiles', name],
    queryFn: () => fetchProfile(name!),
    enabled: !!name,
  });
}

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateProfileBody }) => updateProfile(name, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
}

export function useDeleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
}

export function useActivateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: activateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
}

export function useDeactivateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deactivateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
}
```

- [ ] **Step 2: Create useStore.ts**

```typescript
// packages/ui/src/hooks/useStore.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Agent, Skill, Command,
  CreateAgentBody, UpdateAgentBody,
  CreateSkillBody, UpdateSkillBody,
  CreateCommandBody, UpdateCommandBody,
} from '@claudeui/shared';

// --- Fetch helpers ---

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

async function mutateJson<T>(url: string, method: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw Object.assign(new Error(err.error || 'Request failed'), { data: err });
  }
  return res.json();
}

// --- Store Agents ---

export function useStoreAgents() {
  return useQuery({
    queryKey: ['store', 'agents'],
    queryFn: () => fetchJson<{ agents: Agent[] }>('/api/store/agents').then(d => d.agents),
  });
}

export function useStoreAgent(name: string | null) {
  return useQuery({
    queryKey: ['store', 'agents', name],
    queryFn: () => fetchJson<{ agent: Agent }>(`/api/store/agents/${encodeURIComponent(name!)}`).then(d => d.agent),
    enabled: !!name,
  });
}

export function useCreateStoreAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAgentBody) => mutateJson<{ agent: Agent }>('/api/store/agents', 'POST', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  });
}

export function useUpdateStoreAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateAgentBody }) =>
      mutateJson<{ agent: Agent }>(`/api/store/agents/${encodeURIComponent(name)}`, 'PUT', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  });
}

export function useDeleteStoreAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      mutateJson(`/api/store/agents/${encodeURIComponent(name)}${force ? '?force=true' : ''}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  });
}

// --- Store Skills ---

export function useStoreSkills() {
  return useQuery({
    queryKey: ['store', 'skills'],
    queryFn: () => fetchJson<{ skills: Skill[] }>('/api/store/skills').then(d => d.skills),
  });
}

export function useStoreSkill(name: string | null) {
  return useQuery({
    queryKey: ['store', 'skills', name],
    queryFn: () => fetchJson<{ skill: Skill }>(`/api/store/skills/${encodeURIComponent(name!)}`).then(d => d.skill),
    enabled: !!name,
  });
}

export function useCreateStoreSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSkillBody) => mutateJson<{ skill: Skill }>('/api/store/skills', 'POST', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  });
}

export function useUpdateStoreSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateSkillBody }) =>
      mutateJson<{ skill: Skill }>(`/api/store/skills/${encodeURIComponent(name)}`, 'PUT', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  });
}

export function useDeleteStoreSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      mutateJson(`/api/store/skills/${encodeURIComponent(name)}${force ? '?force=true' : ''}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  });
}

// --- Store Commands ---

export function useStoreCommands() {
  return useQuery({
    queryKey: ['store', 'commands'],
    queryFn: () => fetchJson<{ commands: Command[] }>('/api/store/commands').then(d => d.commands),
  });
}

export function useStoreCommand(name: string | null) {
  return useQuery({
    queryKey: ['store', 'commands', name],
    queryFn: () => fetchJson<{ command: Command }>(`/api/store/commands/${encodeURIComponent(name!)}`).then(d => d.command),
    enabled: !!name,
  });
}

export function useCreateStoreCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCommandBody) => mutateJson<{ command: Command }>('/api/store/commands', 'POST', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  });
}

export function useUpdateStoreCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateCommandBody }) =>
      mutateJson<{ command: Command }>(`/api/store/commands/${encodeURIComponent(name)}`, 'PUT', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  });
}

export function useDeleteStoreCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      mutateJson(`/api/store/commands/${encodeURIComponent(name)}${force ? '?force=true' : ''}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  });
}

// --- Store Import ---

export function useStoreImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sourceDir: string) =>
      mutateJson<{ imported: number; skipped: number; errors: string[] }>('/api/store/import', 'POST', { sourceDir }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store'] }),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/hooks/useProfiles.ts packages/ui/src/hooks/useStore.ts
git commit -m "feat: add useProfiles and useStore data hooks"
```

---

### Task 2: View Switcher + App Layout

**Files:**
- Create: `packages/ui/src/components/ViewSwitcher.tsx`
- Modify: `packages/ui/src/App.tsx`

- [ ] **Step 1: Create ViewSwitcher.tsx**

```typescript
// packages/ui/src/components/ViewSwitcher.tsx
import { Blocks, FolderOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

const VIEWS = [
  { id: 'profiles', label: 'Profiles', icon: FolderOpen },
  { id: 'agent-home', label: 'AGENT_HOME', icon: Blocks },
] as const;

export type ViewId = (typeof VIEWS)[number]['id'];

export function ViewSwitcher({ active, onChange }: { active: ViewId; onChange: (id: ViewId) => void }) {
  return (
    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
      {VIEWS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all",
            active === id
              ? "bg-zinc-700 text-zinc-100 shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx with view switcher**

Replace `packages/ui/src/App.tsx` with:

```typescript
// packages/ui/src/App.tsx
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ViewSwitcher, type ViewId } from './components/ViewSwitcher';
import Explorer from './Explorer';
import { ProfilesView } from './ProfilesView';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

function AppContent() {
  const [view, setView] = useState<ViewId>('profiles');

  return (
    <div className="h-screen flex flex-col bg-[#09090b] text-zinc-100">
      <div className="h-12 border-b border-zinc-800 flex items-center justify-center bg-zinc-950/50 shrink-0">
        <ViewSwitcher active={view} onChange={setView} />
      </div>
      <div className="flex-1 overflow-hidden">
        {view === 'profiles' ? <ProfilesView /> : <Explorer />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Adapt Explorer.tsx**

Remove the outermost `h-screen` and `bg-[#09090b]` from Explorer since App now handles that. Change:

```
<div className="flex h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-blue-500/30">
```
to:
```
<div className="flex h-full text-zinc-100 font-sans selection:bg-blue-500/30">
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/ViewSwitcher.tsx packages/ui/src/App.tsx packages/ui/src/Explorer.tsx
git commit -m "feat: add view switcher between Profiles and AGENT_HOME"
```

---

### Task 3: Profiles Sidebar

**Files:**
- Create: `packages/ui/src/components/profiles/ProfilesSidebar.tsx`

- [ ] **Step 1: Create ProfilesSidebar.tsx**

```typescript
// packages/ui/src/components/profiles/ProfilesSidebar.tsx
import { Users, Zap, Terminal, Plus, Star, FolderOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Profile } from '@claudeui/shared';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export type SidebarSelection =
  | { type: 'profile'; name: string }
  | { type: 'new-profile' }
  | { type: 'store'; category: 'agents' | 'skills' | 'commands' };

interface ProfilesSidebarProps {
  profiles: Profile[];
  active: string | null;
  selection: SidebarSelection | null;
  onSelect: (sel: SidebarSelection) => void;
}

const STORE_SECTIONS = [
  { category: 'agents' as const, label: 'Agents', icon: Users },
  { category: 'skills' as const, label: 'Skills', icon: Zap },
  { category: 'commands' as const, label: 'Commands', icon: Terminal },
];

export function ProfilesSidebar({ profiles, active, selection, onSelect }: ProfilesSidebarProps) {
  return (
    <aside className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-950/50 backdrop-blur-xl">
      <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
          <FolderOpen size={20} className="text-white" />
        </div>
        <span className="font-bold tracking-tight text-lg">Profiles</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {/* My Profiles */}
        <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest px-3 mb-2">My Profiles</div>
        {profiles.map(p => {
          const isActive = active?.includes(p.name);
          const isSelected = selection?.type === 'profile' && selection.name === p.name;
          return (
            <button
              key={p.name}
              onClick={() => onSelect({ type: 'profile', name: p.name })}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                isSelected
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              )}
            >
              {isActive && <Star size={14} className="text-amber-400 shrink-0" />}
              <span className="truncate">{p.name}</span>
            </button>
          );
        })}

        <button
          onClick={() => onSelect({ type: 'new-profile' })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <Plus size={16} />
          New Profile
        </button>

        {/* Store */}
        <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest px-3 mt-6 mb-2">Store</div>
        {STORE_SECTIONS.map(({ category, label, icon: Icon }) => {
          const isSelected = selection?.type === 'store' && selection.category === category;
          return (
            <button
              key={category}
              onClick={() => onSelect({ type: 'store', category })}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                isSelected
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              )}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/profiles/ProfilesSidebar.tsx
git commit -m "feat: add ProfilesSidebar component"
```

---

### Task 4: ProfilesView Container + Profile Detail

**Files:**
- Create: `packages/ui/src/ProfilesView.tsx`
- Create: `packages/ui/src/components/profiles/ProfileCard.tsx`

- [ ] **Step 1: Create ProfileCard.tsx**

```typescript
// packages/ui/src/components/profiles/ProfileCard.tsx
import { Star, Users, Zap, Terminal, Blocks } from 'lucide-react';
import type { Profile } from '@claudeui/shared';

interface ProfileCardProps {
  profile: Profile;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}

export function ProfileCard({ profile, isActive, onActivate, onDeactivate, onDelete }: ProfileCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-zinc-100">{profile.name}</h2>
            {isActive && <Star size={18} className="text-amber-400 fill-amber-400" />}
          </div>
          {profile.description && (
            <p className="text-zinc-400 text-sm">{profile.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {isActive ? (
            <button onClick={onDeactivate} className="px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
              Deactivate
            </button>
          ) : (
            <button onClick={onActivate} className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors">
              Activate
            </button>
          )}
          <button onClick={onDelete} className="px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-800 text-red-400 hover:bg-red-900/30 transition-colors">
            Delete
          </button>
        </div>
      </div>

      {/* Component summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users, label: 'Agents', count: profile.agents.length },
          { icon: Zap, label: 'Skills', count: profile.skills.length },
          { icon: Terminal, label: 'Commands', count: profile.commands.length },
          { icon: Blocks, label: 'Plugins', count: profile.plugins.length },
        ].map(({ icon: Icon, label, count }) => (
          <div key={label} className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <Icon size={18} className="mx-auto mb-1 text-zinc-500" />
            <div className="text-lg font-bold text-zinc-200">{count}</div>
            <div className="text-[10px] text-zinc-500 uppercase">{label}</div>
          </div>
        ))}
      </div>

      {/* Settings overlay preview */}
      {profile.settings && Object.keys(profile.settings).length > 0 && (
        <div>
          <div className="text-xs font-medium text-zinc-500 mb-2">Settings Overlay</div>
          <pre className="text-xs text-zinc-400 bg-zinc-950 rounded-lg p-3 overflow-x-auto max-h-32">
            {JSON.stringify(profile.settings, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ProfilesView.tsx**

```typescript
// packages/ui/src/ProfilesView.tsx
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ProfilesSidebar, type SidebarSelection } from './components/profiles/ProfilesSidebar';
import { ProfileCard } from './components/profiles/ProfileCard';
import { ProfileEditor } from './components/profiles/ProfileEditor';
import { StoreComponentList } from './components/store/StoreComponentList';
import { useProfiles, useProfile, useActivateProfile, useDeactivateProfile, useDeleteProfile } from './hooks/useProfiles';

export function ProfilesView() {
  const [selection, setSelection] = useState<SidebarSelection | null>(null);
  const { data, isLoading } = useProfiles();
  const profiles = data?.profiles ?? [];
  const active = data?.active ?? null;

  const selectedProfileName = selection?.type === 'profile' ? selection.name : null;
  const { data: selectedProfile } = useProfile(selectedProfileName);

  const activateMut = useActivateProfile();
  const deactivateMut = useDeactivateProfile();
  const deleteMut = useDeleteProfile();

  const handleActivate = (name: string) => {
    activateMut.mutate(name, {
      onSuccess: (result) => {
        if (result.warnings?.length) {
          alert(`Activated with warnings:\n${result.warnings.join('\n')}`);
        }
      },
    });
  };

  const handleDeactivate = (name: string) => {
    deactivateMut.mutate(name);
  };

  const handleDelete = (name: string) => {
    if (!confirm(`Delete profile "${name}"?`)) return;
    deleteMut.mutate(name, { onSuccess: () => setSelection(null) });
  };

  return (
    <div className="flex h-full text-zinc-100 font-sans">
      <ProfilesSidebar
        profiles={profiles}
        active={active}
        selection={selection}
        onSelect={setSelection}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-zinc-500" />
            </div>
          ) : selection === null ? (
            <div className="text-center py-20 text-zinc-500">
              Select a profile or store category from the sidebar.
            </div>
          ) : selection.type === 'profile' && selectedProfile ? (
            <ProfileCard
              profile={selectedProfile}
              isActive={active?.includes(selectedProfile.name) ?? false}
              onActivate={() => handleActivate(selectedProfile.name)}
              onDeactivate={() => handleDeactivate(selectedProfile.name)}
              onDelete={() => handleDelete(selectedProfile.name)}
            />
          ) : selection.type === 'new-profile' ? (
            <ProfileEditor
              onSaved={(name) => setSelection({ type: 'profile', name })}
              onCancel={() => setSelection(null)}
            />
          ) : selection.type === 'store' ? (
            <StoreComponentList category={selection.category} />
          ) : null}
        </div>
      </main>
    </div>
  );
}
```

Note: `ProfileEditor` and `StoreComponentList` are created in Tasks 5 and 6. Create placeholder files for now:

```typescript
// packages/ui/src/components/profiles/ProfileEditor.tsx (placeholder)
export function ProfileEditor({ onSaved, onCancel }: { onSaved: (name: string) => void; onCancel: () => void }) {
  return <div className="text-zinc-500">Profile editor — coming next.</div>;
}
```

```typescript
// packages/ui/src/components/store/StoreComponentList.tsx (placeholder)
export function StoreComponentList({ category }: { category: 'agents' | 'skills' | 'commands' }) {
  return <div className="text-zinc-500">Store {category} — coming next.</div>;
}
```

- [ ] **Step 3: Verify in browser**

Run `cd packages/ui && pnpm dev`, open http://localhost:5173. View switcher should show, Profiles view should render sidebar with profiles fetched from API, clicking a profile should show the ProfileCard.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/ProfilesView.tsx packages/ui/src/components/profiles/ProfileCard.tsx packages/ui/src/components/profiles/ProfileEditor.tsx packages/ui/src/components/store/StoreComponentList.tsx
git commit -m "feat: add ProfilesView with sidebar and profile detail card"
```

---

### Task 5: Profile Editor (Create / Edit)

**Files:**
- Replace: `packages/ui/src/components/profiles/ProfileEditor.tsx`
- Create: `packages/ui/src/components/profiles/ComponentPicker.tsx`
- Create: `packages/ui/src/components/profiles/PluginPicker.tsx`

- [ ] **Step 1: Create ComponentPicker.tsx**

A reusable multi-select that shows store components with checkboxes.

```typescript
// packages/ui/src/components/profiles/ComponentPicker.tsx
interface ComponentPickerProps {
  label: string;
  available: { id: string; description?: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  isLoading?: boolean;
}

export function ComponentPicker({ label, available, selected, onChange, isLoading }: ComponentPickerProps) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  return (
    <div>
      <div className="text-xs font-medium text-zinc-400 mb-2">{label}</div>
      {isLoading ? (
        <div className="text-xs text-zinc-600">Loading...</div>
      ) : available.length === 0 ? (
        <div className="text-xs text-zinc-600">No items in store. Add some first.</div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {available.map(item => (
            <label
              key={item.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => toggle(item.id)}
                className="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500/30"
              />
              <span className="text-zinc-300">{item.id}</span>
              {item.description && (
                <span className="text-zinc-600 text-xs truncate">{item.description}</span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create PluginPicker.tsx**

```typescript
// packages/ui/src/components/profiles/PluginPicker.tsx
import { usePlugins } from '../../hooks/usePlugins';

interface PluginPickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function PluginPicker({ selected, onChange }: PluginPickerProps) {
  const { data: plugins, isLoading } = usePlugins();

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  return (
    <div>
      <div className="text-xs font-medium text-zinc-400 mb-2">Plugins</div>
      {isLoading ? (
        <div className="text-xs text-zinc-600">Loading...</div>
      ) : !plugins?.length ? (
        <div className="text-xs text-zinc-600">No plugins installed.</div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {plugins.map(p => (
            <label
              key={p.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={() => toggle(p.id)}
                className="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500/30"
              />
              <span className="text-zinc-300">{p.name}</span>
              <span className="text-zinc-600 text-xs">@{p.marketplace}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Implement ProfileEditor.tsx**

```typescript
// packages/ui/src/components/profiles/ProfileEditor.tsx
import { useState } from 'react';
import { useCreateProfile, useUpdateProfile } from '../../hooks/useProfiles';
import { useStoreAgents, useStoreSkills, useStoreCommands } from '../../hooks/useStore';
import { ComponentPicker } from './ComponentPicker';
import { PluginPicker } from './PluginPicker';
import type { Profile } from '@claudeui/shared';

interface ProfileEditorProps {
  profile?: Profile;           // undefined = create mode
  onSaved: (name: string) => void;
  onCancel: () => void;
}

export function ProfileEditor({ profile, onSaved, onCancel }: ProfileEditorProps) {
  const isEdit = !!profile;

  const [name, setName] = useState(profile?.name ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [agents, setAgents] = useState<string[]>(profile?.agents ?? []);
  const [skills, setSkills] = useState<string[]>(profile?.skills ?? []);
  const [commands, setCommands] = useState<string[]>(profile?.commands ?? []);
  const [plugins, setPlugins] = useState<string[]>(profile?.plugins ?? []);
  const [settingsText, setSettingsText] = useState(
    profile?.settings ? JSON.stringify(profile.settings, null, 2) : ''
  );
  const [error, setError] = useState<string | null>(null);

  const { data: storeAgents, isLoading: agentsLoading } = useStoreAgents();
  const { data: storeSkills, isLoading: skillsLoading } = useStoreSkills();
  const { data: storeCommands, isLoading: commandsLoading } = useStoreCommands();

  const createMut = useCreateProfile();
  const updateMut = useUpdateProfile();

  const handleSave = () => {
    setError(null);

    let settings: Record<string, any> | undefined;
    if (settingsText.trim()) {
      try {
        settings = JSON.parse(settingsText);
      } catch {
        setError('Settings overlay must be valid JSON');
        return;
      }
    }

    if (isEdit) {
      updateMut.mutate(
        { name: profile!.name, body: { description, agents, skills, commands, plugins, settings } },
        { onSuccess: () => onSaved(profile!.name), onError: (e) => setError(e.message) }
      );
    } else {
      if (!name.trim()) { setError('Name is required'); return; }
      createMut.mutate(
        { name, description, agents, skills, commands, plugins, settings },
        { onSuccess: () => onSaved(name), onError: (e) => setError(e.message) }
      );
    }
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-100">{isEdit ? `Edit ${profile!.name}` : 'New Profile'}</h2>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-2">{error}</div>
      )}

      <div className="grid gap-6">
        {/* Name (only in create mode) */}
        {!isEdit && (
          <div>
            <label className="text-xs font-medium text-zinc-400">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="my-profile"
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-zinc-400">Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What this profile is for..."
            className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ComponentPicker
            label="Agents"
            available={(storeAgents ?? []).map(a => ({ id: a.id, description: a.frontmatter.description }))}
            selected={agents}
            onChange={setAgents}
            isLoading={agentsLoading}
          />
          <ComponentPicker
            label="Skills"
            available={(storeSkills ?? []).map(s => ({ id: s.id, description: s.frontmatter.description }))}
            selected={skills}
            onChange={setSkills}
            isLoading={skillsLoading}
          />
          <ComponentPicker
            label="Commands"
            available={(storeCommands ?? []).map(c => ({ id: c.id, description: c.frontmatter.description }))}
            selected={commands}
            onChange={setCommands}
            isLoading={commandsLoading}
          />
        </div>

        <PluginPicker selected={plugins} onChange={setPlugins} />

        <div>
          <label className="text-xs font-medium text-zinc-400">Settings Overlay (JSON)</label>
          <textarea
            value={settingsText}
            onChange={e => setSettingsText(e.target.value)}
            placeholder='{ "model": "opus" }'
            rows={4}
            className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire Edit button into ProfileCard**

In `ProfileCard.tsx`, add an Edit button and `onEdit` prop:

```typescript
// Add to ProfileCardProps:
onEdit: () => void;

// Add Edit button next to Activate/Delete:
<button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
  Edit
</button>
```

In `ProfilesView.tsx`, add edit state:

```typescript
const [editing, setEditing] = useState(false);

// In the profile render branch, add:
) : selection.type === 'profile' && selectedProfile ? (
  editing ? (
    <ProfileEditor
      profile={selectedProfile}
      onSaved={(name) => { setEditing(false); }}
      onCancel={() => setEditing(false)}
    />
  ) : (
    <ProfileCard
      profile={selectedProfile}
      isActive={...}
      onActivate={...}
      onDeactivate={...}
      onDelete={...}
      onEdit={() => setEditing(true)}
    />
  )
```

- [ ] **Step 5: Verify in browser**

Create a profile via the "New Profile" button, fill in name and select components, save. Verify it appears in sidebar.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/profiles/
git commit -m "feat: add ProfileEditor with component and plugin pickers"
```

---

### Task 6: Store Component List

**Files:**
- Replace: `packages/ui/src/components/store/StoreComponentList.tsx`
- Create: `packages/ui/src/components/store/DeleteConfirmDialog.tsx`

- [ ] **Step 1: Create DeleteConfirmDialog.tsx**

```typescript
// packages/ui/src/components/store/DeleteConfirmDialog.tsx
interface DeleteConfirmDialogProps {
  name: string;
  referencedBy: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({ name, referencedBy, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
        <h3 className="text-lg font-bold text-zinc-100">Delete "{name}"?</h3>
        {referencedBy.length > 0 && (
          <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3">
            <p className="text-amber-400 text-sm font-medium mb-1">Referenced by profiles:</p>
            <ul className="text-amber-300 text-sm list-disc list-inside">
              {referencedBy.map(r => <li key={r}>{r}</li>)}
            </ul>
          </div>
        )}
        <p className="text-zinc-400 text-sm">This action cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-500">
            {referencedBy.length > 0 ? 'Force Delete' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement StoreComponentList.tsx**

```typescript
// packages/ui/src/components/store/StoreComponentList.tsx
import { useState } from 'react';
import { Plus, Trash2, Edit2, Loader2 } from 'lucide-react';
import { useStoreAgents, useStoreSkills, useStoreCommands, useDeleteStoreAgent, useDeleteStoreSkill, useDeleteStoreCommand } from '../../hooks/useStore';
import { StoreComponentEditor } from './StoreComponentEditor';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface StoreComponentListProps {
  category: 'agents' | 'skills' | 'commands';
}

export function StoreComponentList({ category }: StoreComponentListProps) {
  const [editing, setEditing] = useState<string | null>(null);  // null=list, 'new'=create, name=edit
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; referencedBy: string[] } | null>(null);

  const agentsQ = useStoreAgents();
  const skillsQ = useStoreSkills();
  const commandsQ = useStoreCommands();

  const deleteAgentMut = useDeleteStoreAgent();
  const deleteSkillMut = useDeleteStoreSkill();
  const deleteCommandMut = useDeleteStoreCommand();

  const q = category === 'agents' ? agentsQ : category === 'skills' ? skillsQ : commandsQ;
  const items = (q.data ?? []).map(item => ({
    id: item.id,
    name: item.frontmatter.name || item.id,
    description: item.frontmatter.description || '',
  }));
  const isLoading = q.isLoading;

  const handleDelete = (name: string) => {
    const deleteMut = category === 'agents' ? deleteAgentMut : category === 'skills' ? deleteSkillMut : deleteCommandMut;
    // Try non-force first to check references
    deleteMut.mutate({ name, force: false }, {
      onSuccess: () => setDeleteTarget(null),
      onError: (err: any) => {
        const refs = err.data?.referencedBy;
        if (refs) {
          setDeleteTarget({ name, referencedBy: refs });
        }
      },
    });
  };

  const handleForceDelete = () => {
    if (!deleteTarget) return;
    const deleteMut = category === 'agents' ? deleteAgentMut : category === 'skills' ? deleteSkillMut : deleteCommandMut;
    deleteMut.mutate({ name: deleteTarget.name, force: true }, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  if (editing !== null) {
    return (
      <StoreComponentEditor
        category={category}
        editName={editing === 'new' ? undefined : editing}
        onSaved={() => setEditing(null)}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const title = category.charAt(0).toUpperCase() + category.slice(1);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Store {title}</h1>
          <p className="text-zinc-400 text-sm mt-1">Manage {category} in your store. Profiles reference these components.</p>
        </div>
        <button onClick={() => setEditing('new')} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-500">
          <Plus size={16} /> New
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-zinc-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">No {category} in store yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 hover:border-zinc-700 transition-colors">
              <div>
                <span className="text-zinc-200 font-medium">{item.name}</span>
                {item.description && <span className="text-zinc-500 text-sm ml-2">{item.description}</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(item.id)} className="p-1.5 text-zinc-500 hover:text-zinc-200 rounded hover:bg-zinc-800">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-zinc-500 hover:text-red-400 rounded hover:bg-zinc-800">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          name={deleteTarget.name}
          referencedBy={deleteTarget.referencedBy}
          onConfirm={handleForceDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/store/
git commit -m "feat: add StoreComponentList with delete reference check"
```

---

### Task 7: Store Component Editor

**Files:**
- Create: `packages/ui/src/components/store/StoreComponentEditor.tsx`

- [ ] **Step 1: Implement StoreComponentEditor.tsx**

```typescript
// packages/ui/src/components/store/StoreComponentEditor.tsx
import { useState, useEffect } from 'react';
import {
  useStoreAgent, useCreateStoreAgent, useUpdateStoreAgent,
  useStoreSkill, useCreateStoreSkill, useUpdateStoreSkill,
  useStoreCommand, useCreateStoreCommand, useUpdateStoreCommand,
} from '../../hooks/useStore';

interface StoreComponentEditorProps {
  category: 'agents' | 'skills' | 'commands';
  editName?: string;      // undefined = create mode
  onSaved: () => void;
  onCancel: () => void;
}

export function StoreComponentEditor({ category, editName, onSaved, onCancel }: StoreComponentEditorProps) {
  const isEdit = !!editName;

  const agentQ = useStoreAgent(category === 'agents' ? (editName ?? null) : null);
  const skillQ = useStoreSkill(category === 'skills' ? (editName ?? null) : null);
  const commandQ = useStoreCommand(category === 'commands' ? (editName ?? null) : null);

  const existing = category === 'agents' ? agentQ.data : category === 'skills' ? skillQ.data : commandQ.data;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setName(existing.frontmatter.name || existing.id);
      setDescription(existing.frontmatter.description || '');
      setContent(existing.content);
    }
  }, [existing]);

  const createAgent = useCreateStoreAgent();
  const updateAgent = useUpdateStoreAgent();
  const createSkill = useCreateStoreSkill();
  const updateSkill = useUpdateStoreSkill();
  const createCommand = useCreateStoreCommand();
  const updateCommand = useUpdateStoreCommand();

  const handleSave = () => {
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }

    const frontmatter: any = { name, description: description || undefined };
    const onSuccess = () => onSaved();
    const onError = (e: any) => setError(e.message);

    if (category === 'agents') {
      if (!description.trim()) { setError('Description is required for agents'); return; }
      if (isEdit) {
        updateAgent.mutate({ name: editName!, body: { frontmatter, content } }, { onSuccess, onError });
      } else {
        createAgent.mutate({ frontmatter, content }, { onSuccess, onError });
      }
    } else if (category === 'skills') {
      if (isEdit) {
        updateSkill.mutate({ name: editName!, body: { frontmatter, content } }, { onSuccess, onError });
      } else {
        createSkill.mutate({ frontmatter, content }, { onSuccess, onError });
      }
    } else {
      if (isEdit) {
        updateCommand.mutate({ name: editName!, body: { frontmatter, content } }, { onSuccess, onError });
      } else {
        createCommand.mutate({ frontmatter, content }, { onSuccess, onError });
      }
    }
  };

  const isSaving = [createAgent, updateAgent, createSkill, updateSkill, createCommand, updateCommand].some(m => m.isPending);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-100">
          {isEdit ? `Edit ${editName}` : `New ${category.slice(0, -1)}`}
        </h2>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-2">{error}</div>
      )}

      <div className="grid gap-4">
        {!isEdit && (
          <div>
            <label className="text-xs font-medium text-zinc-400">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="my-component"
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500" />
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-zinc-400">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What this component does..."
            className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-400">Content (Markdown)</label>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            rows={16} placeholder="System prompt or skill content..."
            className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-blue-500 resize-y" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate to Profiles view → Store → Agents → New. Create an agent, verify it appears in the list. Edit it, verify changes persist. Delete it.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/store/StoreComponentEditor.tsx
git commit -m "feat: add StoreComponentEditor for create/edit store components"
```

---

### Task 8: Final Integration + Polish

**Files:**
- Modify: `packages/ui/src/ProfilesView.tsx` (ensure all branches work)

- [ ] **Step 1: End-to-end verification**

Test the complete flow:
1. Switch to Profiles view
2. Create a new profile with agents/skills/commands from store
3. Activate the profile → verify warnings if any
4. Check AGENT_HOME view shows activated components with source badges
5. Deactivate the profile
6. Edit the profile, change components
7. Delete the profile
8. Create/edit/delete store components
9. Delete store component referenced by profile → verify 409 dialog

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: complete Profiles view with profile CRUD, store management, and activate/deactivate"
```
