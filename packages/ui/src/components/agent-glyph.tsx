// Map origin / agent_name → lobehub Mono icon.
import Claude from '@lobehub/icons/es/Claude'
import Codex from '@lobehub/icons/es/Codex'
import Grok from '@lobehub/icons/es/Grok'
import Kimi from '@lobehub/icons/es/Kimi'
import OpenCode from '@lobehub/icons/es/OpenCode'
import ZAI from '@lobehub/icons/es/ZAI'

/** Renders the mono brand glyph for a known agent origin. Unknown names render nothing. */
export function AgentGlyph({
  name,
  size = 12,
  className,
}: {
  name: string | null | undefined
  size?: number
  className?: string
}) {
  if (name === 'claude') {
    return <Claude size={size} className={className} />
  }
  if (name === 'opencode') {
    return <OpenCode size={size} className={className} />
  }
  if (name === 'codex') {
    return <Codex size={size} className={className} />
  }
  if (name === 'grok') {
    return <Grok size={size} className={className} />
  }
  if (name === 'kimi') {
    return <Kimi size={size} className={className} />
  }
  if (name === 'zcode') {
    return <ZAI size={size} className={className} />
  }
  return null
}
