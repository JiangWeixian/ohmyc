// Route page for /explore/agents — owns the agents data hook and selection
// state, delegates rendering to the shared EntityList.
import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import { EntityList } from '@/components/entity-list'
import {
  type ItemLocator,
  useAgent,
  useAgents,
} from '@/hooks/use-agents'

export function AgentsPage() {
  const location = useLocation()
  const { data, isError } = useAgents()

  const [selectedItemState, setSelectedItemState] = useState<{
    item: ItemLocator
    locationKey: string
  } | null>(null)
  const selectedItem
    = selectedItemState?.locationKey === location.key ? selectedItemState.item : null
  const { data: selectedEntity } = useAgent(selectedItem)

  return (
    <EntityList
      section="agents"
      data={data}
      isError={isError}
      selectedEntity={selectedEntity}
      onSelectItem={item => setSelectedItemState({ item, locationKey: location.key })}
      onBack={() => setSelectedItemState(null)}
    />
  )
}
