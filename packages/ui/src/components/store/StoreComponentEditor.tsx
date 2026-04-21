import { useState, useEffect } from 'react';
import {
  useStoreAgent, useCreateStoreAgent, useUpdateStoreAgent,
  useStoreSkill, useCreateStoreSkill, useUpdateStoreSkill,
  useStoreCommand, useCreateStoreCommand, useUpdateStoreCommand,
} from '../../hooks/useStore';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { ModelConfigEditor } from './ModelConfigEditor';

interface StoreComponentEditorProps {
  category: 'agents' | 'skills' | 'commands' | 'model-configs';
  editName?: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function StoreComponentEditor({ category, editName, onSaved, onCancel }: StoreComponentEditorProps) {
  if (category === 'model-configs') {
    return <ModelConfigEditor editName={editName} onSaved={onSaved} onCancel={onCancel} />;
  }

  const isEdit = !!editName;

  const agentQ = useStoreAgent(category === 'agents' ? (editName ?? null) : null);
  const skillQ = useStoreSkill(category === 'skills' ? (editName ?? null) : null);
  const commandQ = useStoreCommand(category === 'commands' ? (editName ?? null) : null);

  const existing = category === 'agents' ? agentQ.data : category === 'skills' ? skillQ.data : commandQ.data;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.frontmatter.name || existing.id);
      setDescription(existing.frontmatter.description || '');
      setContent(existing.content);
    }
  }, [existing]);

  const createAgent = useCreateStoreAgent();
  const updateAgent = useUpdateStoreAgent();
  const createSkill = useCreateStoreSkill();
  const updateSkill = useUpdateStoreSkill();
  const createCommand = useCreateStoreCommand();
  const updateCommand = useUpdateStoreCommand();

  const handleSave = () => {
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }

    const frontmatter: any = { name, description: description || undefined };
    const onSuccess = () => onSaved();
    const onError = (e: any) => setError(e.message);

    if (category === 'agents') {
      if (!description.trim()) { setError('Description is required for agents'); return; }
      if (isEdit) {
        updateAgent.mutate({ name: editName!, body: { frontmatter, content } }, { onSuccess, onError });
      } else {
        createAgent.mutate({ frontmatter, content }, { onSuccess, onError });
      }
    } else if (category === 'skills') {
      if (isEdit) {
        updateSkill.mutate({ name: editName!, body: { frontmatter, content } }, { onSuccess, onError });
      } else {
        createSkill.mutate({ frontmatter, content }, { onSuccess, onError });
      }
    } else {
      if (isEdit) {
        updateCommand.mutate({ name: editName!, body: { frontmatter, content } }, { onSuccess, onError });
      } else {
        createCommand.mutate({ frontmatter, content }, { onSuccess, onError });
      }
    }
  };

  const isSaving = [createAgent, updateAgent, createSkill, updateSkill, createCommand, updateCommand].some(m => m.isPending);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          {isEdit ? `Edit ${editName}` : `New ${category.slice(0, -1)}`}
        </h2>
        <div className="flex gap-2">
          {isEdit ? (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
              Delete
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
            <Label htmlFor="component-name">Name</Label>
            <Input id="component-name" value={name} onChange={e => setName(e.target.value)} placeholder="my-component" />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="component-desc">Description</Label>
          <Input id="component-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="What this component does..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="component-content">Content (Markdown)</Label>
          <Textarea id="component-content" value={content} onChange={e => setContent(e.target.value)}
            rows={16} placeholder="System prompt or skill content..." className="font-mono resize-y" />
        </div>
      </div>

      {showDeleteDialog ? (
        <DeleteConfirmDialog
          name={editName ?? name}
          referencedBy={[]}
          onConfirm={() => setShowDeleteDialog(false)}
          onCancel={() => setShowDeleteDialog(false)}
        />
      ) : null}
    </div>
  );
}
