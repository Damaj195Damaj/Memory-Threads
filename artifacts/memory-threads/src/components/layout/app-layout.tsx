import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Brain, 
  Search, 
  Upload as UploadIcon, 
  MessageSquare, 
  LayoutDashboard, 
  Library,
  Network,
  Clock,
  Shield,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { InstanceSwitcher } from './instance-switcher';
import { useAuth } from '@/contexts/AuthContext';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
    { icon: Library, label: 'Memories', href: '/memories' },
    { icon: UploadIcon, label: 'Upload', href: '/upload' },
    { icon: Search, label: 'Search', href: '/search' },
    { icon: MessageSquare, label: 'Ask AI', href: '/ask' },
    { icon: Clock, label: 'Timeline', href: '/timeline' },
    { icon: Network, label: 'Graph', href: '/graph' },
  ];

  const SidebarContent = () => (
    <>
      <div className="p-6 pb-2">
        <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 select-none mb-6">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(var(--primary)/0.3)] shrink-0">
            <Brain className="h-4 w-4 text-primary glow-text" />
          </div>
          <span className="font-semibold tracking-wide text-foreground truncate">Memory Threads</span>
        </Link>
        <InstanceSwitcher />
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto mt-4">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative select-none",
                isActive 
                  ? "text-primary font-medium" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20"
                  initial={false}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <item.icon className={cn("h-4 w-4 relative z-10 transition-colors shrink-0", isActive ? "text-primary" : "group-hover:text-foreground")} />
              <span className="relative z-10 text-sm truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 space-y-4 shrink-0">
        <div className="rounded-lg bg-white/5 p-4 border border-white/10 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-start gap-3 relative z-10">
            <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Private & Secure</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">Your files stay in your workspace, only used to answer your queries.</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white/5 p-4 border border-white/10 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Engine Active</p>
              <p className="text-xs text-muted-foreground mt-0.5">All systems nominal</p>
            </div>
          </div>
        </div>

        {user && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">{user.email}</span>
            <button
              onClick={() => logout()}
              title="Sign out"
              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <div className="noise-overlay" />
      
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-white/5 bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 z-40">
        <Link href="/" className="flex items-center gap-3 select-none">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(var(--primary)/0.3)] shrink-0">
            <Brain className="h-4 w-4 text-primary glow-text" />
          </div>
          <span className="font-semibold tracking-wide text-foreground truncate">Memory Threads</span>
        </Link>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 -mr-2 rounded-lg hover:bg-white/5 text-foreground"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-white/5 bg-background/50 backdrop-blur-xl flex-col relative z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed inset-y-0 left-0 w-72 border-r border-white/5 bg-background shadow-2xl flex flex-col z-50 md:hidden"
            >
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col min-w-0 bg-grid-pattern pt-16 md:pt-0">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background pointer-events-none" />
        <div className="flex-1 relative z-10 overflow-y-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
