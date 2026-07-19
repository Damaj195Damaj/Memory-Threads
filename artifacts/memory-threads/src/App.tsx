import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { useEffect } from 'react';
import { InstanceProvider } from '@/contexts/InstanceContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Pages
import Dashboard from '@/pages/dashboard';
import Memories from '@/pages/memories';
import MemoryDetail from '@/pages/memory-detail';
import Upload from '@/pages/upload';
import Search from '@/pages/search';
import Ask from '@/pages/ask';
import Timeline from '@/pages/timeline';
import Graph from '@/pages/graph';
import Login from '@/pages/login';
import Register from '@/pages/register';

// Layout
import AppLayout from '@/components/layout/app-layout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry 401s — user needs to log in
        if ((error as { status?: number })?.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});

function AuthenticatedApp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route><Redirect to="/login" /></Route>
      </Switch>
    );
  }

  return (
    <InstanceProvider>
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
          <Route path="/login"><Redirect to="/" /></Route>
          <Route path="/register"><Redirect to="/" /></Route>
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </InstanceProvider>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AuthenticatedApp />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
