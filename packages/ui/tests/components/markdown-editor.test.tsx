import { screen, waitFor } from '@testing-library/react'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { ohmycContainerTheme } from '@/components/codemirror-container-theme'
import { MarkdownEditor } from '@/components/markdown-editor'

describe('MarkdownEditor', () => {
  it('creates a CodeMirror editor, renders the initial value, and syncs external changes', async () => {
    const onChange = vi.fn()
    const { rerender, unmount } = renderWithProviders(
      <MarkdownEditor value="# Title" onChange={onChange} placeholder="Write markdown" />,
    )

    expect(screen.getByTestId('markdown-editor')).toBeInTheDocument()
    await waitFor(() => expect(document.body.textContent).toContain('Title'))

    rerender(<MarkdownEditor value="# Updated" onChange={onChange} placeholder="Write markdown" />)
    await waitFor(() => expect(document.body.textContent).toContain('Updated'))

    unmount()
    expect(screen.queryByTestId('markdown-editor')).not.toBeInTheDocument()
  })

  it('exports the shared OhMyC CodeMirror container theme extension', () => {
    expect(ohmycContainerTheme).toBeDefined()
  })
})
