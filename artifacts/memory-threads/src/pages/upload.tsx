import React, { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { UploadCloud, FileType as FileTypeIcon, CheckCircle2, AlertCircle, Loader2, X, FileArchive, Archive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useInstance } from '@/contexts/InstanceContext';

type UploadFileState = {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  memoryId?: number;
  errorMessage?: string;
};

export default function Upload() {
  const { activeInstanceId } = useInstance();
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadFileState[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [overallStatus, setOverallStatus] = useState<'idle' | 'uploading' | 'done'>('idle');
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const addFiles = (newFiles: FileList | File[]) => {
    const validFiles = Array.from(newFiles);
    if (validFiles.length === 0) return;

    setFiles(prev => [
      ...prev,
      ...validFiles.map(file => ({
        file,
        id: Math.random().toString(36).substring(7),
        status: 'pending' as const,
      }))
    ]);
    setIsConfirming(true);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const next = prev.filter(f => f.id !== id);
      if (next.length === 0) {
        setIsConfirming(false);
      }
      return next;
    });
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'zip' || ext === '7z' || ext === 'rar') return <FileArchive className="w-5 h-5 text-amber-400" />;
    return <FileTypeIcon className="w-5 h-5 text-primary" />;
  };

  const confirmUpload = async () => {
    setOverallStatus('uploading');
    
    // Set all pending to uploading
    setFiles(prev => prev.map(f => f.status === 'pending' ? { ...f, status: 'uploading' } : f));
    
    const formData = new FormData();
    files.forEach(f => {
      if (f.status === 'pending') {
        formData.append('files', f.file); // Backend supports multiple files, field name flexible but 'files' is standard
      }
    });

    if (activeInstanceId) {
      formData.append('instanceId', activeInstanceId.toString());
    }

    try {
      const response = await fetch('/api/memories/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json(); // { memories: Memory[] }
      
      setFiles(prev => prev.map(f => ({ ...f, status: 'success' })));
      setOverallStatus('done');
      
      toast({
        title: "Files uploaded successfully",
        description: `Memory engine has started processing your ${data.memories?.length || 'file(s)'}.`,
      });

      // Brief delay to show success states
      setTimeout(() => {
        if (data.memories && data.memories.length === 1) {
          setLocation(`/memories/${data.memories[0].id}`);
        } else {
          setLocation(`/memories`);
        }
      }, 1500);

    } catch (err: any) {
      setFiles(prev => prev.map(f => f.status === 'uploading' ? { ...f, status: 'error', errorMessage: err.message || 'Failed' } : f));
      setOverallStatus('done'); // Allow retry
      toast({
        title: "Upload failed",
        description: err.message || "Something went wrong during upload.",
        variant: "destructive"
      });
    }
  };

  const resetUpload = () => {
    setFiles([]);
    setIsConfirming(false);
    setOverallStatus('idle');
  };

  return (
    <div className="min-h-full flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl mt-8 mb-20">
        <div className="text-center mb-8 md:mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight glow-text mb-4">Feed the Engine</h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-lg mx-auto">
            Drop your documents, notes, archives, or research here. We'll extract the intelligence and connect the dots.
          </p>
        </div>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative"
        >
          {/* Animated glow behind uploader */}
          <div className={`absolute inset-[-2px] rounded-[2rem] bg-gradient-to-r from-primary via-cyan-400 to-primary opacity-20 blur-xl transition-all duration-500 ${isDragging ? 'opacity-60 scale-105' : ''}`} />

          <div
            onDragEnter={!isConfirming ? handleDrag : undefined}
            onDragLeave={!isConfirming ? handleDrag : undefined}
            onDragOver={!isConfirming ? handleDrag : undefined}
            onDrop={!isConfirming ? handleDrop : undefined}
            className={`
              relative glass-panel rounded-[2rem] p-6 md:p-12 transition-all duration-300 ease-out overflow-hidden
              ${isDragging ? 'border-primary/50 bg-primary/5 scale-[1.02]' : 'border-white/10'}
            `}
          >
            <AnimatePresence mode="wait">
              {!isConfirming && overallStatus === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 relative z-20 text-center"
                >
                  <input
                    type="file"
                    multiple
                    onChange={handleChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    accept=".pdf,.doc,.docx,.txt,.csv,.md,.png,.jpg,.jpeg,.zip,.7z"
                  />
                  <div className={`w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full flex items-center justify-center transition-colors duration-300 ${isDragging ? 'bg-primary/20 text-primary' : 'bg-white/5 text-muted-foreground'}`}>
                    <UploadCloud className="w-10 h-10 md:w-12 md:h-12" />
                  </div>
                  <div>
                    <p className="text-lg md:text-xl font-medium mb-2">Drag and drop files here</p>
                    <p className="text-sm text-muted-foreground">or click to browse your computer</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 text-xs text-muted-foreground/60 pt-6">
                    <span className="flex items-center gap-1.5"><FileTypeIcon className="w-3.5 h-3.5" /> Docs</span>
                    <span className="flex items-center gap-1.5"><FileTypeIcon className="w-3.5 h-3.5" /> CSV/Data</span>
                    <span className="flex items-center gap-1.5"><FileTypeIcon className="w-3.5 h-3.5" /> Images</span>
                    <span className="flex items-center gap-1.5"><Archive className="w-3.5 h-3.5" /> ZIP/7z</span>
                  </div>
                </motion.div>
              )}

              {isConfirming && (
                <motion.div
                  key="confirming"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6 relative z-20"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Selected Files ({files.length})</h3>
                    {overallStatus === 'idle' && (
                      <label className="text-sm text-primary hover:text-primary/80 cursor-pointer">
                        + Add more
                        <input
                          type="file"
                          multiple
                          onChange={handleChange}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.txt,.csv,.md,.png,.jpg,.jpeg,.zip,.7z"
                        />
                      </label>
                    )}
                  </div>
                  
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                    {files.map((fileState) => (
                      <div key={fileState.id} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                        <div className="flex items-center gap-3 min-w-0">
                          {getFileIcon(fileState.file.name)}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate max-w-[200px] md:max-w-[300px]">{fileState.file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatBytes(fileState.file.size)}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 pl-2">
                          {fileState.status === 'uploading' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                          {fileState.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                          {fileState.status === 'error' && (
                            <div className="group relative">
                              <AlertCircle className="w-4 h-4 text-red-500" />
                              <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-red-500/10 text-red-500 text-xs p-1 rounded whitespace-nowrap z-50">
                                {fileState.errorMessage}
                              </div>
                            </div>
                          )}
                          
                          {overallStatus === 'idle' && (
                            <button onClick={() => removeFile(fileState.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {overallStatus === 'idle' && (
                    <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                      <Button variant="ghost" onClick={resetUpload} className="flex-1">
                        Cancel
                      </Button>
                      <Button onClick={confirmUpload} className="flex-1 bg-primary text-primary-foreground">
                        Confirm Upload
                      </Button>
                    </div>
                  )}

                  {overallStatus === 'uploading' && (
                    <div className="pt-4 border-t border-white/10 text-center text-sm text-muted-foreground animate-pulse">
                      Uploading to secure engine...
                    </div>
                  )}

                  {overallStatus === 'done' && files.some(f => f.status === 'error') && (
                    <div className="flex justify-center pt-4 border-t border-white/10">
                      <Button onClick={resetUpload} variant="outline" className="border-white/10 bg-white/5">
                        Start Over
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
