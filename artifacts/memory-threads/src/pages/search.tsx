import React, { useState } from 'react';
import { useSearchMemories } from '@workspace/api-client-react';
import { Search as SearchIcon, Loader2, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { MemoryCard } from '@/components/shared/memory-card';
import { EmptyState } from '@/components/shared/empty-state';
import { motion, AnimatePresence } from 'framer-motion';
import { useInstance } from '@/contexts/InstanceContext';

export default function Search() {
  const { activeInstanceId } = useInstance();
  const [query, setQuery] = useState('');
  const searchMutation = useSearchMemories();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !activeInstanceId) return;
    searchMutation.mutate({ data: { query: query.trim(), instanceId: activeInstanceId } });
  };

  const results = searchMutation.data?.results || [];
  const isSearching = searchMutation.isPending;

  return (
    <div className="min-h-full flex flex-col p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex-1 flex flex-col pt-4 md:pt-[10vh]">
        {/* Search Header - animates up when results exist */}
        <motion.div 
          animate={{ 
            y: results.length > 0 || isSearching ? 0 : '10vh',
            scale: results.length > 0 || isSearching ? 1 : 1.05
          }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          className="w-full max-w-3xl mx-auto flex flex-col items-center mb-8 md:mb-12"
        >
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 md:mb-6 shadow-[0_0_30px_rgba(var(--primary)/0.2)] shrink-0">
            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-primary glow-text" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 md:mb-8 text-center">Semantic Search</h1>
          
          <form onSubmit={handleSearch} className="w-full relative group px-2 md:px-0">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-4 md:left-6 h-5 w-5 md:h-6 md:w-6 text-muted-foreground group-focus-within:text-primary transition-colors shrink-0" />
              <Input 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find anything... 'contracts from last month'"
                className="w-full h-14 md:h-16 pl-12 md:pl-16 pr-24 md:pr-32 rounded-2xl bg-black/40 border-white/10 text-base md:text-lg shadow-2xl focus-visible:ring-primary focus-visible:border-primary/50 transition-all backdrop-blur-xl"
              />
              <button 
                type="submit"
                disabled={isSearching || !query.trim()}
                className="absolute right-2 md:right-3 px-4 md:px-6 py-2 bg-primary text-primary-foreground text-sm md:text-base font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                Search
              </button>
            </div>
          </form>
        </motion.div>

        {/* Results Area */}
        <div className="w-full relative flex-1">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-10 md:py-20 text-muted-foreground animate-in fade-in duration-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
              <p>Scanning knowledge base...</p>
            </div>
          ) : results.length > 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 md:space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 md:mb-6">
                <p className="text-sm md:text-base text-muted-foreground">Found {searchMutation.data?.totalFound || results.length} relevant memories</p>
                <p className="hidden sm:block text-xs text-muted-foreground/50">Results ranked by semantic similarity</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:gap-6">
                {results.map((result, index) => (
                  <motion.div 
                    key={result.memory.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group"
                  >
                    <div className="glass-panel rounded-2xl overflow-hidden flex flex-col md:flex-row relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-transparent opacity-50" />
                      
                      {/* Reason Badge */}
                      <div className="absolute top-3 right-3 md:top-4 md:right-4 z-20 max-w-[65%] md:max-w-[55%]">
                        <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-medium text-primary shadow-sm backdrop-blur-md truncate max-w-[10rem] md:max-w-[14rem]">
                          <Sparkles className="mr-1.5 h-3 w-3 shrink-0" />
                          <span className="truncate">{result.matchReason}</span>
                        </span>
                      </div>

                      <div className="w-full md:w-[40%] p-4 md:p-6 border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-center bg-black/20 pt-12 md:pt-6">
                        <MemoryCard memory={result.memory} hideConfidence className="shadow-none border-0 bg-transparent hover:shadow-none hover:-translate-y-0 p-0" />
                      </div>
                      
                      <div className="w-full md:w-[60%] p-4 md:p-6 flex flex-col justify-center">
                        <h4 className="text-xs md:text-sm font-semibold text-muted-foreground mb-2 md:mb-3 uppercase tracking-wider">Relevant Snippet</h4>
                        <div className="prose prose-invert text-sm md:text-base max-w-none text-foreground/80 font-serif leading-relaxed italic border-l-2 border-primary/30 pl-3 md:pl-4 break-words">
                          "{result.matchedSnippet || result.memory.summary}"
                        </div>
                        <div className="mt-4 flex items-center justify-end text-xs text-muted-foreground">
                          Score: {Math.round(result.relevanceScore * 100)}%
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : searchMutation.isSuccess && results.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12">
              <EmptyState 
                title="No semantic matches found" 
                description={`We couldn't find any memories semantically related to "${searchMutation.data?.query}". Try rephrasing your search.`}
                icon={SearchIcon}
              />
            </motion.div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
