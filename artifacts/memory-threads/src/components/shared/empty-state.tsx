import React from 'react';
import { cn } from '@/lib/utils';
import { Brain, FileType, Search, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ElementType;
  actionLabel?: string;
  actionHref?: string;
  actionOnClick?: () => void;
  className?: string;
}

export function EmptyState({ 
  title, 
  description, 
  icon: Icon = Database, 
  actionLabel, 
  actionHref,
  actionOnClick,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center p-12 h-full min-h-[400px] glass-panel rounded-2xl", className)}>
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
        <div className="h-20 w-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative z-10 shadow-2xl">
          <Icon className="h-10 w-10 text-primary/70" />
        </div>
      </div>
      
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
        {description}
      </p>
      
      {(actionLabel && actionHref) ? (
        <Button asChild className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : (actionLabel && actionOnClick) ? (
        <Button onClick={actionOnClick} className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
