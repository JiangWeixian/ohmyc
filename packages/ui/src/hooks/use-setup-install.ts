// One-click plugin install for the onboarding gate. Mirrors
// `ohmyc_core::install` on the wire; see crates/ohmyc-core/src/install.rs.
//
// Kept separate from useSetupStatus because the two answer different questions:
// status asks whether the monitor store exists, this asks what we can set up.
// Installing does not make the store appear — the plugin creates it on the next
// session — so the gate must not treat a successful install as "ready".
import { useMutation, useQuery } from '@tanstack/react-query'

import { request } from '@/lib/transport'

export type AgentKind = 'claude' | 'codex' | 'opencode'

/** Tagged union mirroring `ohmyc_core::install::InstallOutcome`. */
export type InstallOutcome
  = | { state: 'already_installed' }
    | { state: 'failed'; reason: string }
    | { state: 'installed' }
    | { state: 'manual'; hint: string }
    | { state: 'not_present' }

/** `AgentInstallResult` — the outcome is flattened onto the agent on the wire. */
export type AgentInstallResult = InstallOutcome & { agent: AgentKind }

export interface AgentStatus {
  agent: AgentKind
  /** The agent's home directory exists on this machine. */
  present: boolean
  /** The plugin is already registered for this agent. */
  installed: boolean
  /** We can finish this one without the user leaving the app. */
  automatic: boolean
}

export const AGENT_LABELS: Record<AgentKind, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  opencode: 'OpenCode',
}

/** Agents we should install for by default: present, ours to do, not yet done. */
export function installableAgents(agents: AgentStatus[] | undefined): AgentKind[] {
  return (agents ?? [])
    .filter(a => a.present && a.automatic && !a.installed)
    .map(a => a.agent)
}

/** True when the install left at least one agent connected. */
export function anyInstalled(results: AgentInstallResult[] | undefined): boolean {
  return (results ?? []).some(r => r.state === 'installed' || r.state === 'already_installed')
}

/** Which agents are present on this machine and what we can do for each. */
export function useDetectAgents() {
  return useQuery({
    queryKey: ['setup', 'agents'],
    queryFn: async () => request<AgentStatus[]>('setup.detect_agents', {}),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  })
}

/** Registers the bundled plugin. Resolves with one result per requested agent. */
export function useSetupInstall() {
  return useMutation({
    mutationFn: async (agents: AgentKind[]) =>
      request<AgentInstallResult[]>('setup.install', { agents }),
  })
}
