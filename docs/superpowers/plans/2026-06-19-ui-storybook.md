# UI Storybook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Storybook to `packages/ui` as a design-system documentation surface and a Storybook Vitest addon test foundation for core OhMyC UI components.

**Architecture:** Keep Storybook owned by `packages/ui`, with `.storybook` config, local story fixtures, and focused decorators that provide dark theme, router, React Query, and mock transport only where needed. Use Storybook's React Vite framework and Vitest addon; add a Vitest 3 workspace project named `storybook` so story tests run separately from the existing jsdom unit tests.

**Tech Stack:** React 19, Vite 5, TypeScript, Tailwind CSS, Storybook React Vite, Storybook docs/a11y/Vitest addon, Vitest 3 browser mode, Playwright Chromium, React Query.

---

## References

- Storybook React Vite docs: https://storybook.js.org/docs/get-started/frameworks/react-vite
- Storybook Vitest addon docs: https://storybook.js.org/docs/writing-tests/integrations/vitest-addon
- Storybook testing in CI docs: https://storybook.js.org/docs/writing-tests/in-ci

## File Structure

- Modify: `packages/ui/package.json`
  - Add Storybook scripts and dev dependencies.
- Create: `packages/ui/.storybook/main.ts`
  - Story discovery, addons, Vite aliases, GLB assets, and Tauri stubs.
- Create: `packages/ui/.storybook/preview.tsx`
  - Global CSS import, dark preview parameters, and global story decorator shell.
- Create: `packages/ui/.storybook/vitest.setup.ts`
  - Browser-test setup for jest-dom, layout mocks, transport reset, and Tauri stubs.
- Create: `packages/ui/vitest.workspace.ts`
  - Adds a `storybook` Vitest project using Storybook's Vitest addon and Playwright browser mode.
- Modify: `packages/ui/tsconfig.json`
  - Include `.storybook` and `vitest.workspace.ts`; `src/stories` remains covered by the existing `src` include.
- Create: `packages/ui/src/stories/decorators/storybook-decorators.tsx`
  - Local Storybook decorators for React Query, router, mock transport, dark canvas, and menubar frame.
- Create: `packages/ui/src/stories/fixtures/entities.ts`
  - Agent, skill, command, and badge fixtures.
- Create: `packages/ui/src/stories/fixtures/timeline.ts`
  - Heatmap, event list, timeline query, and menubar fixture data.
- Create: `packages/ui/src/stories/fixtures/commands.tsx`
  - Command palette command fixtures with icons and long labels.
- Create: `packages/ui/src/stories/test/Smoke.stories.tsx`
  - First minimal story to prove Storybook configuration works.
- Create: `packages/ui/src/stories/design-system/*.stories.tsx`
  - Design-system stories for Button, Badge, Input, Tabs, Select, DropdownMenu, NativeDialog, and NativeButton.
- Create: `packages/ui/src/stories/product/*.stories.tsx`
  - Product stories for CommandPalette, NavigationIsland, EntityCard, EntityDetail, ContributionGraph, EventList, and TimelineView.
- Create: `packages/ui/src/stories/menubar/*.stories.tsx`
  - Menubar stories for ViewSwitch, DualLineChart, RecentHeatmap, and MenubarPage.
- Create: `packages/ui/src/stories/product/MonitorSpikeView.stories.tsx`
  - Monitor spike story with browser-test-safe tags.

## Task 1: Install Storybook And Add The Config Skeleton

**Files:**
- Modify: `packages/ui/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/ui/tsconfig.json`
- Create: `packages/ui/.storybook/main.ts`
- Create: `packages/ui/.storybook/preview.tsx`
- Create: `packages/ui/.storybook/vitest.setup.ts`
- Create: `packages/ui/vitest.workspace.ts`
- Create: `packages/ui/src/stories/test/Smoke.stories.tsx`

- [ ] **Step 1: Read product and design requirements**

Read the repository product and design sources before changing Storybook or story files:

```bash
sed -n '1,220p' PRODUCT.md
sed -n '1,260p' DESIGN.md
```

Expected: both files are readable. Treat `PRODUCT.md` as the source of truth for product/voice decisions and `DESIGN.md` as the source of truth for visual/layout decisions. If an implementation detail conflicts with either document, update the relevant doc first and include that doc change in the task commit.

- [ ] **Step 2: Verify Storybook scripts are missing**

Run:

```bash
pnpm --filter @ohmyc/ui storybook
```

Expected: FAIL with a pnpm message indicating the `storybook` script is missing.

- [ ] **Step 3: Install Storybook dependencies**

Run:

```bash
pnpm --filter @ohmyc/ui add -D storybook@^10.4.0 @storybook/react-vite@^10.4.0 @storybook/addon-docs@^10.4.0 @storybook/addon-a11y@^10.4.0 @storybook/addon-vitest@^10.4.0 @storybook/test@^10.4.0 @storybook/blocks@^10.4.0 @vitest/browser@^3.2.4 playwright@^1.58.2
```

Expected: dependencies install and `packages/ui/package.json` plus `pnpm-lock.yaml` change.

- [ ] **Step 4: Install the Chromium browser used by Vitest browser mode**

Run:

```bash
pnpm --filter @ohmyc/ui exec playwright install chromium
```

Expected: Playwright reports Chromium is installed or already present.

- [ ] **Step 5: Update `packages/ui/package.json` scripts**

Edit `packages/ui/package.json` so the `scripts` object includes these exact entries. The `test` and `test:coverage` scripts intentionally add `--config vitest.config.ts` so the new `vitest.workspace.ts` does not make existing unit-test commands run Storybook browser tests.

