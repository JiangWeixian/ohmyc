# Profiler Integration & Polish Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps between Plan 1 (backend) and Plan 2 (frontend): enhance SourceBadge to show `profile` source, add hooks/MCP/LSP JSON editors to ProfileEditor, and display profile reference counts in the store list.

**Architecture:** Three focused modifications to existing Plan 2 components. SourceBadge in Explorer.tsx gets `profile` badge rendering. ProfileEditor gets three new JSON textareas with validation wired into save. StoreComponentList fetches profiles and cross-references to show usage counts per item.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, React Query v5, existing `@claudeui/shared` types

**Spec:** `docs/superpowers/specs/2026-03-25-profiler-design.md`

**Depends on:** Plan 1 (backend APIs), Plan 2 (frontend UI)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/ui/src/Explorer.tsx` | Enhance SourceBadge for `profile` source |
| Modify | `packages/ui/src/components/profiles/ProfileEditor.tsx` | Add hooks/mcpServers/lspServers JSON editors |
| Modify | `packages/ui/src/components/store/StoreComponentList.tsx` | Show profile reference count per store item |

---

### Task 1: SourceBadge — show `profile` source

**Files:**
- Modify: `packages/ui/src/Explorer.tsx:70-78`

- [ ] **Step 1: Update SourceBadge component**

Replace the current `SourceBadge` component (lines 70-78 of `packages/ui/src/Explorer.tsx`):

```typescript
// old:
const SourceBadge = ({ source, pluginId }: { source: string; pluginId?: string }) => {
  if (source !== 'plugin') return null;
  const label = pluginId ? pluginId.split('@')[0] : 'plugin';
  return (
    <span className="text-[10px] uppercase font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded">
      {label}
    </span>
  );
};
```

with:

```typescript
// new:
const SourceBadge = ({ source, pluginId }: { source: string; pluginId?: string }) => {
  if (source === 'profile') {
    return (
      <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
        profile
      </span>
    );
  }
  if (source === 'plugin') {
    const label = pluginId ? pluginId.split('@')[0] : 'plugin';
    return (
      <span className="text-[10px] uppercase font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded">
        {label}
      </span>
    );
  }
  return null;
};
```

`local` source renders nothing (it's the default, no badge needed).

- [ ] **Step 2: Verify**

Run TypeScript check:
```bash
cd packages/ui && node_modules/.bin/tsc --noEmit
```
Expected: no new errors in `Explorer.tsx`.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/Explorer.tsx
git commit -m "feat: SourceBadge shows blue 'profile' badge for symlinked components"
```

---

### Task 2: ProfileEditor — hooks/MCP/LSP JSON editors

**Files:**
- Modify: `packages/ui/src/components/profiles/ProfileEditor.tsx`

- [ ] **Step 1: Add state for hooks, mcpServers, lspServers**

In `ProfileEditor`, after the existing `settingsText` state (line 23-25), add three new state variables:

```typescript
const [hooksText, setHooksText] = useState(
  profile?.hooks ? JSON.stringify(profile.hooks, null, 2) : '',
)
const [mcpText, setMcpText] = useState(
  profile?.mcpServers ? JSON.stringify(profile.mcpServers, null, 2) : '',
)
const [lspText, setLspText] = useState(
  profile?.lspServers ? JSON.stringify(profile.lspServers, null, 2) : '',
)
```

- [ ] **Step 2: Update handleSave to parse and include new fields**

Replace the `handleSave` function with:

```typescript
const handleSave = () => {
  setError(null)

  let settings: Record<string, any> | undefined
  if (settingsText.trim()) {
    try {
      settings = JSON.parse(settingsText)
    } catch {
      setError('Settings overlay must be valid JSON'); return
    }
  }

  let hooks: any
  if (hooksText.trim()) {
    try {
      hooks = JSON.parse(hooksText)
    } catch {
      setError('Hooks must be valid JSON'); return
    }
  }

  let mcpServers: any
  if (mcpText.trim()) {
    try {
      mcpServers = JSON.parse(mcpText)
    } catch {
      setError('MCP Servers must be valid JSON'); return
    }
  }

  let lspServers: any
  if (lspText.trim()) {
    try {
      lspServers = JSON.parse(lspText)
    } catch {
      setError('LSP Servers must be valid JSON'); return
    }
  }

  if (isEdit) {
    updateMut.mutate(
      { name: profile!.name, body: { description, agents, skills, commands, plugins, hooks, mcpServers, lspServers, settings } },
      { onSuccess: () => onSaved(profile!.name), onError: e => setError(e.message) },
    )
  } else {
    if (!name.trim()) {
      setError('Name is required'); return
    }
    createMut.mutate(
      { name, description, agents, skills, commands, plugins, hooks, mcpServers, lspServers, settings },
      { onSuccess: () => onSaved(name), onError: e => setError(e.message) },
    )
  }
}
```

