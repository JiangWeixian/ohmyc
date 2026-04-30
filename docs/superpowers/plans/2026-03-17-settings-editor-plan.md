# Settings.json Editor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a visual editor for Claude Code's settings.json with 8 categories (General, Permissions, Sandbox, Hooks, Attribution, MCP, Plugins, Environment), Linear-style UI, and JSON editing support.

**Architecture:** React + Fastify monorepo. Shared Zod schemas for validation. React Query for data fetching. CodeMirror 6 for JSON editing. CSS variables for theming.

**Tech Stack:** React 18, React Router, React Query, Fastify, Zod, CodeMirror 6, Tailwind CSS, shadcn/ui patterns

---

## File Structure

```
packages/
├── shared/src/
│   ├── settingsSchema.ts       # NEW: Zod schemas (passthrough mode)
│   └── index.ts               # MODIFY: export new schemas
├── cli/src/
│   ├── server/
│   │   ├── routes/
│   │   │   ├── config.ts      # KEEP: existing routes
│   │   │   └── settings.ts    # NEW: settings.json API
│   │   └── index.ts           # MODIFY: register settings routes
│   └── index.ts               # MODIFY: add --project flag
└── ui/src/
    ├── components/
    │   └── settings/
    │       ├── SettingsLayout.tsx     # NEW: main layout
    │       ├── SettingsSidebar.tsx    # NEW: category navigation
    │       ├── SettingsContent.tsx    # NEW: content router outlet
    │       ├── GeneralSettings.tsx    # NEW: General form
    │       └── ui/                   # NEW: shared UI components
    │           ├── Input.tsx
    │           ├── Select.tsx
    │           ├── Toggle.tsx
    │           └── Button.tsx
    ├── hooks/
    │   └── useSettings.ts     # NEW: React Query hooks
    ├── App.tsx               # NEW: router setup
    └── main.tsx              # MODIFY: add BrowserRouter
```

---

## Chunk 1: Project Setup & Shared Schemas

### Task 1.1: Add dependencies

**Files:**
- Modify: `packages/cli/package.json`
- Modify: `packages/ui/package.json`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Add zod-to-json-schema to shared**

Run: `cd packages/shared && pnpm add zod-to-json-schema`

- [ ] **Step 2: Add fast-deep-equal to ui**

Run: `cd packages/ui && pnpm add fast-deep-equal && pnpm add -D @types/fast-deep-equal`

- [ ] **Step 3: Add @codemirror/lang-json to ui**

Run: `cd packages/ui && pnpm add codemirror @codemirror/lang-json @codemirror/theme-one-dark`

- [ ] **Step 4: Commit**

```bash
cd packages/shared && pnpm add zod-to-json-schema
cd packages/ui && pnpm add fast-deep-equal codemirror @codemirror/lang-json @codemirror/theme-one-dark
cd packages/ui && pnpm add -D @types/fast-deep-equal
git add packages/*/package.json packages/*/pnpm-lock.yaml
git commit -m "feat(settings): add dependencies for schema generation, deep-equal, codemirror"
```

---

### Task 1.2: Create Zod settings schemas

**Files:**
- Create: `packages/shared/src/settingsSchema.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create settingsSchema.ts with Zod schemas**

```typescript
// packages/shared/src/settingsSchema.ts
import { z } from 'zod'

// Permission rule validation (simplified - just string format)
const permissionRule = z.string()

// General Settings
export const GeneralSettingsSchema = z.object({
  model: z.string().optional(),
  availableModels: z.array(z.string()).optional(),
  modelOverrides: z.record(z.string()).optional(),
  language: z.string().optional(),
  autoUpdatesChannel: z.enum(['stable', 'beta']).optional(),
  alwaysThinkingEnabled: z.boolean().optional(),
  fastModePerSessionOptIn: z.boolean().optional(),
  showTurnDuration: z.boolean().optional(),
  prefersReducedMotion: z.boolean().optional(),
  plansDirectory: z.string().optional(),
  outputStyle: z.string().optional(),
  cleanupPeriodDays: z.number().optional(),
  respectGitignore: z.boolean().optional(),
  includeGitInstructions: z.boolean().optional(),
  includeCoAuthoredBy: z.boolean().optional(),
  terminalProgressBarEnabled: z.boolean().optional(),
  spinnerTipsEnabled: z.boolean().optional(),
  spinnerTipsOverride: z.object({
    excludeDefault: z.boolean().optional(),
    tips: z.array(z.string()).optional(),
  }).optional(),
  spinnerVerbs: z.object({
    mode: z.enum(['append', 'replace']).optional(),
    verbs: z.array(z.string()).optional(),
  }).optional(),
  statusLine: z.object({
    type: z.literal('command'),
    command: z.string(),
  }).optional(),
  fileSuggestion: z.object({
    type: z.literal('command'),
    command: z.string(),
  }).optional(),
  apiKeyHelper: z.string().optional(),
  forceLoginMethod: z.enum(['claudeai', 'console']).optional(),
}).optional()