```json
{
  "build": "tsc && vite build",
  "build-storybook": "storybook build",
  "dev": "vite --host 127.0.0.1",
  "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
  "preview": "vite preview",
  "storybook": "storybook dev -p 6006",
  "test": "vitest run --config vitest.config.ts",
  "test:coverage": "vitest run --config vitest.config.ts --coverage",
  "test:storybook": "vitest --project=storybook --run"
}
```

- [ ] **Step 6: Create `packages/ui/.storybook/main.ts`**

Create the file with this content:

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { StorybookConfig } from '@storybook/react-vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(rootDir, '..')

const config: StorybookConfig = {
  stories: [
    '../src/stories/**/*.mdx',
    '../src/stories/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    config.assetsInclude = [
      ...(Array.isArray(config.assetsInclude) ? config.assetsInclude : []),
      '**/*.glb',
    ]
    config.resolve = {
      ...config.resolve,
      alias: {
        ...(Array.isArray(config.resolve?.alias) ? {} : config.resolve?.alias),
        '@': path.resolve(packageRoot, 'src'),
        '@tauri-apps/api/core': path.resolve(packageRoot, 'tests/test/stubs/tauri-api-core.ts'),
        '@tauri-apps/api/event': path.resolve(packageRoot, 'tests/test/stubs/tauri-api-event.ts'),
      },
    }
    config.optimizeDeps = {
      ...config.optimizeDeps,
      include: [
        ...(config.optimizeDeps?.include ?? []),
        '@lobehub/ui',
        '@lobehub/icons',
      ],
    }
    config.ssr = {
      ...config.ssr,
      noExternal: [
        ...(Array.isArray(config.ssr?.noExternal) ? config.ssr.noExternal : []),
        '@lobehub/ui',
        '@lobehub/icons',
      ],
    }
    config.server = {
      ...config.server,
      proxy: {
        ...(config.server?.proxy ?? {}),
        '/api': 'http://127.0.0.1:3000',
      },
    }
    return config
  },
}

export default config
```

- [ ] **Step 7: Create `packages/ui/.storybook/preview.tsx`**

Create the file with this content:

```tsx
import '../src/globals.css'

import type { Preview } from '@storybook/react-vite'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'OhMyC dark',
      values: [
        { name: 'OhMyC dark', value: '#08090a' },
        { name: 'Panel', value: '#0f1011' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'centered',
    options: {
      storySort: {
        order: ['Design System', 'Product', 'Menubar', 'Test'],
      },
    },
  },
  decorators: [
    Story => (
      <div className="min-h-screen bg-[var(--bg-marketing)] p-8 font-sans text-[var(--text-primary)]">
        <Story />
      </div>
    ),
  ],
}

export default preview
```

- [ ] **Step 8: Create `packages/ui/.storybook/vitest.setup.ts`**

Create the file with this content:

```ts
import '@testing-library/jest-dom/vitest'

import { afterEach } from 'vitest'

import { resetMock } from '../src/lib/transport/mock'
import { resetTransportForTests } from '../src/lib/transport'

afterEach(() => {
  resetMock()
  resetTransportForTests()
})
```

- [ ] **Step 9: Create `packages/ui/vitest.workspace.ts`**

Create the file with this content:

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { defineWorkspace } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineWorkspace([
  './vitest.config.ts',
  {
    extends: './vite.config.ts',
    plugins: [
      storybookTest({
        configDir: path.join(dirname, '.storybook'),
        storybookScript: 'pnpm --filter @ohmyc/ui storybook -- --no-open',
        tags: {
          include: ['test'],
          exclude: ['experimental'],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(dirname, 'src'),
        '@tauri-apps/api/core': path.resolve(dirname, 'tests/test/stubs/tauri-api-core.ts'),
        '@tauri-apps/api/event': path.resolve(dirname, 'tests/test/stubs/tauri-api-event.ts'),
      },
    },
    test: {
      name: 'storybook',
      browser: {
        enabled: true,
        provider: 'playwright',
        headless: true,
        instances: [{ browser: 'chromium' }],
      },
      setupFiles: ['./.storybook/vitest.setup.ts'],
      server: {
        deps: {
          inline: [/@lobehub\/(ui|icons)/],
        },
      },
    },
  },
])
```

- [ ] **Step 10: Update `packages/ui/tsconfig.json` include**

Replace:

```json
"include": ["src"]
```

with:

```json
"include": ["src", ".storybook", "vitest.workspace.ts"]
```

- [ ] **Step 11: Create `packages/ui/src/stories/test/Smoke.stories.tsx`**

