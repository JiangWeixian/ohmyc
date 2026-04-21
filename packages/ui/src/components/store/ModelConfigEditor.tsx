import { useState, useEffect } from 'react';
import { useStoreModelConfig, useCreateStoreModelConfig, useUpdateStoreModelConfig, useDeleteStoreModelConfig } from '../../hooks/useStore';
import { maskApiKey, isMaskedValue } from '../../utils/maskApiKey';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface ModelConfigEditorProps {
  editName?: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function ModelConfigEditor({ editName, onSaved, onCancel }: ModelConfigEditorProps) {
  const isEdit = !!editName;

  const existingQ = useStoreModelConfig(editName ?? null);

  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [provider, setProvider] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (existingQ.data) {
      setApiKey(maskApiKey(existingQ.data.apiKey));
      setBaseUrl(existingQ.data.baseUrl);
      setModelName(existingQ.data.modelName);
      setProvider(existingQ.data.provider);
    }
  }, [existingQ.data]);

  const createMut = useCreateStoreModelConfig();
  const updateMut = useUpdateStoreModelConfig();
  const deleteMut = useDeleteStoreModelConfig();

  const handleSave = () => {
    setError(null);

    if (isEdit) {
      const body: Record<string, string> = { baseUrl, modelName, provider };
      if (!isMaskedValue(apiKey)) {
        body.apiKey = apiKey;
      }
      updateMut.mutate({ name: editName!, body }, {
        onSuccess: () => onSaved(),
        onError: (e: any) => setError(e.message),
      });
    } else {
      if (!name.trim()) { setError('Name is required'); return; }
      if (!apiKey.trim()) { setError('API Key is required'); return; }
      if (!baseUrl.trim()) { setError('Base URL is required'); return; }
      createMut.mutate({ name, apiKey, baseUrl, modelName: modelName || undefined, provider: provider || undefined }, {
        onSuccess: () => onSaved(),
        onError: (e: any) => setError(e.message),
      });
    }
  };

  const handleDelete = () => {
    deleteMut.mutate({ name: editName!, force: false }, {
      onSuccess: () => onSaved(),
      onError: (err: any) => {
        const refs = err.data?.referencedBy;
        if (refs) {
          setShowDeleteDialog(true);
          setDeleteReferencedBy(refs);
        } else {
          setError(err.message);
        }
      },
    });
  };

  const [deleteReferencedBy, setDeleteReferencedBy] = useState<string[]>([]);

  const handleForceDelete = () => {
    deleteMut.mutate({ name: editName!, force: true }, {
      onSuccess: () => { setShowDeleteDialog(false); onSaved(); },
    });
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          {isEdit ? `Edit ${editName}` : 'New model config'}
        </h2>
        <div className="flex gap-2">
          {isEdit ? (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          ) : null}
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

      {showDeleteDialog ? (
        <DeleteConfirmDialog
          name={editName ?? name}
          referencedBy={deleteReferencedBy}
          onConfirm={handleForceDelete}
          onCancel={() => setShowDeleteDialog(false)}
        />
      ) : null}
    </div>
  );
}