// Permissions
export const PermissionSettingsSchema = z.object({
  allow: z.array(permissionRule).optional(),
  ask: z.array(permissionRule).optional(),
  deny: z.array(permissionRule).optional(),
  defaultMode: z.enum(['default', 'acceptEdits', 'plan', 'dontAsk', 'bypassPermissions']).optional(),
  additionalDirectories: z.array(z.string()).optional(),
  disableBypassPermissionsMode: z.enum(['disable']).optional(),
}).optional()

// Sandbox
export const SandboxSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  autoAllowBashIfSandboxed: z.boolean().optional(),
  excludedCommands: z.array(z.string()).optional(),
  allowUnsandboxedCommands: z.boolean().optional(),
  filesystem: z.object({
    allowWrite: z.array(z.string()).optional(),
    denyWrite: z.array(z.string()).optional(),
    denyRead: z.array(z.string()).optional(),
  }).optional(),
  network: z.object({
    allowUnixSockets: z.array(z.string()).optional(),
    allowAllUnixSockets: z.boolean().optional(),
    allowLocalBinding: z.boolean().optional(),
    allowedDomains: z.array(z.string()).optional(),
    allowManagedDomainsOnly: z.boolean().optional(),
    httpProxyPort: z.number().optional(),
    socksProxyPort: z.number().optional(),
  }).optional(),
  enableWeakerNestedSandbox: z.boolean().optional(),
  enableWeakerNetworkIsolation: z.boolean().optional(),
}).optional()

// Hooks - simplified for Phase 1
export const HookSettingsSchema = z.record(z.string(), z.any()).optional()

// Attribution
export const AttributionSettingsSchema = z.object({
  commit: z.string().optional(),
  pr: z.string().optional(),
}).optional()

// MCP Control
export const McpControlSettingsSchema = z.object({
  enableAllProjectMcpServers: z.boolean().optional(),
  enabledMcpjsonServers: z.array(z.string()).optional(),
  disabledMcpjsonServers: z.array(z.string()).optional(),
  allowedMcpServers: z.array(z.object({
    serverName: z.string().optional(),
    serverCommand: z.array(z.string()).optional(),
    serverUrl: z.string().optional(),
  })).optional(),
  deniedMcpServers: z.array(z.object({
    serverName: z.string().optional(),
    serverCommand: z.array(z.string()).optional(),
    serverUrl: z.string().optional(),
  })).optional(),
  allowManagedMcpServersOnly: z.boolean().optional(),
}).optional()

// Plugins
export const PluginSettingsSchema = z.object({
  enabledPlugins: z.record(z.boolean()).optional(),
  pluginTrustMessage: z.string().optional(),
  extraKnownMarketplaces: z.record(z.unknown()).optional(),
  strictKnownMarketplaces: z.array(z.unknown()).optional(),
  blockedMarketplaces: z.array(z.unknown()).optional(),
}).optional()

// Environment
export const EnvSettingsSchema = z.record(z.string()).optional()