Create the directory and file with this content:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Test/Smoke',
  tags: ['test'],
  render: () => (
    <div className="rounded-lg border border-[var(--border-default)] bg-white/[0.02] px-4 py-3 text-[var(--text-primary)]">
      Storybook is wired to OhMyC UI.
    </div>
  ),
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
```

- [ ] **Step 12: Run Storybook build**

Run:

```bash
pnpm --filter @ohmyc/ui build-storybook
```

Expected: PASS and Storybook writes a static build.

- [ ] **Step 13: Run Storybook Vitest addon tests**

Run:

```bash
pnpm --filter @ohmyc/ui test:storybook
```

Expected: PASS with the smoke story rendered in Chromium.

- [ ] **Step 14: Run existing UI tests**

Run:

```bash
pnpm --filter @ohmyc/ui test
```

Expected: PASS. Existing Radix Dialog accessibility warnings may still print.

- [ ] **Step 15: Commit**

```bash
git add packages/ui/package.json pnpm-lock.yaml packages/ui/tsconfig.json packages/ui/.storybook/main.ts packages/ui/.storybook/preview.tsx packages/ui/.storybook/vitest.setup.ts packages/ui/vitest.workspace.ts packages/ui/src/stories/test/Smoke.stories.tsx
git commit -m "chore: add storybook test harness"
```

## Task 2: Add Shared Storybook Decorators And Fixtures

**Files:**
- Create: `packages/ui/src/stories/decorators/storybook-decorators.tsx`
- Create: `packages/ui/src/stories/fixtures/entities.ts`
- Create: `packages/ui/src/stories/fixtures/commands.tsx`
- Create: `packages/ui/src/stories/fixtures/timeline.ts`

- [ ] **Step 1: Create `packages/ui/src/stories/decorators/storybook-decorators.tsx`**

Create the file with this content:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { __setTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

import type { Decorator } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import type { TimelineMetric } from '@/hooks/use-timeline'

export function createStoryQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  })
}

export const withQueryClient: Decorator = Story => (
  <QueryClientProvider client={createStoryQueryClient()}>
    <Story />
  </QueryClientProvider>
)

export const withRouter = (initialEntries: string[] = ['/explore/timeline']): Decorator => Story => (
  <MemoryRouter initialEntries={initialEntries}>
    <Story />
  </MemoryRouter>
)

export function withMockTransport(installHandlers: () => void): Decorator {
  return (Story) => {
    resetMock()
    __setTransportForTests('mock')
    installHandlers()
    return <Story />
  }
}

export function installTimelineHandlers({
  years,
  projects,
  heatmapByMetric,
  events,
  status,
}: {
  years: number[]
  projects: string[]
  heatmapByMetric: Partial<Record<TimelineMetric, Array<{ date: string; value: number }>>>
  events: unknown
  status: { sessionCount: number; lastSyncAt: number | null }
}) {
  setMockHandler('timeline.years', async () => ({ years }))
  setMockHandler('timeline.projects', async () => ({ projects }))
  setMockHandler('timeline.heatmap', async (args) => {
    const metric = (args as { metric?: TimelineMetric }).metric ?? 'sessions'
    return { data: heatmapByMetric[metric] ?? [] }
  })
  setMockHandler('timeline.events', async () => events)
  setMockHandler('timeline.status', async () => status)
}

export function MenubarFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[18px] bg-[#050607] p-8">
      <div className="h-[304px] w-[390px] overflow-hidden rounded-[12px] border border-white/10 bg-[rgba(25,26,27,0.45)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `packages/ui/src/stories/fixtures/entities.ts`**

Create the file with this content:

```ts
import type { Origin, RenderBadge } from '@ohmyc/shared'

export const entityOrigins = ['claude', 'opencode'] satisfies Origin[]

export const entityBadges = [
  { kind: 'mono', label: 'opus' },
  { kind: 'pill', label: 'bash', tone: 'neutral' },
] satisfies RenderBadge[]

export const entityMeta = [
  { label: 'scope', value: 'project' },
  { label: 'source', value: 'opencode' },
  { label: 'mode', value: 'primary' },
  { label: 'permission.edit', value: 'deny' },
  { label: 'permission.bash', value: 'ask' },
]

export const entityMarkdown = `# Review agent

Use this agent when a change needs a focused implementation review.

- Check behavior against the request
- Inspect error handling and state boundaries
- Call out missing tests
`

export const entityDescriptions = {
  short: 'Reviews implementation changes before they land.',
  long: 'Reviews implementation changes across product-critical UI surfaces, checks data flow boundaries, and keeps feedback focused on behavior, visual regressions, and missing tests.',
}
```

- [ ] **Step 3: Create `packages/ui/src/stories/fixtures/commands.tsx`**

Create the file with this content:

```tsx
import {
  Activity,
  Bot,
  Code2,
  Search,
  TerminalSquare,
} from 'lucide-react'

export const commandPaletteCommands = [
  { id: 'monitor', label: 'Open Monitor', category: 'Go to', shortcut: 'g m', icon: <Code2 size={15} />, action: () => {} },
  { id: 'timeline', label: 'Open Timeline', category: 'Go to', shortcut: 'g t', icon: <Activity size={15} />, action: () => {} },
  { id: 'agents', label: 'Open Agents', category: 'Go to', shortcut: 'g a', icon: <Bot size={15} />, action: () => {} },
  { id: 'commands', label: 'Open Commands', category: 'Go to', shortcut: 'g c', icon: <TerminalSquare size={15} />, action: () => {} },
  { id: 'long', label: 'Open the generated command with a very long name without squeezing the shortcut column', category: 'Commands', shortcut: 'meta+shift+p', icon: <Search size={15} />, action: () => {} },
]
```

- [ ] **Step 4: Create `packages/ui/src/stories/fixtures/timeline.ts`**

Create the file with this content:

```ts
import type {
  DayEvents,
  HeatmapPoint,
  ProjectGroup,
  SessionRow,
} from '@/hooks/use-timeline'

const baseStart = Date.UTC(2026, 5, 19, 9, 0, 0)

