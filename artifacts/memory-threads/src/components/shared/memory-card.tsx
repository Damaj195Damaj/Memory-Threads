import React from 'react';
import { Memory } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { FileTypeIcon } from './file-type-icon';
import { StatusBadge } from './status-badge';
import { Link } from 'wouter';
import { cn, formatBytes } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar, Users, Hash } from 'lucide-react';

interface MemoryCardProps {
  memory: Memory;
  className?: string;
  onClick?: () => void;
  hideConfidence?: boolean;
}

export function MemoryCard({ memory, className, onClick, hideConfidence = false }: MemoryCardProps) {
  const Component = onClick ? 'div' : Link;
  const props = onClick ? { onClick } : { href: `/memories/${memory.id}` };

  const peopleCount = memory.people?.length || 0;
  const topicCount = memory.topics?.length || 0;

  return (
    <Component
      {...props as any}
      className={cn(
        "group block h-full outline-none glass-panel rounded-xl overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:border-primary/30 hover:-translate-y-1 relative cursor-pointer",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      
      <div className="p-5 h-full flex flex-col relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:bg-primary/10 group-hover:border-primary/20 group-hover:text-primary transition-colors shrink-0">
              <FileTypeIcon type={memory.fileType} className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors" title={memory.title || memory.originalName}>
                {memory.title || memory.originalName}
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="shrink-0">{formatBytes(memory.fileSize)}</span>
                <span>•</span>
                <span className="truncate">{format(new Date(memory.uploadedAt), 'MMM d, yyyy')}</span>
              </div>
            </div>
          </div>
          <StatusBadge status={memory.status} className="shrink-0 ml-2" />
        </div>

        <div className="flex-1">
          <p className="text-sm text-muted-foreground/80 line-clamp-3 leading-relaxed">
            {memory.summary || "No summary available. Processing might still be running or file might be empty."}
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex gap-3">
            {peopleCount > 0 && (
              <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                <Users className="h-3 w-3" /> {peopleCount}
              </span>
            )}
            {topicCount > 0 && (
              <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                <Hash className="h-3 w-3" /> {topicCount}
              </span>
            )}
          </div>
          {!hideConfidence && memory.confidence && (
            <span className="text-primary/70">
              {Math.round(memory.confidence * 100)}% Match
            </span>
          )}
        </div>
      </div>
    </Component>
  );
}

export function MemoryCardSkeleton() {
  return (
    <div className="glass-panel rounded-xl p-5 h-[200px] flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-white/5 shrink-0" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-white/5 rounded" />
            <div className="h-3 w-24 bg-white/5 rounded" />
          </div>
        </div>
        <div className="h-5 w-16 bg-white/5 rounded-full shrink-0" />
      </div>
      <div className="space-y-2 mt-2">
        <div className="h-3 w-full bg-white/5 rounded" />
        <div className="h-3 w-[90%] bg-white/5 rounded" />
        <div className="h-3 w-[70%] bg-white/5 rounded" />
      </div>
      <div className="mt-auto pt-4 border-t border-white/5 flex gap-2">
        <div className="h-6 w-12 bg-white/5 rounded-md" />
        <div className="h-6 w-12 bg-white/5 rounded-md" />
      </div>
    </div>
  );
}
