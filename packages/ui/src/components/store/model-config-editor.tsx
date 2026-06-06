// Model config editor — form for API key, base URL, model name, and provider.
// Handles create, update, and delete-with-force for referenced configs.
import { useEffect, useState } from 'react'

import {
  useCreateStoreModelConfig,
  useDeleteStoreModelConfig,
  useStoreModelConfig,
  useUpdateStoreModelConfig,
} from '../../hooks/use-store'
import { isMaskedValue, maskApiKey } from '../../utils/mask-api-key'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ModelConfigEditorProperties {
  editName?: string
  onSaved: () => void
  onCancel: () => void
}

/**
 * Form editor for model config store items. In edit mode, the API key field
 * is pre-filled with a masked placeholder; only an unmasked value is sent on save.
 * Delete attempts go through a two-phase flow (soft then force) when the config
 * is referenced by profiles.
 */
export function ModelConfigEditor({ editName, onSaved, onCancel }: ModelConfigEditorProperties) {
  const isEdit = !!editName

  const existingQ = useStoreModelConfig(editName ?? null)

  const [name, setName] = useState('')
  const existingData = existingQ.data
  // API key is initialized as masked so the real key never appears in the DOM.
  const [apiKey, setApiKey] = useState(() => existingData ? maskApiKey(existingData.apiKey) : '')
  const [baseUrl, setBaseUrl] = useState(() => existingData?.baseUrl || '')
  const [modelName, setModelName] = useState(() => existingData?.modelName || '')
  const [provider, setProvider] = useState(() => existingData?.provider || '')
  const [error, setError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Reset form when existing data changes
  useEffect(() => {
    if (!existingData) {
      return
    }
    /* eslint-disable react-hooks/set-state-in-effect, react/set-state-in-effect, react-hooks-extra/set-state-in-effect, react-naming-convention/set-state-in-effect */
    setApiKey(previous => (previous === maskApiKey(existingData.apiKey) ? previous : maskApiKey(existingData.apiKey)))
    setBaseUrl(previous => (previous === existingData.baseUrl ? previous : existingData.baseUrl))
    setModelName(previous => (previous === existingData.modelName ? previous : existingData.modelName))
    setProvider(previous => (previous === existingData.provider ? previous : existingData.provider))
    /* eslint-enable react-hooks/set-state-in-effect, react/set-state-in-effect, react-hooks-extra/set-state-in-effect, react-naming-convention/set-state-in-effect */
  }, [existingData])

  const createMut = useCreateStoreModelConfig()
  const updateMut = useUpdateStoreModelConfig()
  const deleteMut = useDeleteStoreModelConfig()

  const handleSave = () => {
    setError(null)

    if (isEdit) {
      // On update, only include apiKey if the user changed it (unmasked it).
      const body: Record<string, string> = { baseUrl, modelName, provider }
      if (!isMaskedValue(apiKey)) {
        body.apiKey = apiKey
      }
      updateMut.mutate({ name: editName!, body }, {
        onSuccess: () => onSaved(),
        onError: (e: any) => setError(e.message),
      })
    } else {
      if (!name.trim()) {
        setError('Name is required')
        return
      }
      if (!apiKey.trim()) {
        setError('API Key is required')
        return
      }
      if (!baseUrl.trim()) {
        setError('Base URL is required')
        return
      }
      createMut.mutate({ name, apiKey, baseUrl, modelName: modelName || undefined, provider: provider || undefined }, {
        onSuccess: () => onSaved(),
        onError: (e: any) => setError(e.message),
      })
    }
  }

  const [deleteReferencedBy, setDeleteReferencedBy] = useState<string[]>([])

  // Two-phase delete: first attempt (force:false) is rejected by the server if
  // the config is referenced; the error payload surfaces the referencing profiles,
  // which opens the confirmation dialog for a force:true retry.
  // Wire shape (post-slice-5): ApiError::ReferencedBy → error.detail.referencedBy.
  // Legacy fetch path: error.data.referencedBy. Read whichever is present.
  const handleDelete = () => {
    deleteMut.mutate({ name: editName!, force: false }, {
      onSuccess: () => onSaved(),
      onError: (error_: any) => {
        const references: string[] | undefined
          = error_?.detail?.referencedBy
            ?? error_?.data?.referencedBy
        if (references && references.length > 0) {
          setShowDeleteDialog(true)
          setDeleteReferencedBy(references)
        } else {
          setError(error_.message)
        }
      },
    })
  }

  const handleForceDelete = () => {
    deleteMut.mutate({ name: editName!, force: true }, {
      onSuccess: () => {
        setShowDeleteDialog(false)
        onSaved()
      },
    })
  }

  const isSaving = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          {isEdit ? `Edit ${editName}` : 'New model config'}
        </h2>
        <div className="flex gap-2">
          {isEdit
            ? (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? 'Deleting...' : 'Delete'}
            </Button>
              )
            : null}
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30 text-[var(--accent-red)] text-[13px] rounded-[var(--radius-md)] px-4 py-2">{error}</div>
      )}

      <div className="grid gap-4">
        {!isEdit && (
          <div className="space-y-2">
            <Label htmlFor="mc-name">Name</Label>
            <Input id="mc-name" value={name} onChange={e => setName(e.target.value)} placeholder="my-model-config" />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="mc-apikey">API Key</Label>
          <Input id="mc-apikey" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter API key" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mc-baseurl">Base URL</Label>
          <Input id="mc-baseurl" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.example.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mc-model">Model Name (optional)</Label>
          <Input id="mc-model" value={modelName} onChange={e => setModelName(e.target.value)} placeholder="claude-3-opus" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mc-provider">Provider (optional)</Label>
          <Input id="mc-provider" value={provider} onChange={e => setProvider(e.target.value)} placeholder="anthropic" />
        </div>
      </div>

      {showDeleteDialog
        ? (
        <DeleteConfirmDialog
          name={editName ?? name}
          referencedBy={deleteReferencedBy}
          onConfirm={handleForceDelete}
          onCancel={() => setShowDeleteDialog(false)}
        />
          )
        : null}
    </div>
  )
}
