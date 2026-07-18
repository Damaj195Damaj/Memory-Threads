import React from 'react';
import { useGetDashboard } from '@workspace/api-client-react';
import { MemoryCard, MemoryCardSkeleton } from '@/components/shared/memory-card';
import { Brain, FileText, Loader2, Sparkles, Activity, History } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-panel h-32 rounded-2xl animate-pulse bg-white/5" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 glass-panel h-96 rounded-2xl animate-pulse bg-white/5" />
          <div className="glass-panel h-96 rounded-2xl animate-pulse bg-white/5" />
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 w-full">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight glow-text mb-2">Memory Engine Status</h1>
        <p className="text-sm md:text-base text-muted-foreground">Your AI knowledge base is active and monitoring.</p>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <StatCard 
          title="Total Memories" 
          value={dashboard.totalMemories} 
          icon={DatabaseIcon} 
          color="text-primary" 
          delay={0}
        />
        <StatCard 
          title="Ready & Indexed" 
          value={dashboard.readyCount} 
          icon={Sparkles} 
          color="text-green-400"
          delay={0.1}
        />
        <StatCard 
          title="Processing" 
          value={dashboard.processingCount} 
          icon={Activity} 
          color="text-blue-400"
          isPulsing={dashboard.processingCount > 0}
          delay={0.2}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Top Topics Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 glass-panel rounded-2xl p-4 md:p-6 overflow-hidden flex flex-col"
        >
          <div className="flex items-center gap-2 mb-6 shrink-0">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Top Topics</h2>
          </div>
          <div className="h-[250px] md:h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.topTopics} margin={{ top: 10, right: 10, left: -30, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="topic" 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={11} 
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tickFormatter={(val) => val.length > 12 ? `${val.substring(0, 12)}...` : val}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={11} 
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', zIndex: 50 }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {dashboard.topTopics.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${0.5 + (index % 3) * 0.2})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Most Mentioned People & Recent Searches */}
        <div className="space-y-4 md:space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-panel rounded-2xl p-4 md:p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-primary" />
              Key Entities
            </h2>
            <div className="space-y-2 md:space-y-3">
              {dashboard.mostMentionedPeople.slice(0, 5).map((person, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                  <span className="text-sm font-medium truncate pr-2">{person.person}</span>
                  <span className="text-xs text-muted-foreground bg-black/20 px-2 py-1 rounded-md shrink-0">{person.count} ref</span>
                </div>
              ))}
              {dashboard.mostMentionedPeople.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No entities extracted yet.</p>
              )}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-panel rounded-2xl p-4 md:p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Recent Searches
            </h2>
            <div className="flex flex-wrap gap-2">
              {dashboard.recentSearches.map((search, i) => (
                <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 truncate max-w-full">
                  {search}
                </span>
              ))}
              {dashboard.recentSearches.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2 w-full">No searches yet.</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Recent Uploads */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="pb-8"
      >
        <div className="flex items-center justify-between mb-4 md:mb-6 mt-2 md:mt-4">
          <h2 className="text-xl md:text-2xl font-semibold flex items-center gap-2 md:gap-3">
            <FileText className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            Recent Processing
          </h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {dashboard.recentUploads.map((memory, i) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="h-full"
            >
              <MemoryCard memory={memory} hideConfidence />
            </motion.div>
          ))}
          {dashboard.recentUploads.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground glass-panel rounded-xl">
              No recent uploads. Drop a file in the upload zone to start.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, isPulsing = false, delay = 0 }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-panel rounded-2xl p-4 md:p-6 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 p-4 md:p-6 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className={`h-12 w-12 md:h-16 md:w-16 ${color}`} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-end gap-3">
          <span className="text-3xl md:text-4xl font-bold tracking-tighter text-foreground">{value}</span>
          {isPulsing && (
            <span className="flex h-3 w-3 relative mb-1.5 md:mb-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DatabaseIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}

function UsersIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
