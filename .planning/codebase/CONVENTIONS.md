# Coding Conventions

**Analysis Date:** 2026-03-29

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `ViewSwitcher.tsx`, `Input.tsx`)
- Services: PascalCase with "Service" suffix (e.g., `AgentService.ts`)
- Routes: Plural, PascalCase (e.g., `agents.ts`)
- Tests: Suffix with `.test.ts` (e.g., `agentService.test.ts`)
- Type definitions: Suffix with `.d.ts` (e.g., `index.d.ts`)
- Shared module files: Lowercase (e.g., `index.ts`)

**Functions:**
- React components: PascalCase (e.g., `ViewSwitcher`, `Input`)
- Service methods: camelCase (e.g., `list()`, `create()`, `update()`)
- API route handlers: camelCase (e.g., `get()`, `post()`)
- Test hooks: camelCase (e.g., `useProfiles`)
- Hook names: `use` + PascalCase (e.g., `useProfiles`, `useAgents`)

**Variables:**
- Constants: UPPER_SNAKE_CASE (e.g., `VIEWS`, `SAFE_NAME_PATTERN`)
- State variables: camelCase (e.g., `name`, `description`)
- Props: camelCase (e.g., `active`, `onChange`)
- Service instances: camelCase (e.g., `service`, `resolver`)

**Types:**
- Interface: PascalCase + "Props" or "Options" (e.g., `ViewSwitcherProps`)
- Generic types: T + PascalCase (e.g., `ViewId`)
- Object types: PascalCase (e.g., `ProfilesListResponse`)

## Code Style

**Formatting:**
- Tool: ESLint
- Key settings:
  - No unused disable directives
  - Maximum warnings set to 0
- TypeScript config:
  - `strict: true`
  - `declaration: true`
  - `declarationMap: true`
  - `sourceMap: true`
  - `isolatedModules: true`
  - `composite: true`

**Linting:**
- Tool: ESLint
- Command: `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`
- Enforcement: Enforced via `package.json` scripts
- No global ESLint config - relies on TypeScript compiler options

## Import Organization

**Order:**
1. React and third-party libraries
2. Relative imports from same directory
3. Workspace imports (e.g., `@claudeui/shared`)
4. Node.js built-ins

**Path Aliases:**
- `@claudeui/shared`: maps to `packages/shared/src/index.ts`

**Imports Format:**
```typescript
import { useState, useEffect } from 'react';
import { cn } from './cn';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { Profile } from '@claudeui/shared';
```

## Error Handling

**Patterns:**
- Async operations: Try/catch blocks
- API errors: Throw Error with descriptive messages
- Validation: Throw Error with validation details
- File operations: Try/catch, return null for missing files
- API responses: Check `res.ok`, throw Error on failure

**Examples:**
```typescript
// API fetch
async function fetchProfile(name: string): Promise<Profile> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('Profile not found');
  const data = await res.json();
  return data.profile;
}

// File operation
async function getAgent(name: string): Promise<Agent | null> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return this.parseAgentFile(`${name}.md`, raw);
  } catch {
    return null;
  }
}
```

## Logging

**Framework:** console.log (no formal logging framework)

**Patterns:**
- Used sparingly in CLI and server
- Error messages: `console.error('Failed to start server:', err);`
- No structured logging patterns observed
- No debug logging mechanisms

## Comments

**When to Comment:**
- Complex business logic
- API route logic with special handling
- File system operations
- Test setup/teardown

**JSDoc/TSDoc:**
- Minimal usage - mostly on interfaces
- Consistent interface documentation
- No detailed function documentation beyond types

**Examples:**
```typescript
interface AgentsRoutesOptions {
  agentsDir: string;
  pluginsDir: string;
  settingsPath: string;
}
```

## Function Design

**Size:**
- React components: 40-150 lines
- Service methods: 10-50 lines
- API routes: 10-40 lines
- Test files: 200-500 lines

**Parameters:**
- React components: Props object
- Service methods: Parameters as objects where complex
- API routes: Fastify request/response objects
- Maximum 3-4 parameters per function

**Return Values:**
- Service methods: Data or null on failure
- API routes: Fastify response
- React components: JSX
- Always typed (no implicit returns)

## Module Design

**Exports:**
- Shared: Named exports for types and functions
- Services: Class-based with methods
- UI components: Named component exports
- Hooks: Named hooks with typed parameters
- Test files: No exports

**Barrel Files:**
- Shared package: `packages/shared/src/index.ts` exports all types
- UI: No barrel files - individual component imports
- Services: No barrel files - direct file imports

## CSS Styling

**Framework:** Tailwind CSS with CSS variables

**Patterns:**
- CSS variables for theme (defined in globals.css)
- Utility classes for most styling
- Custom utilities in `@layer utilities`
- Consistent spacing using Tailwind spacing scale
- Design tokens in CSS variables

**Theme Variables:**
```css
--surface-base: #080a0a;
--surface-overlay: #15181a;
--border-default: #202427;
--text-primary: #e2e4e3;
--accent-blue: #5E6AD2;
--transition-normal: 200ms ease;
```

**Component Styling:**
- Consistent use of `cn()` utility for class merging
- Tailwind classes for layout and spacing
- CSS variables for theming
- Motion library for animations

## Animation

**Framework:** Framer Motion

**Patterns:**
- Button hover effects: `whileHover={{ scale: 1.01 }}`
- Button press effects: `whileTap={{ scale: 0.98 }}`
- Input focus animations: `whileFocus={{ scale: 1.005 }}`
- Smooth transitions: `transition={{ type: 'spring', stiffness: 400, damping: 17 }}`

## Async Patterns

**React Query:**
- Typed hooks (e.g., `useProfiles()`)
- Query key arrays (e.g., `['profiles']`)
- Mutation callbacks (onSuccess, onError)
- Query invalidation on mutations

**Service Methods:**
- Async/await consistently
- Null returns for missing data
- Error throwing for failures
- File operations with try/catch

---

*Convention analysis: 2026-03-29*
```