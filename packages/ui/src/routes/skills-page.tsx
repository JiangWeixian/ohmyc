// Route page for /explore/skills — owns the skills data hook and selection
// state, delegates rendering to the shared EntityList.
import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import { EntityList } from '@/components/entity-list'
import { useSkill, useSkills } from '@/hooks/use-skills'

import type { ItemLocator } from '@/hooks/use-agents'

export function SkillsPage() {
  const location = useLocation()
  const { data, isError } = useSkills()

  const [selectedItemState, setSelectedItemState] = useState<{
    item: ItemLocator
    locationKey: string
  } | null>(null)
  const selectedItem
    = selectedItemState?.locationKey === location.key ? selectedItemState.item : null
  const { data: selectedEntity } = useSkill(selectedItem)

  return (
    <EntityList
      section="skills"
      data={data}
      isError={isError}
      selectedEntity={selectedEntity}
      onSelectItem={item => setSelectedItemState({ item, locationKey: location.key })}
      onBack={() => setSelectedItemState(null)}
    />
  )
}
