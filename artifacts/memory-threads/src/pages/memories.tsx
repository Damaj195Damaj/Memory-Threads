import React, { useState, useEffect } from 'react';
import { useListMemories, useGetFilters } from '@workspace/api-client-react';
import { MemoryCard, MemoryCardSkeleton } from '@/components/shared/memory-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Search, Filter, SlidersHorizontal, Loader2, X, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

export default function Memories() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<{
    fileType?: string;
    people?: string;
    topics?: string;
  }>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: filterData } = useGetFilters();
  const { data: memoryData, isLoading } = useListMemories({
    q: debouncedQuery || undefined,
    ...activeFilters,
  });

  const toggleFilter = (key: 'fileType' | 'people' | 'topics', value: string) => {
    setActiveFilters(prev => ({
      ...prev,
      [key]: prev[key] === value ? undefined : value
    }));
  };

  const clearFilters = () => setActiveFilters({});

  const hasActiveFilters = Object.values(activeFilters).some(v => v !== undefined);

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden relative">
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <div className="p-4 md:p-6 border-b border-white/5 bg-background/80 backdrop-blur-sm z-10 shrink-0">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 max-w-full">
            <div className="relative w-full sm:flex-1 max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search memories..." 
                className="pl-10 bg-white/5 border-white/10 h-10 sm:h-12 rounded-xl text-sm sm:text-base focus-visible:ring-primary/50 w-full"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              className={`h-10 sm:h-12 px-4 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 w-full sm:w-auto shrink-0 ${hasActiveFilters ? 'text-primary border-primary/50' : ''}`}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 flex h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
          </div>
          
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
              >
                <span className="text-xs text-muted-foreground shrink-0">Active:</span>
                {Object.entries(activeFilters).map(([key, value]) => {
                  if (!value) return null;
                  return (
                    <Badge key={key} variant="secondary" className="shrink-0 bg-primary/20 text-primary hover:bg-primary/30 border-primary/20 flex items-center gap-1 py-1 px-2.5">
                      <span className="truncate max-w-[100px]">{value}</span>
                      <button onClick={() => toggleFilter(key as any, value)} className="ml-1 rounded-full hover:bg-primary/40 p-0.5 shrink-0">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                <button onClick={clearFilters} className="shrink-0 text-xs text-muted-foreground hover:text-foreground ml-2 transition-colors whitespace-nowrap">
                  Clear all
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <MemoryCardSkeleton key={i} />)}
            </div>
          ) : memoryData?.memories && memoryData.memories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {memoryData.memories.map((memory, i) => (
                <motion.div
                  key={memory.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.5) }}
                  className="h-full"
                >
                  <MemoryCard memory={memory} hideConfidence />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center pt-10">
              <EmptyState 
                title="No memories found" 
                description={hasActiveFilters || debouncedQuery 
                  ? "We couldn't find any memories matching your current filters and search query." 
                  : "You haven't uploaded any files yet. Every file you upload becomes a searchable memory."}
                actionLabel={hasActiveFilters || debouncedQuery ? "Clear filters" : "Upload your first file"}
                actionOnClick={hasActiveFilters || debouncedQuery ? clearFilters : undefined}
                actionHref={!(hasActiveFilters || debouncedQuery) ? "/upload" : undefined}
              />
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Filters */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Mobile overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 md:hidden"
            />
            {/* Sidebar content */}
            <motion.div 
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-[300px] border-l border-white/5 bg-background/95 backdrop-blur-xl flex flex-col flex-shrink-0 z-30 md:relative md:max-w-none md:w-[320px] md:translate-x-0"
              style={{ x: 0 }} // Override framer-motion x on desktop if needed, though AnimatePresence handles it
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" />
                  Refine View
                </h3>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-8">
                {filterData && (
                  <>
                    <FilterSection 
                      title="File Types" 
                      items={filterData.fileTypes} 
                      activeItem={activeFilters.fileType}
                      onSelect={(val) => toggleFilter('fileType', val)}
                    />
                    <FilterSection 
                      title="People Mentioned" 
                      items={filterData.people} 
                      activeItem={activeFilters.people}
                      onSelect={(val) => toggleFilter('people', val)}
                    />
                    <FilterSection 
                      title="Topics" 
                      items={filterData.topics} 
                      activeItem={activeFilters.topics}
                      onSelect={(val) => toggleFilter('topics', val)}
                    />
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterSection({ title, items, activeItem, onSelect }: { title: string, items: string[], activeItem?: string, onSelect: (val: string) => void }) {
  if (!items || items.length === 0) return null;
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {items.map(item => {
          const isActive = activeItem === item;
          return (
            <button
              key={item}
              onClick={() => onSelect(item)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors border ${
                isActive 
                  ? 'bg-primary/20 text-primary border-primary/30' 
                  : 'bg-white/5 text-muted-foreground border-white/5 hover:bg-white/10 hover:text-foreground'
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}