- [ ] **Step 3: Add JSON textarea fields to the form**

In the JSX, after `<PluginPicker ... />` (line 129) and before the existing Settings Overlay `<div>` (line 131), insert three new collapsible sections:

```tsx
        <div>
          <label className="text-xs font-medium text-zinc-400">Hooks (JSON)</label>
          <textarea
            value={hooksText}
            onChange={e => setHooksText(e.target.value)}
            placeholder='{ "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "echo hi" }] }] }'
            rows={4}
            className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-400">MCP Servers (JSON)</label>
          <textarea
            value={mcpText}
            onChange={e => setMcpText(e.target.value)}
            placeholder='{ "server-name": { "command": "node", "args": ["server.js"] } }'
            rows={4}
            className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-400">LSP Servers (JSON)</label>
          <textarea
            value={lspText}
            onChange={e => setLspText(e.target.value)}
            placeholder='{ "server-name": { "command": "node", "args": ["server.js"] } }'
            rows={4}
            className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
```

These go between PluginPicker and Settings Overlay. The order in the form becomes:
1. Name (create only)
2. Description
3. Agents / Skills / Commands pickers
4. Plugins picker
5. Hooks (JSON)
6. MCP Servers (JSON)
7. LSP Servers (JSON)
8. Settings Overlay (JSON)

- [ ] **Step 4: Verify**

Run TypeScript check:
```bash
cd packages/ui && node_modules/.bin/tsc --noEmit
```
Expected: no new errors. The `hooks`, `mcpServers`, `lspServers` fields already exist on the `Profile` type and `CreateProfileBody`/`UpdateProfileBody` schemas.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/profiles/ProfileEditor.tsx
git commit -m "feat: add hooks/MCP/LSP JSON editors to ProfileEditor"
```

---

### Task 3: Store list — show profile reference counts

**Files:**
- Modify: `packages/ui/src/components/store/StoreComponentList.tsx`

- [ ] **Step 1: Import useProfiles hook**

At the top of `StoreComponentList.tsx`, add the import:

```typescript
import { useProfiles } from '../../hooks/useProfiles'
```

- [ ] **Step 2: Compute reference counts**

Inside the `StoreComponentList` component, after the existing `isLoading` line (line 29), add:

```typescript
const { data: profilesData } = useProfiles()
const profiles = profilesData?.profiles ?? []

// Build a map: component id → list of profile names that reference it
const referencedByMap = new Map<string, string[]>()
for (const p of profiles) {
  const refs = category === 'agents' ? p.agents : (category === 'skills' ? p.skills : p.commands)
  for (const ref of refs) {
    const existing = referencedByMap.get(ref) ?? []
    existing.push(p.name)
    referencedByMap.set(ref, existing)
  }
}
```

- [ ] **Step 3: Render reference count in each item row**

Replace the item description line in the JSX (the `<div>` inside the map at lines 85-87):

```typescript
// old:
              <div>
                <span className="text-zinc-200 font-medium">{item.name}</span>
                {item.description && <span className="text-zinc-500 text-sm ml-2">{item.description}</span>}
              </div>
```

with:

```typescript
// new:
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-zinc-200 font-medium">{item.name}</span>
                  {item.description && <span className="text-zinc-500 text-sm ml-2">{item.description}</span>}
                </div>
                {(referencedByMap.get(item.id)?.length ?? 0) > 0 && (
                  <span
                    className="text-[10px] uppercase font-bold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded shrink-0"
                    title={`Used by: ${referencedByMap.get(item.id)!.join(', ')}`}
                  >
                    {referencedByMap.get(item.id)!.length} profile{referencedByMap.get(item.id)!.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
```

The badge shows "1 profile" or "N profiles" with a hover title listing the profile names.

- [ ] **Step 4: Verify**

Run TypeScript check:
```bash
cd packages/ui && node_modules/.bin/tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/store/StoreComponentList.tsx
git commit -m "feat: show profile reference count in store component list"
```
