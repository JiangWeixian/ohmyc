import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from '../../../test/render-with-providers'
import { ImportComponentsDialog } from '../import-components-dialog'

const previewImport = vi.fn()
const applyImport = vi.fn()

vi.mock('../../../hooks/use-store', () => ({
  useStoreImport: () => ({ previewImport, applyImport, isPending: false }),
}))

describe('ImportComponentsDialog', () => {
  beforeEach(() => {
    previewImport.mockReset()
    applyImport.mockReset()
  })

  it('previews conflicts, allows cancel, and issues overwrite all on confirmation', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    previewImport.mockResolvedValue({
      imported: 0,
      skipped: 1,
      overwritten: 0,
      errors: [],
      conflicts: [
        {
          type: 'agents',
          id: 'reviewer',
          sourcePath: '/tmp/.claude/agents/reviewer.md',
          destinationPath: '/store/agents/reviewer.md',
        },
      ],
    })
    applyImport.mockResolvedValue({
      imported: 1,
      skipped: 0,
      overwritten: 1,
      errors: [],
      conflicts: [],
    })

    const firstRender = renderWithProviders(<ImportComponentsDialog onClose={onClose} />)

    await user.type(screen.getByLabelText('Source directory'), '/tmp/.claude')
    await user.click(screen.getByRole('button', { name: 'Import Components' }))

    await waitFor(() => {
      expect(previewImport).toHaveBeenCalledWith('/tmp/.claude')
    })
    expect(await screen.findByText('Overwrite existing components?')).toBeInTheDocument()
    expect(screen.getByText('reviewer')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(applyImport).not.toHaveBeenCalled()
    firstRender.unmount()

    renderWithProviders(<ImportComponentsDialog onClose={onClose} />)
    await user.type(screen.getByLabelText('Source directory'), '/tmp/.claude')
    await user.click(screen.getByRole('button', { name: 'Import Components' }))
    await screen.findByText('Overwrite existing components?')
    await user.click(screen.getByRole('button', { name: 'Overwrite All' }))

    await waitFor(() => {
      expect(applyImport).toHaveBeenLastCalledWith('/tmp/.claude', true)
    })
  })
})
