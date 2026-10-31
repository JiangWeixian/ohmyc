// Map quota provider id → lobehub Mono brand glyph. Same icon family as
// agent-glyph.tsx (claude/codex/opencode), extended to all eight providers.
import Claude from '@lobehub/icons/es/Claude'
import Codex from '@lobehub/icons/es/Codex'
import Cursor from '@lobehub/icons/es/Cursor'
import Gemini from '@lobehub/icons/es/Gemini'
import Grok from '@lobehub/icons/es/Grok'
import Kimi from '@lobehub/icons/es/Kimi'
import OpenCode from '@lobehub/icons/es/OpenCode'
import Zhipu from '@lobehub/icons/es/Zhipu'

import type { QuotaProviderId } from '@/hooks/use-quota'

const GLYPHS = {
  claude: Claude,
  codex: Codex,
  cursor: Cursor,
  gemini: Gemini,
  grok: Grok,
  kimi: Kimi,
  opencodeGo: OpenCode,
  glm: Zhipu,
} as const

export function ProviderGlyph({ id, size = 18, className }: { id: QuotaProviderId; size?: number; className?: string }) {
  const Glyph = GLYPHS[id]
  return <Glyph size={size} className={className} />
}
