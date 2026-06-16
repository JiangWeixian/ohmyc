import {
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from '../../test/render-with-providers'
import { ModelConfigEditor } from '@/components/store/model-config-editor'

const createMutate = vi.fn()
const updateMutate = vi.fn()
const deleteMutate = vi.fn()
const existingConfig = {
  name: 'anthropic',
  apiKey: 'sk-ant-secret-value',
  baseUrl: 'https://api.anthropic.com',
  modelName: 'claude-opus',
  provider: 'anthropic',
}

vi.mock('@/hooks/use-store', () => ({
  useStoreModelConfig: (name: string | null) => ({
    data: name === 'anthropic' ? existingConfig : null,
  }),
  useCreateStoreModelConfig: () => ({ mutate: createMutate, isPending: false }),
  useUpdateStoreModelConfig: () => ({ mutate: updateMutate, isPending: false }),
  useDeleteStoreModelConfig: () => ({ mutate: deleteMutate, isPending: false }),
}))

describe('ModelConfigEditor', () => {
  beforeEach(() => {
    createMutate.mockReset()
    updateMutate.mockReset()
    deleteMutate.mockReset()
  })

  it('validates required fields before creating a model config', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ModelConfigEditor onSaved={vi.fn()} onCancel={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Name is required')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Name'), 'anthropic')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('API Key is required')).toBeInTheDocument()

    await user.type(screen.getByLabelText('API Key'), 'sk-new')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Base URL is required')).toBeInTheDocument()
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('creates a model config and calls onSaved after success', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    createMutate.mockImplementation((_body, options) => options.onSuccess())

    renderWithProviders(<ModelConfigEditor onSaved={onSaved} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText('Name'), 'anthropic')
    await user.type(screen.getByLabelText('API Key'), 'sk-new')
    await user.type(screen.getByLabelText('Base URL'), 'https://api.example.com')
    await user.type(screen.getByLabelText('Model Name (optional)'), 'claude-sonnet')
    await user.type(screen.getByLabelText('Provider (optional)'), 'anthropic')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(createMutate).toHaveBeenCalledWith(
      {
        name: 'anthropic',
        apiKey: 'sk-new',
        baseUrl: 'https://api.example.com',
        modelName: 'claude-sonnet',
        provider: 'anthropic',
      },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    )
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('updates existing configs without resending an unchanged masked api key', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    updateMutate.mockImplementation((_body, options) => options.onSuccess())

    renderWithProviders(<ModelConfigEditor editName="anthropic" onSaved={onSaved} onCancel={vi.fn()} />)

    expect(await screen.findByDisplayValue('https://api.anthropic.com')).toBeInTheDocument()
    const apiKey = screen.getByLabelText('API Key') as HTMLInputElement
    expect(apiKey.value).not.toBe(existingConfig.apiKey)

    await user.clear(screen.getByLabelText('Base URL'))
    await user.type(screen.getByLabelText('Base URL'), 'https://api.changed.example.com')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateMutate).toHaveBeenCalledWith(
      {
        name: 'anthropic',
        body: {
          baseUrl: 'https://api.changed.example.com',
          modelName: 'claude-opus',
          provider: 'anthropic',
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    )
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('sends a changed api key and surfaces mutation errors', async () => {
    const user = userEvent.setup()
    updateMutate.mockImplementation((_body, options) => options.onError(new Error('network down')))

    renderWithProviders(<ModelConfigEditor editName="anthropic" onSaved={vi.fn()} onCancel={vi.fn()} />)

    const apiKey = await screen.findByLabelText('API Key')
    await user.clear(apiKey)
    await user.type(apiKey, 'sk-replacement')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ apiKey: 'sk-replacement' }),
      }),
      expect.objectContaining({ onError: expect.any(Function) }),
    )
    expect(await screen.findByText('network down')).toBeInTheDocument()
  })

  it('confirms deletes, cancels the dialog, and deletes on confirmation', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    deleteMutate.mockImplementation((_body, options) => options.onSuccess())

    renderWithProviders(<ModelConfigEditor editName="anthropic" onSaved={onSaved} onCancel={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete this store component?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByText('Delete this store component?')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Delete this store component?')).toBeInTheDocument()
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    fireEvent.click(deleteButtons.at(-1))

    expect(deleteMutate).toHaveBeenCalledWith(
      { name: 'anthropic' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    )
    expect(onSaved).toHaveBeenCalledTimes(1)
  })
})
