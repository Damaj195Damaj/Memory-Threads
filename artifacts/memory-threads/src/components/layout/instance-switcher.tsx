import React, { useState } from 'react';
import { useInstance } from '@/contexts/InstanceContext';
import { useCreateInstance, useUpdateInstance, useDeleteInstance } from '@workspace/api-client-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Check, ChevronsUpDown, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

const PRESET_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function InstanceSwitcher() {
  const { activeInstanceId, activeInstance, instances, setActiveInstanceId } = useInstance();
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const queryClient = useQueryClient();
  const createMutation = useCreateInstance();
  const updateMutation = useUpdateInstance();
  const deleteMutation = useDeleteInstance();

  if (!activeInstance) return null;

  const resetForm = () => {
    setNewName('');
    setNewColor(PRESET_COLORS[0]);
    setIsCreating(false);
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate(
      { data: { name: newName, color: newColor } },
      {
        onSuccess: (newInstance) => {
          queryClient.invalidateQueries({ queryKey: ['instances'] });
          setActiveInstanceId(newInstance.id);
          resetForm();
          setOpen(false);
          toast({ title: 'Workspace created' });
        },
        onError: () => toast({ title: 'Failed to create workspace', variant: 'destructive' })
      }
    );
  };

  const handleUpdate = (id: number) => {
    if (!newName.trim()) return;
    updateMutation.mutate(
      { id, data: { name: newName, color: newColor } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['instances'] });
          resetForm();
          toast({ title: 'Workspace updated' });
        },
        onError: () => toast({ title: 'Failed to update workspace', variant: 'destructive' })
      }
    );
  };

  const handleDelete = (id: number, name: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['instances'] });
          if (activeInstanceId === id) {
            const next = instances.find(i => i.id !== id);
            if (next) setActiveInstanceId(next.id);
          }
          toast({ title: `Workspace ${name} deleted` });
          window.location.reload();
        },
        onError: () => toast({ title: 'Failed to delete workspace', variant: 'destructive' })
      }
    );
  };

  const startEdit = (instance: any) => {
    setEditingId(instance.id);
    setNewName(instance.name);
    setNewColor(instance.color || PRESET_COLORS[0]);
    setIsCreating(false);
  };

  return (
    <Popover open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) resetForm();
    }}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center justify-between w-full px-3 py-2 text-sm text-left rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
        >
          <div className="flex items-center gap-2 truncate">
            <div 
              className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor] shrink-0" 
              style={{ color: activeInstance.color || '#6366f1', backgroundColor: activeInstance.color || '#6366f1' }} 
            />
            <span className="truncate font-medium">{activeInstance.name}</span>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-muted-foreground opacity-50 group-hover:opacity-100 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 glass-panel border-white/10" align="start">
        <div className="space-y-1 mb-2">
          {instances.map((instance) => (
            <div key={instance.id} className="relative group/item">
              {editingId === instance.id ? (
                <div className="p-2 bg-black/20 rounded-md border border-white/5 space-y-2">
                  <Input 
                    autoFocus
                    size={1}
                    className="h-8 text-sm bg-black/40 border-white/10" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                    placeholder="Workspace name"
                  />
                  <div className="flex gap-1 justify-between">
                    <div className="flex gap-1">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setNewColor(c)}
                          className={cn("w-5 h-5 rounded-full transition-transform", newColor === c ? "scale-110 ring-2 ring-white/50" : "hover:scale-110")}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end mt-2">
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={resetForm}>Cancel</Button>
                    <Button size="sm" className="h-6 text-xs px-2" onClick={() => handleUpdate(instance.id)} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setActiveInstanceId(instance.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center w-full gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
                    activeInstanceId === instance.id ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <div 
                    className="w-2 h-2 rounded-full shrink-0" 
                    style={{ backgroundColor: instance.color || '#6366f1', boxShadow: activeInstanceId === instance.id ? `0 0 8px ${instance.color || '#6366f1'}` : 'none' }} 
                  />
                  <span className="truncate flex-1 text-left">{instance.name}</span>
                  {activeInstanceId === instance.id && (
                    <Check className="w-3.5 h-3.5 text-foreground ml-auto shrink-0" />
                  )}
                </button>
              )}

              {/* Actions */}
              {editingId !== instance.id && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md px-1 py-0.5">
                  <button 
                    onClick={(e) => { e.stopPropagation(); startEdit(instance); }}
                    className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  {instances.length > 1 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button 
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-panel border-white/10">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Delete {instance.name} and all its memories? This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-white/5 border-white/10">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(instance.id, instance.name)} className="bg-red-500 hover:bg-red-600 text-white">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {isCreating ? (
          <div className="p-2 bg-black/20 rounded-md border border-white/5 space-y-2 mt-2">
            <Input 
              autoFocus
              size={1}
              className="h-8 text-sm bg-black/40 border-white/10" 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              placeholder="Workspace name"
            />
            <div className="flex gap-1 justify-between">
              <div className="flex gap-1">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={cn("w-5 h-5 rounded-full transition-transform", newColor === c ? "scale-110 ring-2 ring-white/50" : "hover:scale-110")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={resetForm}>Cancel</Button>
              <Button size="sm" className="h-6 text-xs px-2" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create'}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setIsCreating(true);
              setNewName('');
              setNewColor(PRESET_COLORS[0]);
              setEditingId(null);
            }}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md transition-colors mt-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New workspace</span>
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}