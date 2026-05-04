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

import { renderWithProviders } from '../../test/render-with-providers'
import { StoreComponentEditor } from '@/components/store/store-component-editor'

vi.mock('@/components/markdown-editor', () => ({
  MarkdownEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="markdown-editor"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  ),
}))

const createAgentMutate = vi.fn()
const updateAgentMutate = vi.fn()
const existingAgent = {
  id: 'existing-agent',
  frontmatter: { name: 'existing-agent', description: 'Existing description' },
  content: 'Existing content',
  raw: '---\nname: existing-agent\ndescription: Existing description\n---\n\nExisting content',
}

vi.mock('@/hooks/use-store', () => ({
  useStoreAgent: (name: string | null) => ({
    data: name === 'existing-agent' ? existingAgent : null,
  }),
  useStoreSkill: () => ({ data: null }),
  useStoreCommand: () => ({ data: null }),
  useCreateStoreAgent: () => ({ mutate: createAgentMutate, isPending: false }),
  useUpdateStoreAgent: () => ({ mutate: updateAgentMutate, isPending: false }),
  useCreateStoreSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateStoreSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateStoreCommand: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateStoreCommand: () => ({ mutate: vi.fn(), isPending: false }),
}))

describe('StoreComponentEditor (markdown-doc mode)', () => {
  beforeEach(() => {
    createAgentMutate.mockReset()
    updateAgentMutate.mockReset()
  })

  it('renders the markdown editor with a scaffold for new agents', () => {
    renderWithProviders(
      <StoreComponentEditor
        category="agents"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const editor = screen.getByTestId('markdown-editor') as HTMLTextAreaElement
    expect(editor.value).toContain('---')
    expect(editor.value).toContain('name:')
    expect(editor.value).toContain('description:')
    expect(screen.getByLabelText('Filename')).toBeInTheDocument()
  })

  it('disables save until the doc parses and required keys are present', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <StoreComponentEditor
        category="agents"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const save = screen.getByRole('button', { name: /Save/ })
    expect(save).toBeDisabled()

    const editor = screen.getByTestId('markdown-editor') as HTMLTextAreaElement
    await user.clear(editor)
    await user.type(editor,
      '---\nname: fresh-agent\ndescription: Creates a new thing\n---\n\nSystem prompt')

    await waitFor(() => expect(screen.getByRole('button', { name: /Save/ })).toBeEnabled())

    await user.click(screen.getByRole('button', { name: /Save/ }))

    expect(createAgentMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        frontmatter: expect.objectContaining({ name: 'fresh-agent', description: 'Creates a new thing' }),
        content: expect.stringContaining('System prompt'),
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
  })

  it('hydrates the buffer from existing.raw and saves updates', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <StoreComponentEditor
        category="agents"
        editName="existing-agent"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const editor = await screen.findByTestId('markdown-editor') as HTMLTextAreaElement
    await waitFor(() => expect(editor.value).toContain('Existing description'))

    await user.clear(editor)
    await user.type(editor,
      '---\nname: existing-agent\ndescription: Updated description\n---\n\nExisting content')

    await waitFor(() => expect(screen.getByRole('button', { name: /Save/ })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: /Save/ }))

    expect(updateAgentMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'existing-agent',
        body: expect.objectContaining({
          frontmatter: expect.objectContaining({
            name: 'existing-agent',
            description: 'Updated description',
          }),
          content: expect.stringContaining('Existing content'),
        }),
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete this store component?')).toBeInTheDocument()
  })

  it('surfaces a parse error and keeps save disabled when frontmatter is malformed', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <StoreComponentEditor
        category="agents"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const editor = screen.getByTestId('markdown-editor') as HTMLTextAreaElement
    await user.clear(editor)
    await user.type(editor, '---\nname: broken\n\nbody without close')

    expect(screen.getByText(/frontmatter invalid/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled()
  })
})
