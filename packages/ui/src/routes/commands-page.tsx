// Route page for /explore/commands — owns the commands data hook and selection
// state, delegates rendering to the shared EntityList.
import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import { EntityList } from '@/components/entity-list'
import { useCommand, useCommands } from '@/hooks/use-commands'

import type { ItemLocator } from '@/hooks/use-agents'

export function CommandsPage() {
  const location = useLocation()
  const { data, isError } = useCommands()

  const [selectedItemState, setSelectedItemState] = useState<{
    item: ItemLocator
    locationKey: string
  } | null>(null)
  const selectedItem
    = selectedItemState?.locationKey === location.key ? selectedItemState.item : null
  const { data: selectedEntity } = useCommand(selectedItem)

  return (
    <EntityList
      section="commands"
      data={data}
      isError={isError}
      selectedEntity={selectedEntity}
      onSelectItem={item => setSelectedItemState({ item, locationKey: location.key })}
      onBack={() => setSelectedItemState(null)}
    />
  )
}
