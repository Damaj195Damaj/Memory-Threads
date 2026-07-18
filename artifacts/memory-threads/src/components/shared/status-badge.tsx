import { cn } from '@/lib/utils';
import { MemoryStatus } from '@workspace/api-client-react';

interface StatusBadgeProps {
  status: MemoryStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border", className, {
      'bg-yellow-500/10 text-yellow-500 border-yellow-500/20': status === 'pending',
      'bg-blue-500/10 text-blue-400 border-blue-500/20': status === 'processing',
      'bg-green-500/10 text-green-400 border-green-500/20': status === 'ready',
      'bg-red-500/10 text-red-500 border-red-500/20': status === 'error',
    })}>
      {status === 'processing' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
        </span>
      )}
      {status === 'pending' && <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />}
      {status === 'ready' && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
      {status === 'error' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
      <span className="capitalize">{status}</span>
    </div>
  );
}