function relativeDate(daysAgo: number): string {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

function session(overrides: Partial<SessionRow>): SessionRow {
  return {
    session_id: overrides.session_id ?? 'session-1',
    project: overrides.project ?? 'ohmyc',
    started_at: overrides.started_at ?? baseStart,
    ended_at: overrides.ended_at ?? baseStart + 12 * 60 * 1000,
    duration_ms: overrides.duration_ms ?? 12 * 60 * 1000,
    turns: overrides.turns ?? 8,
    tokens_input: overrides.tokens_input ?? 12_000,
    tokens_output: overrides.tokens_output ?? 4300,
    tokens_cached: overrides.tokens_cached ?? 2000,
    summary: overrides.summary ?? 'Polished the monitor route and motion details',
    summary_source: overrides.summary_source ?? 'generated',
    transcript_path: overrides.transcript_path ?? '/tmp/session.jsonl',
    last_offset: overrides.last_offset ?? 42,
    ingested_at: overrides.ingested_at ?? baseStart + 13 * 60 * 1000,
    model: overrides.model ?? 'claude-opus-4-1',
    agent_name: overrides.agent_name ?? 'claude',
  }
}

export const timelineHeatmap: HeatmapPoint[] = [
  { date: '2026-01-04', value: 1 },
  { date: '2026-02-14', value: 4 },
  { date: '2026-03-20', value: 8 },
  { date: '2026-04-22', value: 16 },
  { date: '2026-05-21', value: 32 },
  { date: '2026-06-19', value: 48 },
]

export const menubarTokens: HeatmapPoint[] = [
  { date: relativeDate(4), value: 5000 },
  { date: relativeDate(3), value: 12_000 },
  { date: relativeDate(2), value: 8000 },
  { date: relativeDate(1), value: 22_000 },
  { date: relativeDate(0), value: 15_000 },
]

export const menubarSessions: HeatmapPoint[] = [
  { date: relativeDate(4), value: 1 },
  { date: relativeDate(3), value: 3 },
  { date: relativeDate(2), value: 2 },
  { date: relativeDate(1), value: 5 },
  { date: relativeDate(0), value: 4 },
]

const ohmycSessions = [
  session({ session_id: 'ohmyc-a', summary: 'Wire Storybook fixtures for Timeline', turns: 14 }),
  session({ session_id: 'ohmyc-b', summary: 'Review command palette layout', started_at: baseStart - 90 * 60 * 1000, turns: 6 }),
]

const desktopSessions = [
  session({
    session_id: 'desktop-a',
    project: 'ohmyc-desktop',
    summary: 'Tune menubar heatmap tooltip behavior',
    agent_name: 'opencode',
    turns: 9,
  }),
]

export const timelineProjectGroups: ProjectGroup[] = [
  {
    project: 'ohmyc',
    sessions: ohmycSessions,
    session_count: 2,
    turn_count: 20,
    token_count: 36_300,
    tool_count: 7,
    skill_count: 2,
    agents: ['claude'],
  },
  {
    project: 'ohmyc-desktop',
    sessions: desktopSessions,
    session_count: 1,
    turn_count: 9,
    token_count: 18_300,
    tool_count: 4,
    skill_count: 1,
    agents: ['opencode'],
  },
]

export const timelineDays: DayEvents[] = [
  {
    day: '2026-06-19',
    projectGroups: timelineProjectGroups,
    session_count: 3,
    turn_count: 29,
    token_count: 54_600,
  },
]

export const timelineEventsResponse = {
  days: timelineDays,
}
```

- [ ] **Step 5: Run TypeScript build to verify fixtures and decorators type-check**

Run:

```bash
pnpm --filter @ohmyc/ui build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/stories/decorators/storybook-decorators.tsx packages/ui/src/stories/fixtures/entities.ts packages/ui/src/stories/fixtures/commands.tsx packages/ui/src/stories/fixtures/timeline.ts
git commit -m "test: add storybook fixtures and decorators"
```

## Task 3: Add Design-System Stories

**Files:**
- Create: `packages/ui/src/stories/design-system/Button.stories.tsx`
- Create: `packages/ui/src/stories/design-system/Badge.stories.tsx`
- Create: `packages/ui/src/stories/design-system/Input.stories.tsx`
- Create: `packages/ui/src/stories/design-system/Tabs.stories.tsx`
- Create: `packages/ui/src/stories/design-system/Select.stories.tsx`
- Create: `packages/ui/src/stories/design-system/DropdownMenu.stories.tsx`
- Create: `packages/ui/src/stories/design-system/NativeDialog.stories.tsx`
- Create: `packages/ui/src/stories/design-system/NativeButton.stories.tsx`

- [ ] **Step 1: Create `Button.stories.tsx`**

Create `packages/ui/src/stories/design-system/Button.stories.tsx`:

```tsx
import { Search, Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/Button',
  component: Button,
  tags: ['test', 'autodocs'],
  render: args => <Button {...args} />,
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Search"><Search /></Button>
      <Button size="icon-lg" aria-label="Settings"><Settings /></Button>
    </div>
  ),
}

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
  },
}
```

- [ ] **Step 2: Create the remaining design-system stories**

Create `packages/ui/src/stories/design-system/Badge.stories.tsx`:

```tsx
import { Badge } from '@/components/ui/badge'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/Badge',
  component: Badge,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof Badge>

export default meta

type Story = StoryObj<typeof meta>

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge>claude · opencode</Badge>
    </div>
  ),
}
```

Create `packages/ui/src/stories/design-system/Input.stories.tsx`:

```tsx
import { Input } from '@/components/ui/input'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/Input',
  component: Input,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof Input>

export default meta

type Story = StoryObj<typeof meta>