// Top-level settings
export const SettingsJsonSchema = z.object({
  $schema: z.string().optional(),
  model: GeneralSettingsSchema.shape.model,
  availableModels: GeneralSettingsSchema.shape.availableModels,
  modelOverrides: GeneralSettingsSchema.shape.modelOverrides,
  language: GeneralSettingsSchema.shape.language,
  autoUpdatesChannel: GeneralSettingsSchema.shape.autoUpdatesChannel,
  alwaysThinkingEnabled: GeneralSettingsSchema.shape.alwaysThinkingEnabled,
  fastModePerSessionOptIn: GeneralSettingsSchema.shape.fastModePerSessionOptIn,
  showTurnDuration: GeneralSettingsSchema.shape.showTurnDuration,
  prefersReducedMotion: GeneralSettingsSchema.shape.prefersReducedMotion,
  plansDirectory: GeneralSettingsSchema.shape.plansDirectory,
  outputStyle: GeneralSettingsSchema.shape.outputStyle,
  cleanupPeriodDays: GeneralSettingsSchema.shape.cleanupPeriodDays,
  respectGitignore: GeneralSettingsSchema.shape.respectGitignore,
  includeGitInstructions: GeneralSettingsSchema.shape.includeGitInstructions,
  includeCoAuthoredBy: GeneralSettingsSchema.shape.includeCoAuthoredBy,
  terminalProgressBarEnabled: GeneralSettingsSchema.shape.terminalProgressBarEnabled,
  spinnerTipsEnabled: GeneralSettingsSchema.shape.spinnerTipsEnabled,
  spinnerTipsOverride: GeneralSettingsSchema.shape.spinnerTipsOverride,
  spinnerVerbs: GeneralSettingsSchema.shape.spinnerVerbs,
  statusLine: GeneralSettingsSchema.shape.statusLine,
  fileSuggestion: GeneralSettingsSchema.shape.fileSuggestion,
  apiKeyHelper: GeneralSettingsSchema.shape.apiKeyHelper,
  forceLoginMethod: GeneralSettingsSchema.shape.forceLoginMethod,
  permissions: PermissionSettingsSchema,
  sandbox: SandboxSettingsSchema,
  hooks: HookSettingsSchema,
  attribution: AttributionSettingsSchema,
  env: EnvSettingsSchema,
  enabledPlugins: PluginSettingsSchema.shape.enabledPlugins,
  pluginTrustMessage: PluginSettingsSchema.shape.pluginTrustMessage,
  extraKnownMarketplaces: PluginSettingsSchema.shape.extraKnownMarketplaces,
  strictKnownMarketplaces: PluginSettingsSchema.shape.strictKnownMarketplaces,
  blockedMarketplaces: PluginSettingsSchema.shape.blockedMarketplaces,
  enableAllProjectMcpServers: McpControlSettingsSchema.shape.enableAllProjectMcpServers,
  enabledMcpjsonServers: McpControlSettingsSchema.shape.enabledMcpjsonServers,
  disabledMcpjsonServers: McpControlSettingsSchema.shape.disabledMcpjsonServers,
  allowedMcpServers: McpControlSettingsSchema.shape.allowedMcpServers,
  deniedMcpServers: McpControlSettingsSchema.shape.deniedMcpServers,
  allowManagedMcpServersOnly: McpControlSettingsSchema.shape.allowManagedMcpServersOnly,
}).passthrough()

// Type inference
export type SettingsJson = z.infer<typeof SettingsJsonSchema>
```

- [ ] **Step 2: Export from index.ts**

```typescript
// packages/shared/src/index.ts
export * from './schemas.js'
export * from './settingsSchema.js' // ADD
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/settingsSchema.ts packages/shared/src/index.ts
git commit -m "feat(settings): add Zod schemas for settings.json"
```

---

## Chunk 2: Backend API

### Task 2.1: Create settings API routes

**Files:**
- Create: `packages/cli/src/server/routes/settings.ts`
- Modify: `packages/cli/src/server/index.ts`

- [ ] **Step 1: Create settings.ts route handler**

```typescript
// packages/cli/src/server/routes/settings.ts
import { existsSync } from 'node:fs'
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import { FastifyInstance } from 'fastify'

interface SettingsResponse {
  path: string
  content: Record<string, unknown> | null
  exists: boolean
  error?: string
}

