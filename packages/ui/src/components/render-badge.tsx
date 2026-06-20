// Renders a backend-supplied RenderBadge (provider-driven, no schema branching in the card).
import { MonoBadge } from './badge'

import type { RenderBadge } from '@ohmyc/shared'

export function RenderBadgeView({ badge }: { badge: RenderBadge }) {
  return <MonoBadge>{badge.label}</MonoBadge>
}
