import { useState, useEffect } from 'react';
import { useStoreModelConfig, useCreateStoreModelConfig, useUpdateStoreModelConfig, useDeleteStoreModelConfig } from '../../hooks/useStore';
import { maskApiKey, isMaskedValue } from '../../utils/maskApiKey';
import { cn } from '@/lib/utils';
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
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMut.isPending}
              className={cn(
                "px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)]",
                "bg-[var(--accent-red)]/10 text-[var(--accent-red)]",
                "hover:bg-[var(--accent-red)]/20",
                "disabled:opacity-50",
                "transition-colors duration-150"
              )}
            >
              {deleteMut.isPending ? 'Deleting...' : 'Delete'}
            </button>
          ) : null}
          <button onClick={onCancel} className={cn(
            "px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)]",
            "bg-[var(--surface-overlay)] text-[var(--text-secondary)]",
            "hover:bg-[var(--border-hover)] hover:text-[var(--text-primary)]",
            "transition-colors duration-150"
          )}>Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className={cn(
            "px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)]",
            "bg-[var(--accent-blue)] text-white",
            "hover:bg-[var(--accent-blue-hover)]",
            "disabled:opacity-50",
            "transition-colors duration-150"
          )}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30 text-[var(--accent-red)] text-[13px] rounded-[var(--radius-md)] px-4 py-2">{error}</div>
      )}

      <div className="grid gap-4">
        {!isEdit && (
          <div>
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Name</label>
            <input aria-label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="my-model-config"
              className="mt-1.5 w-full rounded-[var(--radius-md)] px-3 py-2 text-[13px] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors duration-150" />
          </div>
        )}

        <div>
          <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">API Key</label>
          <input aria-label="API Key" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter API key"
            className="mt-1.5 w-full rounded-[var(--radius-md)] px-3 py-2 text-[13px] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors duration-150" />
        </div>

        <div>
          <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Base URL</label>
          <input aria-label="Base URL" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.example.com"
            className="mt-1.5 w-full rounded-[var(--radius-md)] px-3 py-2 text-[13px] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors duration-150" />
        </div>

        <div>
          <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Model Name (optional)</label>
          <input aria-label="Model Name" value={modelName} onChange={e => setModelName(e.target.value)} placeholder="claude-3-opus"
            className="mt-1.5 w-full rounded-[var(--radius-md)] px-3 py-2 text-[13px] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors duration-150" />
        </div>

        <div>
          <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Provider (optional)</label>
          <input aria-label="Provider" value={provider} onChange={e => setProvider(e.target.value)} placeholder="anthropic"
            className="mt-1.5 w-full rounded-[var(--radius-md)] px-3 py-2 text-[13px] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors duration-150" />
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
