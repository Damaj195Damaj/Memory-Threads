import React, { useState } from 'react';
import { useAskMemory } from '@workspace/api-client-react';
import { MessageSquare, Loader2, Brain, FileText, ArrowRight, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { useInstance } from '@/contexts/InstanceContext';

export default function Ask() {
  const { activeInstanceId } = useInstance();
  const [question, setQuestion] = useState('');
  const askMutation = useAskMemory();

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !activeInstanceId) return;
    askMutation.mutate({ data: { question: question.trim(), instanceId: activeInstanceId } });
  };

  const response = askMutation.data;
  const isAsking = askMutation.isPending;

  return (
    <div className="min-h-full flex flex-col p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex-1 flex flex-col pt-4 md:pt-[5vh]">
        <motion.div 
          animate={{ 
            y: response || isAsking ? 0 : '10vh',
          }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          className="w-full mb-8 md:mb-12"
        >
          <div className="flex items-center gap-3 md:gap-4 mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
              <Brain className="w-5 h-5 md:w-6 md:h-6 text-primary glow-text" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Ask your Engine</h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1 leading-snug">Synthesize answers across all your documents.</p>
            </div>
          </div>
          
          <form onSubmit={handleAsk} className="w-full relative group">
            <div className="absolute inset-0 bg-primary/10 blur-xl rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0">
              <MessageSquare className="hidden sm:block absolute left-6 h-5 w-5 md:h-6 md:w-6 text-muted-foreground group-focus-within:text-primary transition-colors shrink-0" />
              <Input 
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What did we agree on in the Acme contract?"
                className="w-full h-14 md:h-16 px-4 sm:pl-14 md:pl-16 sm:pr-[120px] rounded-2xl bg-black/40 border-white/10 text-base md:text-lg shadow-2xl focus-visible:ring-primary focus-visible:border-primary/50 transition-all backdrop-blur-xl"
              />
              <button 
                type="submit"
                disabled={isAsking || !question.trim()}
                className="w-full sm:w-auto sm:absolute sm:right-2 md:right-3 px-4 md:px-6 py-3 sm:py-2.5 bg-primary text-primary-foreground text-sm md:text-base font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
              >
                {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Ask AI
              </button>
            </div>
          </form>
        </motion.div>

        <AnimatePresence mode="wait">
          {isAsking && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center py-10 md:py-20 text-muted-foreground"
            >
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                <Brain className="w-10 h-10 md:w-12 md:h-12 text-primary animate-bounce relative z-10" />
              </div>
              <p className="text-base md:text-lg">Synthesizing intelligence...</p>
              <p className="text-xs md:text-sm opacity-60 text-center px-4 mt-2">Reading through your memories to construct an answer</p>
            </motion.div>
          )}

          {response && !isAsking && (
            <motion.div 
              key="response"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 space-y-6 md:space-y-8 pb-12"
            >
              {/* Answer Block */}
              <div className="glass-panel rounded-3xl p-5 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 md:p-8 opacity-5 pointer-events-none">
                  <Brain className="w-32 h-32 md:w-48 md:h-48" />
                </div>
                
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-5 md:mb-6 border-b border-white/5 pb-5 md:pb-6">
                    <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs md:text-sm font-medium flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                      AI Synthesized Response
                    </div>
                    {response.confidence && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {Math.round(response.confidence * 100)}% Confidence
                      </span>
                    )}
                  </div>

                  <div className="prose prose-sm md:prose-lg prose-invert max-w-none text-foreground/90 leading-relaxed font-serif break-words">
                    {response.answer.split('\n').map((paragraph, idx) => (
                      <p key={idx}>{paragraph}</p>
                    ))}
                  </div>
                  
                  {response.reasoning && (
                    <div className="mt-6 md:mt-8 p-3 md:p-4 rounded-xl bg-black/40 border border-white/5 text-xs md:text-sm text-muted-foreground italic break-words">
                      <span className="font-semibold not-italic mr-2">Reasoning:</span>
                      {response.reasoning}
                    </div>
                  )}
                </div>
              </div>

              {/* Cited Sources */}
              {response.sources && response.sources.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg md:text-xl font-semibold flex items-center gap-2 px-2">
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    Cited Memories
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {response.sources.map((source, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + idx * 0.1 }}
                      >
                        <Link 
                          href={`/memories/${source.memoryId}`}
                          className="block h-full glass-panel rounded-xl p-4 md:p-5 hover:border-primary/30 transition-all hover:-translate-y-1 group relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          <div className="relative z-10 flex flex-col h-full">
                            <h4 className="font-medium mb-2 text-sm md:text-base group-hover:text-primary transition-colors line-clamp-2">
                              {source.title || source.originalName}
                            </h4>
                            {source.excerpt && (
                              <p className="text-xs md:text-sm text-muted-foreground line-clamp-3 italic mb-4 flex-1">
                                "{source.excerpt}"
                              </p>
                            )}
                            <div className="flex justify-between items-center text-[10px] md:text-xs mt-auto pt-4 border-t border-white/5">
                              <span className="text-primary/70">{Math.round(source.relevance * 100)}% Match</span>
                              <span className="flex items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors">
                                View Memory <ArrowRight className="w-3 h-3 shrink-0" />
                              </span>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
