# Design Spec: .claude Explorer

## Overview
The **.claude Explorer** is a visual interface for managing and exploring the `.claude` configuration of a project. It provides a developer-focused, high-performance environment for inspecting settings, agent configurations, and MCP server statuses.

---

## 1. Layout Structure

### 1.1 Sidebar (Navigation)
- **Width**: 256px (fixed on desktop, collapsible to 64px on mobile/tablet).
- **Background**: Zinc-950/50 with `backdrop-blur-xl`.
- **Primary Sections**:
  - **Configuration**: `settings.json`, `CLAUDE.md`, Hooks, MCP Servers.
  - **Tooling**: Commands, Agents, Skills, Plugins.
- **Footer**: CLI connection status indicator with pulse animation.

### 1.2 Main Content Area
- **Header**: Sticky h-16 bar with breadcrumb navigation and global search.
- **Background**: Deep Zinc-900 (`#09090b`) with subtle radial gradients (Blue/Purple) at the corners for depth.
- **Max Width**: 6xl (1152px) for content readability.

### 1.3 View Modes
- **Grid View**: Default for Agents, Skills, and Plugins. Uses 1, 2, or 3 column layout depending on screen size.
- **Detail View**: Full-width markdown rendering for agent/skill specifics.
- **List View**: Default for MCP Servers and Hooks for high information density.

---

## 2. Visual System

### 2.1 Color Palette
- **Primary**: Blue-600 (`#2563eb`) - Used for active states, primary buttons, and branding.
- **Background**: Zinc-950 (`#09090b`) - Primary dark surface.
- **Surface**: Zinc-900 (`#18181b`) - Used for cards and secondary panels.
- **Border**: Zinc-800 (`#27272a`) - Standard subtle separator.
- **Text (Primary)**: Zinc-100 (`#f4f4f5`) - High legibility.
- **Text (Secondary)**: Zinc-400 (`#a1a1aa`) - Metadata and descriptions.
- **Accents**: 
  - Emerald-500: Success / Online.
  - Amber-500: Warning / Pending.
  - Rose-500: Error / Offline.

### 2.2 Typography
- **Primary Font**: Inter (San-serif) - Interface and UI copy.
- **Monospace Font**: JetBrains Mono / Fira Code - Configuration values, file paths, and code snippets.
- **Scale**:
  - H1: 36px / 2.25rem (Bold)
  - H2: 24px / 1.5rem (Semibold)
  - Body: 14px / 0.875rem (Regular)
  - Meta/Detail: 12px / 0.75rem (Medium)

### 2.3 Spacing & Borders
- **Base Unit**: 4px.
- **Standard Padding**: 16px (p-4), 24px (p-6), 32px (p-8).
- **Border Radius**: 
  - Cards/Panels: 12px (rounded-xl).
  - Main Detail Container: 16px (rounded-2xl).
  - Buttons/Inputs: 8px (rounded-lg).

---

## 3. Interaction & States

### 3.1 Hover States
- **Sidebar**: Zinc-800 background transition (200ms).
- **Agent Cards**: Subtle scale transform (1.02x) + border glow + reveal "View Details" button.
- **Buttons**: Increase background opacity or shift color hue by 10%.

### 3.2 Active States
- **Sidebar**: Blue-600/20 background with Blue-500/30 border and Blue-400 text color.
- **Input Focus**: Blue-500/50 border with subtle ring glow.

### 3.3 Transitions
- **Page Entry**: `animate-in fade-in slide-in-from-bottom-2` (duration: 500ms).
- **Detail Panel**: `animate-in fade-in slide-in-from-right-4` (duration: 300ms).
- **Back Navigation**: `fade-out slide-out-to-left-4` (duration: 200ms).
- **Layout Shift**: Expressive and fluid using `framer-motion` for shared element transitions when selecting cards.

---

## 4. Components

### 4.1 Agent Card
- Icon container (Zinc-800) with hover color shift.
- Title (Semibold, Zinc-100).
- Description (Regular, Zinc-400, max 3 lines).
- Metadata footer (Optional: status, type, version).

### 4.2 Markdown Detail Panel
- Focus on typography and vertical rhythm.
- Divider lines (`border-zinc-800`) between sections.
- Code blocks with syntax highlighting (standard dark theme).
- Sticky "Back" button for easy navigation.

---

## 5. Visual Aesthetic
- **Core Principle**: "Dark Studio" - High-end, professional, and visually quiet to reduce fatigue during long development sessions.
- **Accents**: Minimal use of vibrant colors, reserved only for meaningful state changes or primary actions.
- **Depth**: Heavy use of layering (`z-index`) and backdrop filters (`blur-md`, `blur-xl`) to create a sense of workspace hierarchy.
