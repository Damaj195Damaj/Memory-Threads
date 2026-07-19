import React from 'react';
import { useGetMemory, useGetRelatedMemories, useDeleteMemory } from '@workspace/api-client-react';
import { useParams, useLocation } from 'wouter';
import { format } from 'date-fns';
import { useInstance } from '@/contexts/InstanceContext';
import { 
  ArrowLeft, Calendar, FileType, HardDrive, Trash2, 
  Users, Building2, MapPin, Target, Hash,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MemoryCard } from '@/components/shared/memory-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { FileTypeIcon } from '@/components/shared/file-type-icon';
import { useToast } from '@/components/ui/use-toast';
import { formatBytes } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function MemoryDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { activeInstanceId } = useInstance();

  const memoryId = id ? parseInt(id, 10) : 0;
  const canFetch = !!activeInstanceId && memoryId > 0;

  const { data: memory, isLoading, error } = useGetMemory(
    memoryId,
    { instanceId: activeInstanceId! },
    { query: { enabled: canFetch, queryKey: ['memory', memoryId, activeInstanceId] } }
  );
  const { data: relatedMemories } = useGetRelatedMemories(
    memoryId,
    { instanceId: activeInstanceId! },
    { query: { enabled: canFetch, queryKey: ['related-memories', memoryId, activeInstanceId] } }
  );
  const deleteMutation = useDeleteMemory();

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8 animate-pulse">
        <div className="h-8 w-24 bg-white/5 rounded-md" />
        <div className="h-64 glass-panel rounded-2xl bg-white/5" />
        <div className="h-96 glass-panel rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (error || !memory) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto text-center mt-20">
        <div className="inline-flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-red-500/10 mb-6">
          <AlertCircle className="h-8 w-8 md:h-10 md:w-10 text-red-500" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold mb-2">Memory Not Found</h2>
        <p className="text-sm md:text-base text-muted-foreground mb-8 px-4">This memory might have been deleted or doesn't exist.</p>
        <Button onClick={() => setLocation('/memories')}>Return to Memories</Button>
      </div>
    );
  }

  const handleDelete = () => {
    if (!activeInstanceId) return;
    deleteMutation.mutate(
      { id: memoryId, params: { instanceId: activeInstanceId } },
      {
        onSuccess: () => {
          toast({ title: "Memory deleted successfully" });
          setLocation('/memories');
        },
        onError: () => {
          toast({ title: "Failed to delete memory", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => window.history.back()} className="hover:bg-white/10 -ml-2 sm:-ml-4 self-start">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <StatusBadge status={memory.status} />
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 shrink-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-panel border-white/10 w-[95vw] sm:w-full">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this memory?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the file and all extracted intelligence.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white">Delete Permanently</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Main Info Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-3xl p-5 md:p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 md:w-96 md:h-96 bg-primary/5 rounded-full blur-[80px] md:blur-[100px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6 relative z-10">
          <div className="h-12 w-12 md:h-16 md:w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <FileTypeIcon type={memory.fileType} className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0 w-full">
            <h1 className="text-xl md:text-3xl font-bold tracking-tight mb-2 text-foreground break-words">
              {memory.title || memory.originalName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground mb-5 md:mb-6">
              <span className="flex items-center gap-1.5"><FileType className="h-3 w-3 md:h-4 md:w-4 shrink-0" /> {memory.fileType.toUpperCase()}</span>
              <span className="flex items-center gap-1.5"><HardDrive className="h-3 w-3 md:h-4 md:w-4 shrink-0" /> {formatBytes(memory.fileSize)}</span>
              <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3 md:h-4 md:w-4 shrink-0" /> {format(new Date(memory.uploadedAt), 'PPP')}</span>
              {memory.confidence && (
                <span className="text-primary font-medium px-2 py-0.5 rounded bg-primary/10 border border-primary/20 w-full sm:w-auto mt-1 sm:mt-0">
                  {Math.round(memory.confidence * 100)}% Extraction Confidence
                </span>
              )}
            </div>

            {memory.summary && (
              <div className="prose prose-sm md:prose-base prose-invert max-w-none text-muted-foreground leading-relaxed bg-white/5 rounded-xl p-4 md:p-5 border border-white/5">
                <p className="m-0 text-foreground/90 break-words">{memory.summary}</p>
              </div>
            )}
            
            {memory.errorMessage && (
              <div className="mt-4 p-3 md:p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs md:text-sm flex gap-2">
                <AlertCircle className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                <p className="break-words">{memory.errorMessage}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Extracted Entities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        <EntitySection title="People Mentioned" icon={Users} items={memory.people} color="blue" />
        <EntitySection title="Organizations" icon={Building2} items={memory.organizations} color="purple" />
        <EntitySection title="Locations" icon={MapPin} items={memory.locations} color="emerald" />
        <EntitySection title="Key Topics" icon={Hash} items={memory.topics} color="primary" />
        <EntitySection title="Dates & Deadlines" icon={Calendar} items={memory.dates} color="amber" />
        <EntitySection title="Tasks & Actions" icon={Target} items={memory.tasks} color="rose" />
      </div>

      {/* Content Preview */}
      {memory.content && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-2xl p-4 md:p-6"
        >
          <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Content Preview</h3>
          <div className="bg-black/40 rounded-xl p-4 md:p-6 max-h-[300px] md:max-h-[400px] overflow-y-auto overflow-x-hidden font-mono text-xs md:text-sm text-muted-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
            {memory.content}
          </div>
        </motion.div>
      )}

      {/* Related Memories */}
      {relatedMemories && relatedMemories.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="pt-6 md:pt-8 border-t border-white/5"
        >
          <h3 className="text-lg md:text-xl font-semibold mb-4 md:mb-6 flex items-center gap-2">
            <Hash className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
            Connected Memories
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {relatedMemories.map(related => (
              <MemoryCard key={related.id} memory={related} hideConfidence />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function EntitySection({ title, icon: Icon, items, color }: any) {
  if (!items || items.length === 0) return null;

  const colorMap: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    primary: 'text-primary bg-primary/10 border-primary/20',
    amber: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    rose: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  };

  const badgeClass = colorMap[color] || colorMap.primary;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel rounded-2xl p-4 md:p-6"
    >
      <div className="flex items-center gap-2 mb-3 md:mb-4 text-foreground">
        <Icon className={`h-4 w-4 md:h-5 md:w-5 shrink-0 ${badgeClass.split(' ')[0]}`} />
        <h3 className="text-sm md:text-base font-medium truncate">{title}</h3>
        <span className="ml-auto text-[10px] md:text-xs bg-white/10 px-2 py-0.5 rounded-full shrink-0">{items.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 md:gap-2">
        {items.map((item: string, i: number) => (
          <span 
            key={i}
            className={`text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5 rounded-md border ${badgeClass} transition-colors hover:bg-opacity-20 break-words max-w-full`}
          >
            {item}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