export async function settingsRoutes(fastify: FastifyInstance) {
  // GET /api/settings?project=/path/to/project
  fastify.get<{
    Querystring: { project?: string }
    Reply: SettingsResponse
  }>('/api/settings', async (request, reply) => {
    const projectRoot = request.query.project || process.cwd()
    const settingsPath = path.join(projectRoot, '.claude', 'settings.json')

    try {
      if (!existsSync(settingsPath)) {
        return {
          path: settingsPath,
          content: null,
          exists: false,
        }
      }

      const content = await readFile(settingsPath, 'utf-8')
      return {
        path: settingsPath,
        content: JSON.parse(content),
        exists: true,
      }
    } catch (error) {
      request.log.error(error)
      return {
        path: settingsPath,
        content: null,
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // POST /api/settings?project=/path/to/project
  fastify.post<{
    Querystring: { project?: string }
    Body: { content: Record<string, unknown> }
  }>('/api/settings', async (request, reply) => {
    const projectRoot = request.query.project || process.cwd()
    const settingsPath = path.join(projectRoot, '.claude', 'settings.json')

    try {
      const { content } = request.body

      if (content === undefined) {
        return reply.status(400).send({ success: false, error: 'content is required' })
      }

      // Validate JSON structure (basic check)
      if (typeof content !== 'object' || content === null) {
        return reply.status(400).send({ success: false, error: 'content must be an object' })
      }

      // Ensure .claude directory exists
      const claudeDir = path.dirname(settingsPath)
      if (!existsSync(claudeDir)) {
        await mkdir(claudeDir, { recursive: true })
      }

      // Write settings.json
      await writeFile(settingsPath, JSON.stringify(content, null, 2), 'utf-8')

      return {
        success: true,
        path: settingsPath,
      }
    } catch (error) {
      request.log.error(error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // GET /api/settings/schema
  fastify.get('/api/settings/schema', async () => {
    // Lazy import to avoid circular deps
    const { SettingsJsonSchema } = await import('../../../../shared/src/settingsSchema.js')
    const { zodToJsonSchema } = await import('zod-to-json-schema')

    const jsonSchema = zodToJsonSchema(SettingsJsonSchema, 'settings')
    return jsonSchema
  })
}
```

- [ ] **Step 2: Register routes in server/index.ts**

```typescript
// packages/cli/src/server/index.ts - add import and register
import { settingsRoutes } from './routes/settings.js'

// In createServer(), after configRoutes registration:
await fastify.register(settingsRoutes)
```

- [ ] **Step 3: Test the API manually**

Run: `pnpm dev` in cli package, then:
```bash
curl http://localhost:3000/api/settings
# Expected: {"path": "...", "content": null, "exists": false}
```

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/server/routes/settings.ts packages/cli/src/server/index.ts
git commit -m "feat(settings): add GET/POST /api/settings endpoints"
```

---

## Chunk 3: UI Foundation

### Task 3.1: Set up routing

**Files:**
- Modify: `packages/ui/src/main.tsx`
- Create: `packages/ui/src/App.tsx`

- [ ] **Step 1: Update main.tsx with BrowserRouter**

```typescript
// packages/ui/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false  // Per spec: avoid overwriting unsaved edits
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 2: Create App.tsx with routing**

```typescript
// packages/ui/src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import ClaudeExplorer from './ClaudeExplorer';

export default function App() {
  return (
    <Routes>
      <Route path="/settings/*" element={<ClaudeExplorer />} />
      <Route path="*" element={<Navigate to="/settings" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/main.tsx packages/ui/src/App.tsx
git commit -m "feat(ui): add BrowserRouter and App routing"
```

---

### Task 3.2: Create useSettings hook

**Files:**
- Create: `packages/ui/src/hooks/useSettings.ts`

- [ ] **Step 1: Create useSettings hook**

```typescript
// packages/ui/src/hooks/useSettings.ts
import { SettingsJson } from '@claudeui/shared'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

interface SettingsResponse {
  path: string
  content: SettingsJson | null
  exists: boolean
  error?: string
}

const SETTINGS_KEY = ['settings']

async function fetchSettings(project?: string): Promise<SettingsResponse> {
  const url = project ? `/api/settings?project=${encodeURIComponent(project)}` : '/api/settings'
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to fetch settings')
  }
  return res.json()
}

async function saveSettings(content: SettingsJson, project?: string): Promise<{ success: boolean; path: string; error?: string }> {
  const url = project ? `/api/settings?project=${encodeURIComponent(project)}` : '/api/settings'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  return res.json()
}

export function useSettings(project?: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [...SETTINGS_KEY, project],
    queryFn: () => fetchSettings(project),
  })

  const mutation = useMutation({
    mutationFn: (content: SettingsJson) => saveSettings(content, project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })
    },
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    mutate: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error,
    saveData: mutation.data,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/hooks/useSettings.ts
git commit -m "feat(ui): add useSettings React Query hook"
```

---

### Task 3.3: Create UI components

**Files:**
- Create: `packages/ui/src/components/settings/ui/Input.tsx`
- Create: `packages/ui/src/components/settings/ui/Select.tsx`
- Create: `packages/ui/src/components/settings/ui/Toggle.tsx`
- Create: `packages/ui/src/components/settings/ui/Button.tsx`

- [ ] **Step 1: Create utils.ts first (needed by other components)**

```typescript
// packages/ui/src/components/settings/utils.ts
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
```

- [ ] **Step 2: Create Linear-style Input component**

```typescript
// packages/ui/src/components/settings/ui/Input.tsx
import { cn } from '../utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-[#8A8A8F] uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        className={cn(
          "bg-[#2C2C30] border-none rounded-md px-3 py-2 text-sm text-[#EDEDEF]",
          "placeholder:text-[#8A8A8F] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/50",
          className
        )}
        {...props}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create Select component**

```typescript
// packages/ui/src/components/settings/ui/Select.tsx
import { cn } from '../utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-[#8A8A8F] uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        className={cn(
          "bg-[#2C2C30] border-none rounded-md px-3 py-2 text-sm text-[#EDEDEF]",
          "focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/50",
          className
        )}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Create Toggle component**

```typescript
// packages/ui/src/components/settings/ui/Toggle.tsx
import { cn } from '../utils';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        className={cn(
          "w-8 h-[18px] rounded-full transition-colors relative",
          checked ? "bg-[#5E6AD2]" : "bg-[#3A3A3F]"
        )}
        onClick={() => onChange(!checked)}
      >
        <div
          className={cn(
            "absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full transition-transform",
            checked ? "translate-x-[14px]" : "translate-x-[2px]"
          )}
        />
      </div>
      {label && <span className="text-sm text-[#EDEDEF]">{label}</span>}
    </label>
  );
}
```

- [ ] **Step 5: Create Button component**

```typescript
// packages/ui/src/components/settings/ui/Button.tsx
import { cn } from '../utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
        variant === 'primary' && "bg-[#5E6AD2] text-white hover:bg-[#4b55b8]",
        variant === 'secondary' && "bg-[#2C2C30] text-[#EDEDEF] hover:bg-[#3A3A3F]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/settings/ui/
git commit -m "feat(ui): add Linear-style form components"
```

---

## Chunk 4: Settings Layout Components

### Task 4.1: Create SettingsLayout and Sidebar

**Files:**
- Create: `packages/ui/src/components/settings/SettingsLayout.tsx`
- Create: `packages/ui/src/components/settings/SettingsSidebar.tsx`

- [ ] **Step 1: Create SettingsSidebar**

```typescript
// packages/ui/src/components/settings/SettingsSidebar.tsx
import { cn } from './utils';

const CATEGORIES = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'permissions', label: 'Permissions', icon: '🔒' },
  { id: 'sandbox', label: 'Sandbox', icon: '🛡️' },
  { id: 'hooks', label: 'Hooks', icon: '⚓' },
  { id: 'attribution', label: 'Attribution', icon: '📝' },
  { id: 'mcp', label: 'MCP', icon: '🔌' },
  { id: 'plugins', label: 'Plugins', icon: '🧩' },
  { id: 'environment', label: 'Environment', icon: '🌿' },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

interface SettingsSidebarProps {
  activeCategory: CategoryId;
  onCategoryChange: (id: CategoryId) => void;
}

export function SettingsSidebar({ activeCategory, onCategoryChange }: SettingsSidebarProps) {
  return (
    <aside className="w-60 border-r border-[#3A3A3F] bg-[#1C1C1F] flex flex-col">
      <div className="p-4 border-b border-[#3A3A3F]">
        <h2 className="text-sm font-semibold text-[#EDEDEF]">Settings</h2>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              activeCategory === cat.id
                ? "bg-[#5E6AD2]/20 text-[#5E6AD2] border border-[#5E6AD2]/30"
                : "text-[#8A8A8F] hover:text-[#EDEDEF] hover:bg-[#2C2C30]"
            )}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

export type { CategoryId };
```

- [ ] **Step 2: Create SettingsLayout**

```typescript
// packages/ui/src/components/settings/SettingsLayout.tsx
import { useState } from 'react';
import { SettingsSidebar, CategoryId } from './SettingsSidebar';
import { SettingsContent } from './SettingsContent';

export function SettingsLayout() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('general');

  return (
    <div className="flex h-screen bg-[#1C1C1F] text-[#EDEDEF]">
      <SettingsSidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
      <SettingsContent category={activeCategory} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/settings/SettingsLayout.tsx packages/ui/src/components/settings/SettingsSidebar.tsx
git commit -m "feat(ui): add SettingsLayout and SettingsSidebar"
```

---

### Task 4.2: Create SettingsContent

**Files:**
- Create: `packages/ui/src/components/settings/SettingsContent.tsx`

- [ ] **Step 1: Create SettingsContent**

```typescript
// packages/ui/src/components/settings/SettingsContent.tsx
import { CategoryId } from './SettingsSidebar';
import { GeneralSettings } from './GeneralSettings';

interface SettingsContentProps {
  category: CategoryId;
}

export function SettingsContent({ category }: SettingsContentProps) {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto py-8 px-6">
        {category === 'general' && <GeneralSettings />}
        {category === 'permissions' && <div className="text-[#8A8A8F]">Permissions - Coming soon</div>}
        {category === 'sandbox' && <div className="text-[#8A8A8F]">Sandbox - Coming soon</div>}
        {category === 'hooks' && <div className="text-[#8A8A8F]">Hooks - Coming soon</div>}
        {category === 'attribution' && <div className="text-[#8A8A8F]">Attribution - Coming soon</div>}
        {category === 'mcp' && <div className="text-[#8A8A8F]">MCP - Coming soon</div>}
        {category === 'plugins' && <div className="text-[#8A8A8F]">Plugins - Coming soon</div>}
        {category === 'environment' && <div className="text-[#8A8A8F]">Environment - Coming soon</div>}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/settings/SettingsContent.tsx
git commit -m "feat(ui): add SettingsContent router outlet"
```

---

## Chunk 5: General Settings Form

### Task 5.1: Create GeneralSettings form

**Files:**
- Create: `packages/ui/src/components/settings/GeneralSettings.tsx`

- [ ] **Step 1: Create GeneralSettings component**

```typescript
// packages/ui/src/components/settings/GeneralSettings.tsx
import { useSettings } from '../../hooks/useSettings';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Toggle } from './ui/Toggle';
import { Button } from './ui/Button';
import { useState, useEffect } from 'react';
import isEqual from 'fast-deep-equal';

export function GeneralSettings() {
  const { data, isLoading, mutate, isSaving, saveError } = useSettings();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Initialize form data when settings load
  useEffect(() => {
    if (data?.content) {
      setFormData(data.content);
    }
  }, [data?.content]);

  // Check for changes
  useEffect(() => {
    if (data?.content) {
      setHasChanges(!isEqual(formData, data.content));
    }
  }, [formData, data?.content]);

  const handleSave = () => {
    setSaveStatus('saving');
    mutate(formData, {
      onSuccess: () => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      },
      onError: () => {
        setSaveStatus('error');
      }
    });
  };

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && saveStatus !== 'saving') {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, saveStatus]);

  if (isLoading) {
    return <div className="text-[#8A8A8F]">Loading...</div>;
  }

  const updateField = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // File not found UI
  if (!data?.exists) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-[#EDEDEF]">General</h1>
          <p className="text-sm text-[#8A8A8F] mt-1">
            Configure general settings for Claude Code
          </p>
        </div>

        <div className="bg-[#5E6AD2]/10 border border-[#5E6AD2]/30 rounded-lg p-6 text-center">
          <p className="text-[#EDEDEF] mb-4">
            No settings.json found in this project.
          </p>
          <Button onClick={() => mutate({})}>
            Create settings.json
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#EDEDEF]">General</h1>
        <p className="text-sm text-[#8A8A8F] mt-1">
          Configure general settings for Claude Code
        </p>
      </div>

      {/* Model Settings */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-[#8A8A8F] uppercase tracking-wider border-b border-[#3A3A3F] pb-2">
          Model
        </h2>
        <div className="space-y-4">
          <Input
            label="Model"
            value={formData.model as string || ''}
            onChange={e => updateField('model', e.target.value)}
            placeholder="claude-sonnet-4-20250514"
          />
          <Input
            label="Available Models (comma-separated)"
            value={(formData.availableModels as string[])?.join(', ') || ''}
            onChange={e => updateField('availableModels', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="claude-sonnet-4-20250514, claude-opus-4-6"
          />
        </div>
      </section>

      {/* UI Settings */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-[#8A8A8F] uppercase tracking-wider border-b border-[#3A3A3F] pb-2">
          User Interface
        </h2>
        <div className="space-y-4">
          <Select
            label="Auto Updates Channel"
            value={formData.autoUpdatesChannel as string || ''}
            onChange={e => updateField('autoUpdatesChannel', e.target.value)}
            options={[
              { value: 'stable', label: 'Stable' },
              { value: 'beta', label: 'Beta' }
            ]}
          />
          <Toggle
            label="Always Thinking"
            checked={formData.alwaysThinkingEnabled as boolean || false}
            onChange={v => updateField('alwaysThinkingEnabled', v)}
          />
          <Toggle
            label="Show Turn Duration"
            checked={formData.showTurnDuration as boolean || false}
            onChange={v => updateField('showTurnDuration', v)}
          />
          <Toggle
            label="Prefer Reduced Motion"
            checked={formData.prefersReducedMotion as boolean || false}
            onChange={v => updateField('prefersReducedMotion', v)}
          />
        </div>
      </section>

      {/* Footer Status Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-[#3A3A3F]">
        <span className="text-sm text-[#8A8A8F]">
          {hasChanges ? 'Unsaved changes' : saveStatus === 'saved' ? 'Saved' : 'No changes'}
        </span>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {saveError && (
        <div className="text-red-400 text-sm">Failed to save: {String(saveError)}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Test Phase 1**

Run: `cd packages/ui && pnpm dev`

Verify:
- Opening shows Settings sidebar with 8 categories
- Clicking General shows form
- Form loads settings from API
- Changes tracked, Save button enables
- Cmd+S saves

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/settings/GeneralSettings.tsx
git commit -m "feat(ui): add GeneralSettings form with save functionality"
```

---

## Chunk 6: Integration & Cleanup

### Task 6.1: Integrate SettingsLayout into ClaudeExplorer

**Files:**
- Modify: `packages/ui/src/ClaudeExplorer.tsx`

- [ ] **Step 1: Add Settings entry point**

```typescript
// In ClaudeExplorer.tsx, modify to render SettingsLayout when settings is active
// Instead of the "Under Construction" message:

{activeSection === 'settings' && <SettingsLayout />}

// Need to import:
import { SettingsLayout } from './components/settings/SettingsLayout';
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/ClaudeExplorer.tsx
git commit -m "feat(ui): integrate SettingsLayout into ClaudeExplorer"
```

---

### Task 6.2: Phase 1 verification

- [ ] **Step 1: Run full test**

```bash
# Start backend
cd packages/cli && pnpm dev &

# Start frontend
cd packages/ui && pnpm dev
```

- [ ] **Step 2: Verify acceptance criteria**

- [ ] 左侧分类导航 (8 类) 可点击切换右侧内容
- [ ] General 分类显示所有通用设置字段，枚举字段用下拉选择
- [ ] 输入框采用 Linear 风格 (深灰背景, 无边框)
- [ ] 有改动时底部显示 "Unsaved changes"
- [ ] Cmd+S 保存成功
- [ ] 文件不存在时显示创建引导

- [ ] **Step 3: Commit**

---

## Next Steps (Future Phases)

The following phases are not part of this implementation plan:

- **Phase 2**: Permissions 表单（规则列表 UI）
- **Phase 3**: Sandbox、Hooks 表单（结构化编辑）
- **Phase 4**: MCP、Plugins、Attribution、Environment 表单
- **Phase 5**: JSON 编辑器模式切换（表单 <-> raw JSON）
- **Phase 6**: 浅色模式支持

Each phase should be planned separately after Phase 1 is complete and verified.

---

**Plan complete and saved to `docs/superpowers/plans/2026-03-17-settings-editor-plan.md`. Ready to execute?**
