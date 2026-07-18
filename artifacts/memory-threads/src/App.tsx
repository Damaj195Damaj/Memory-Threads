import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { useEffect } from 'react';

// Pages
import Dashboard from '@/pages/dashboard';
import Memories from '@/pages/memories';
import MemoryDetail from '@/pages/memory-detail';
import Upload from '@/pages/upload';
import Search from '@/pages/search';
import Ask from '@/pages/ask';
import Timeline from '@/pages/timeline';
import Graph from '@/pages/graph';

// Layout
import AppLayout from '@/components/layout/app-layout';

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/memories" component={Memories} />
        <Route path="/memories/:id" component={MemoryDetail} />
        <Route path="/upload" component={Upload} />
        <Route path="/search" component={Search} />
        <Route path="/ask" component={Ask} />
        <Route path="/timeline" component={Timeline} />
        <Route path="/graph" component={Graph} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  // Always enforce dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
