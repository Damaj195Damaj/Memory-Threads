import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Brain } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/20 mb-6">
          <Brain className="h-10 w-10 text-primary opacity-50" />
        </div>
        <h1 className="text-4xl font-bold mb-4 glow-text">404 - Lost Memory</h1>
        <p className="text-muted-foreground mb-8">
          The memory sector you're looking for doesn't exist or has been wiped from the index.
        </p>
        <Button asChild>
          <Link href="/">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