export const States: Story = {
  render: () => (
    <div className="grid w-[360px] gap-3">
      <Input placeholder="Search commands..." />
      <Input value="readonly value" readOnly />
      <Input placeholder="Disabled input" disabled />
      <Input aria-invalid placeholder="Invalid input" />
    </div>
  ),
}
```

Create `packages/ui/src/stories/design-system/Tabs.stories.tsx`:

```tsx
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/Tabs',
  component: Tabs,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof Tabs>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="activity" className="w-[420px]">
      <TabsList>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="tokens">Tokens</TabsTrigger>
        <TabsTrigger value="sessions">Sessions</TabsTrigger>
      </TabsList>
      <TabsContent value="activity">Activity view content</TabsContent>
      <TabsContent value="tokens">Token view content</TabsContent>
      <TabsContent value="sessions">Session view content</TabsContent>
    </Tabs>
  ),
}
```

Create `packages/ui/src/stories/design-system/Select.stories.tsx`:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/Select',
  component: Select,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

export const Open: Story = {
  render: () => (
    <Select defaultValue="tokens" open>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Metric" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="activity">Activity</SelectItem>
        <SelectItem value="tokens">Tokens</SelectItem>
        <SelectItem value="turns">Turns</SelectItem>
      </SelectContent>
    </Select>
  ),
}
```

Create `packages/ui/src/stories/design-system/DropdownMenu.stories.tsx`:

```tsx
import { MoreHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/DropdownMenu',
  component: DropdownMenu,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof DropdownMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Open: Story = {
  render: () => (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem>Open<DropdownMenuShortcut>⌘O</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem>Copy path<DropdownMenuShortcut>⌘C</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked>Show archived</DropdownMenuCheckboxItem>
        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}
```

Create `packages/ui/src/stories/design-system/NativeDialog.stories.tsx`:

```tsx
import { Button } from '@/components/ui/button'
import {
  NativeDialog,
  NativeDialogContent,
  NativeDialogDescription,
  NativeDialogFooter,
  NativeDialogHeader,
  NativeDialogTitle,
} from '@/components/uitripled/native-dialog'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/NativeDialog',
  component: NativeDialog,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof NativeDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Open: Story = {
  render: () => (
    <NativeDialog open>
      <NativeDialogContent className="bg-[var(--surface-overlay)] text-[var(--text-primary)]">
        <NativeDialogHeader>
          <NativeDialogTitle>Delete command</NativeDialogTitle>
          <NativeDialogDescription>
            This shows the dialog chrome, title, description, and footer actions.
          </NativeDialogDescription>
        </NativeDialogHeader>
        <NativeDialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </NativeDialogFooter>
      </NativeDialogContent>
    </NativeDialog>
  ),
}
```

Create `packages/ui/src/stories/design-system/NativeButton.stories.tsx`:

```tsx
import { NativeButton } from '@/components/uitripled/native-button'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/NativeButton',
  component: NativeButton,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof NativeButton>

export default meta

type Story = StoryObj<typeof meta>

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <NativeButton>Default</NativeButton>
      <NativeButton variant="outline">Outline</NativeButton>
      <NativeButton loading>Loading</NativeButton>
      <NativeButton disabled>Disabled</NativeButton>
    </div>
  ),
}
```

- [ ] **Step 3: Run Storybook tests**

Run:

```bash
pnpm --filter @ohmyc/ui test:storybook
```

Expected: PASS.

- [ ] **Step 4: Run Storybook build**

Run:

```bash
pnpm --filter @ohmyc/ui build-storybook
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/stories/design-system
git commit -m "docs: add design system stories"
```

## Task 4: Add Product Component Stories

**Files:**
- Create: `packages/ui/src/stories/product/CommandPalette.stories.tsx`
- Create: `packages/ui/src/stories/product/NavigationIsland.stories.tsx`
- Create: `packages/ui/src/stories/product/EntityCard.stories.tsx`
- Create: `packages/ui/src/stories/product/EntityDetail.stories.tsx`

- [ ] **Step 1: Create `CommandPalette.stories.tsx`**

Create `packages/ui/src/stories/product/CommandPalette.stories.tsx`:

```tsx
import { fireEvent, within } from '@storybook/test'

import { CommandPalette, CommandPaletteProvider } from '@/components/command-palette'
import { commandPaletteCommands } from '@/stories/fixtures/commands'

import type { Meta, StoryObj } from '@storybook/react-vite'

function OpenPalette({ commands = commandPaletteCommands }: { commands?: typeof commandPaletteCommands }) {
  return (
    <CommandPaletteProvider>
      <button type="button" className="sr-only" data-testid="open-command-palette">
        Open command palette
      </button>
      <CommandPalette commands={commands} />
    </CommandPaletteProvider>
  )
}

const meta = {
  title: 'Product/CommandPalette',
  component: CommandPalette,
  tags: ['test', 'autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CommandPalette>

export default meta

type Story = StoryObj<typeof meta>

export const OpenWithCommands: Story = {
  render: () => <OpenPalette />,
  play: async ({ canvasElement }) => {
    fireEvent.keyDown(canvasElement.ownerDocument, { key: 'k', metaKey: true })
    await within(canvasElement.ownerDocument.body).findByPlaceholderText('Search commands...')
  },
}

export const Empty: Story = {
  render: () => <OpenPalette commands={[]} />,
  play: async ({ canvasElement }) => {
    fireEvent.keyDown(canvasElement.ownerDocument, { key: 'k', metaKey: true })
    await within(canvasElement.ownerDocument.body).findByText('No commands found')
  },
}
```

- [ ] **Step 2: Create `NavigationIsland.stories.tsx`**

Create `packages/ui/src/stories/product/NavigationIsland.stories.tsx`:

```tsx
import { fireEvent, within } from '@storybook/test'

import { CommandPaletteProvider } from '@/components/command-palette'
import { NavigationIsland } from '@/components/navigation-island'
import { withRouter } from '@/stories/decorators/storybook-decorators'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/NavigationIsland',
  component: NavigationIsland,
  tags: ['test', 'autodocs'],
  decorators: [
    withRouter(['/explore/timeline']),
    Story => (
      <CommandPaletteProvider>
        <div className="h-[720px] w-[980px] bg-[var(--bg-marketing)]">
          <Story />
        </div>
      </CommandPaletteProvider>
    ),
  ],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof NavigationIsland>

export default meta

type Story = StoryObj<typeof meta>

export const Expanded: Story = {}

export const Collapsed: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const collapse = await body.findByRole('button', { name: 'Collapse navigation' })
    fireEvent.click(collapse)
    await body.findByRole('button', { name: 'Expand navigation' })
  },
}
```

- [ ] **Step 3: Create `EntityCard.stories.tsx`**

Create `packages/ui/src/stories/product/EntityCard.stories.tsx`:

```tsx
import {
  Bot,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'

import { EntityCard } from '@/components/entity-card'
import {
  entityBadges,
  entityDescriptions,
  entityOrigins,
} from '@/stories/fixtures/entities'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/EntityCard',
  component: EntityCard,
  tags: ['test', 'autodocs'],
  decorators: [
    Story => (
      <div className="grid w-[860px] grid-cols-2 gap-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EntityCard>

export default meta

type Story = StoryObj<typeof meta>

export const Variants: Story = {
  render: () => (
    <>
      <EntityCard icon={Bot} iconAccentVar="--text-primary" title="review-agent" description={entityDescriptions.short} origins={entityOrigins} renderBadges={entityBadges} onClick={() => {}} />
      <EntityCard icon={Sparkles} iconAccentVar="--text-secondary" title="animation-review" description={entityDescriptions.long} origins={['claude']} onClick={() => {}} />
      <EntityCard icon={TerminalSquare} iconAccentVar="--text-tertiary" title="/ship" description="Runs the project shipping checklist." origins={['opencode']} onClick={() => {}} />
    </>
  ),
}
```

- [ ] **Step 4: Create `EntityDetail.stories.tsx`**

Create `packages/ui/src/stories/product/EntityDetail.stories.tsx`:

```tsx
import { EntityDetail } from '@/components/entity-detail'
import { entityMarkdown, entityMeta } from '@/stories/fixtures/entities'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/EntityDetail',
  component: EntityDetail,
  tags: ['test', 'autodocs'],
  decorators: [
    Story => (
      <div className="w-[920px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EntityDetail>

export default meta

type Story = StoryObj<typeof meta>

export const Editable: Story = {
  args: {
    title: 'agents',
    name: 'review-agent',
    description: 'A focused review agent for implementation changes.',
    content: entityMarkdown,
    meta: entityMeta,
    onBack: () => {},
    onEdit: () => {},
    onDelete: () => {},
  },
}

export const ProjectReadOnly: Story = {
  args: {
    title: 'agents',
    name: 'project-review-agent',
    description: 'A project-scoped agent surfaced as view-only.',
    content: entityMarkdown,
    meta: entityMeta,
    onBack: () => {},
    scope: 'project',
  },
}
```

- [ ] **Step 5: Run Storybook tests**

Run:

```bash
pnpm --filter @ohmyc/ui test:storybook
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/stories/product/CommandPalette.stories.tsx packages/ui/src/stories/product/NavigationIsland.stories.tsx packages/ui/src/stories/product/EntityCard.stories.tsx packages/ui/src/stories/product/EntityDetail.stories.tsx
git commit -m "docs: add product component stories"
```

## Task 5: Add Timeline Stories

**Files:**
- Create: `packages/ui/src/stories/product/ContributionGraph.stories.tsx`
- Create: `packages/ui/src/stories/product/EventList.stories.tsx`
- Create: `packages/ui/src/stories/product/TimelineView.stories.tsx`

- [ ] **Step 1: Create `ContributionGraph.stories.tsx`**

Create `packages/ui/src/stories/product/ContributionGraph.stories.tsx`:

```tsx
import { ContributionGraph } from '@/components/timeline/contribution-graph'
import { timelineHeatmap } from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/Timeline/ContributionGraph',
  component: ContributionGraph,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof ContributionGraph>

export default meta

type Story = StoryObj<typeof meta>

export const Activity: Story = {
  args: {
    year: 2026,
    metric: 'sessions',
    data: timelineHeatmap,
    onSelectDay: () => {},
  },
}

export const Tokens: Story = {
  args: {
    year: 2026,
    metric: 'tokens',
    data: timelineHeatmap,
    onSelectDay: () => {},
  },
}
```

- [ ] **Step 2: Create `EventList.stories.tsx`**

Create `packages/ui/src/stories/product/EventList.stories.tsx`:

```tsx
import { EventList } from '@/components/timeline/event-list'
import { timelineDays } from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/Timeline/EventList',
  component: EventList,
  tags: ['test', 'autodocs'],
  decorators: [
    Story => (
      <div className="w-[980px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EventList>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {
  args: {
    days: timelineDays,
  },
}

export const Empty: Story = {
  args: {
    days: [],
  },
}
```

- [ ] **Step 3: Create `TimelineView.stories.tsx`**

Create `packages/ui/src/stories/product/TimelineView.stories.tsx`:

```tsx
import { TimelineView } from '@/components/timeline/timeline-view'
import {
  installTimelineHandlers,
  withMockTransport,
  withQueryClient,
} from '@/stories/decorators/storybook-decorators'
import {
  timelineEventsResponse,
  timelineHeatmap,
} from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const populatedHandlers = () => installTimelineHandlers({
  years: [2026],
  projects: ['ohmyc', 'ohmyc-desktop'],
  heatmapByMetric: {
    sessions: timelineHeatmap,
    tokens: timelineHeatmap,
    turns: timelineHeatmap,
  },
  events: timelineEventsResponse,
  status: { sessionCount: 3, lastSyncAt: Date.UTC(2026, 5, 19, 12, 0, 0) },
})

const meta = {
  title: 'Product/Timeline/TimelineView',
  component: TimelineView,
  tags: ['test', 'autodocs'],
  decorators: [
    withQueryClient,
    withMockTransport(populatedHandlers),
    Story => (
      <div className="h-[760px] w-[1120px] overflow-y-auto">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TimelineView>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {}
```

- [ ] **Step 4: Run Storybook tests and build**

Run:

```bash
pnpm --filter @ohmyc/ui test:storybook
pnpm --filter @ohmyc/ui build-storybook
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/stories/product/ContributionGraph.stories.tsx packages/ui/src/stories/product/EventList.stories.tsx packages/ui/src/stories/product/TimelineView.stories.tsx
git commit -m "docs: add timeline stories"
```

## Task 6: Add Menubar Stories

**Files:**
- Create: `packages/ui/src/stories/menubar/ViewSwitch.stories.tsx`
- Create: `packages/ui/src/stories/menubar/DualLineChart.stories.tsx`
- Create: `packages/ui/src/stories/menubar/RecentHeatmap.stories.tsx`
- Create: `packages/ui/src/stories/menubar/MenubarPage.stories.tsx`

- [ ] **Step 1: Create `ViewSwitch.stories.tsx`**

Create `packages/ui/src/stories/menubar/ViewSwitch.stories.tsx`:

```tsx
import { useState } from 'react'

import { ViewSwitch, type MenubarView } from '@/components/menubar/view-switch'
import { MenubarFrame } from '@/stories/decorators/storybook-decorators'

import type { Meta, StoryObj } from '@storybook/react-vite'

function StatefulSwitch({ initial }: { initial: MenubarView }) {
  const [value, setValue] = useState<MenubarView>(initial)
  return <ViewSwitch value={value} onChange={setValue} />
}

const meta = {
  title: 'Menubar/ViewSwitch',
  component: ViewSwitch,
  tags: ['test', 'autodocs'],
  decorators: [
    Story => (
      <MenubarFrame>
        <div className="flex justify-end p-6">
          <Story />
        </div>
      </MenubarFrame>
    ),
  ],
} satisfies Meta<typeof ViewSwitch>

export default meta

type Story = StoryObj<typeof meta>

export const Line: Story = {
  render: () => <StatefulSwitch initial="line" />,
}

export const Heatmap: Story = {
  render: () => <StatefulSwitch initial="heatmap" />,
}
```

- [ ] **Step 2: Create chart and heatmap stories**

Create `packages/ui/src/stories/menubar/DualLineChart.stories.tsx`:

```tsx
import { DualLineChart } from '@/components/menubar/dual-line-chart'
import { MenubarFrame } from '@/stories/decorators/storybook-decorators'
import { menubarSessions, menubarTokens } from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Menubar/DualLineChart',
  component: DualLineChart,
  tags: ['test', 'autodocs'],
  decorators: [
    Story => (
      <MenubarFrame>
        <div className="p-6">
          <Story />
        </div>
      </MenubarFrame>
    ),
  ],
} satisfies Meta<typeof DualLineChart>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {
  args: {
    tokens: menubarTokens,
    sessions: menubarSessions,
  },
}
```

Create `packages/ui/src/stories/menubar/RecentHeatmap.stories.tsx`:

```tsx
import { RecentHeatmap } from '@/components/menubar/recent-heatmap'
import { MenubarFrame } from '@/stories/decorators/storybook-decorators'
import { menubarSessions, menubarTokens } from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Menubar/RecentHeatmap',
  component: RecentHeatmap,
  tags: ['test', 'autodocs'],
  decorators: [
    Story => (
      <MenubarFrame>
        <div className="p-6">
          <Story />
        </div>
      </MenubarFrame>
    ),
  ],
} satisfies Meta<typeof RecentHeatmap>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {
  args: {
    tokens: menubarTokens,
    sessions: menubarSessions,
  },
}

export const Empty: Story = {
  args: {
    tokens: [],
    sessions: [],
  },
}
```

- [ ] **Step 3: Create `MenubarPage.stories.tsx`**

Create `packages/ui/src/stories/menubar/MenubarPage.stories.tsx`:

```tsx
import { fireEvent, within } from '@storybook/test'

import { MenubarPage } from '@/components/menubar/menubar-page'
import {
  installTimelineHandlers,
  MenubarFrame,
  withMockTransport,
  withQueryClient,
} from '@/stories/decorators/storybook-decorators'
import { menubarSessions, menubarTokens } from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const populatedHandlers = () => installTimelineHandlers({
  years: [2026],
  projects: ['ohmyc'],
  heatmapByMetric: {
    tokens: menubarTokens,
    sessions: menubarSessions,
  },
  events: { days: [] },
  status: { sessionCount: 9, lastSyncAt: Date.UTC(2026, 5, 19, 12, 0, 0) },
})

const emptyHandlers = () => installTimelineHandlers({
  years: [2026],
  projects: [],
  heatmapByMetric: {
    tokens: [],
    sessions: [],
  },
  events: { days: [] },
  status: { sessionCount: 0, lastSyncAt: null },
})

const meta = {
  title: 'Menubar/MenubarPage',
  component: MenubarPage,
  tags: ['test', 'autodocs'],
  decorators: [
    withQueryClient,
    Story => (
      <MenubarFrame>
        <Story />
      </MenubarFrame>
    ),
  ],
} satisfies Meta<typeof MenubarPage>

export default meta

type Story = StoryObj<typeof meta>

export const LineView: Story = {
  decorators: [withMockTransport(populatedHandlers)],
}

export const HeatmapView: Story = {
  decorators: [withMockTransport(populatedHandlers)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heatmap = await canvas.findByRole('tab', { name: 'Heatmap view' })
    fireEvent.click(heatmap)
  },
}

export const NoActivity: Story = {
  decorators: [withMockTransport(emptyHandlers)],
}
```

