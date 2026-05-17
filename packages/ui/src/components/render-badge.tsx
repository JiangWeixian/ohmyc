// Renders a backend-supplied RenderBadge (provider-driven, no schema branching in the card).
import { Badge, MonoBadge } from './badge'

import type { RenderBadge } from '@ohmyc/shared'

export function RenderBadgeView({ badge }: { badge: RenderBadge }) {
  if (badge.kind === 'mono') {
    return <MonoBadge>{badge.label}</MonoBadge>
  }
  return <Badge variant="default">{badge.label}</Badge>
}