- [ ] **Step 4: Run Storybook tests and build**

Run:

```bash
pnpm --filter @ohmyc/ui test:storybook
pnpm --filter @ohmyc/ui build-storybook
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/stories/menubar
git commit -m "docs: add menubar stories"
```

## Task 7: Add Monitor Spike Story And Final Storybook Metadata

**Files:**
- Create: `packages/ui/src/stories/product/MonitorSpikeView.stories.tsx`
- Create: `packages/ui/src/stories/Intro.mdx`

- [ ] **Step 1: Create `MonitorSpikeView.stories.tsx`**

Create `packages/ui/src/stories/product/MonitorSpikeView.stories.tsx`:

```tsx
import { MonitorSpikeView } from '@/components/monitor-spike/monitor-spike-view'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/MonitorSpikeView',
  component: MonitorSpikeView,
  tags: ['test', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof MonitorSpikeView>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
```

- [ ] **Step 2: Create `packages/ui/src/stories/Intro.mdx`**

Create the file with this content:

```mdx
import { Meta } from '@storybook/blocks'

<Meta title="OhMyC/Intro" />

# OhMyC UI

Storybook documents the `packages/ui` design system and key product surfaces.

This first version focuses on:

- Monochrome dark UI primitives.
- Product-critical surfaces such as command search, navigation, timeline, and monitor.
- Menubar popover UI from `packages/ui/src/components/menubar`.
- Storybook Vitest addon coverage for stable story render and interaction checks.

Chromatic is intentionally not configured in this version. Stories use local
fixtures, with menubar heatmap dates generated relative to the current day so
runtime date windows keep rendering data.
```

- [ ] **Step 3: Run Storybook tests and build**

Run:

```bash
pnpm --filter @ohmyc/ui test:storybook
pnpm --filter @ohmyc/ui build-storybook
```

Expected: both commands PASS. If `test:storybook` fails because `MonitorSpikeView` cannot initialize WebGL/assets in Playwright, edit `packages/ui/src/stories/product/MonitorSpikeView.stories.tsx` to append this exact line after `export const Default: Story = {}`:

```ts
Default.tags = ['!test', 'experimental', 'autodocs']
```

Then rerun `pnpm --filter @ohmyc/ui test:storybook` and `pnpm --filter @ohmyc/ui build-storybook`.

Expected after fallback: `test:storybook` skips this story; `build-storybook` still includes docs/autodocs for it.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/stories/product/MonitorSpikeView.stories.tsx packages/ui/src/stories/Intro.mdx
git commit -m "docs: add monitor storybook entry"
```

## Task 8: Final Verification

**Files:**
- No new files.
- Verify all Storybook and UI commands.

- [ ] **Step 1: Run Storybook build**

Run:

```bash
pnpm --filter @ohmyc/ui build-storybook
```

Expected: PASS.

- [ ] **Step 2: Run Storybook Vitest addon tests**

Run:

```bash
pnpm --filter @ohmyc/ui test:storybook
```

Expected: PASS.

- [ ] **Step 3: Run existing UI tests**

Run:

```bash
pnpm --filter @ohmyc/ui test
```

Expected: PASS.

- [ ] **Step 4: Run UI build**

Run:

```bash
pnpm --filter @ohmyc/ui build
```

Expected: PASS.

- [ ] **Step 5: Check lint status without blocking on existing tooling crash**

Run:

```bash
pnpm --filter @ohmyc/ui lint
```

Expected: Either PASS, or the known existing `eslint-plugin-tailwindcss` / ESLint 10 `context.getSourceCode is not a function` crash. If lint fails with any new source-file issue in Storybook files, fix it before finishing.

- [ ] **Step 6: Inspect git status**

Run:

```bash
git status --short
```

Expected: clean working tree after the task commits.

## Self-Review

**Spec coverage:** This plan covers `packages/ui` local Storybook ownership, docs/a11y/Vitest addon, no Chromatic, no preview HTML, shared decorators, local fixtures with runtime-relative menubar dates, design-system stories, product stories, Timeline stories, Menubar UI stories, MonitorSpike story, and final Storybook/UI verification. CI workflow wiring is intentionally out of scope for this first plan; the plan adds local package scripts and leaves CI adoption for a follow-up.

**Placeholder scan:** No `TBD`, `TODO`, "implement later", or unresolved placeholder instructions remain. The only conditional branch is a concrete WebGL fallback for `MonitorSpikeView` story testing with an exact tag change.

**Type consistency:** Storybook files use `Meta` and `StoryObj` from `@storybook/react-vite`, decorators use Storybook's `Decorator` type, timeline fixtures match `HeatmapPoint`, `SessionRow`, `ProjectGroup`, and `DayEvents`, and the Storybook Vitest project name matches the `test:storybook` script.
