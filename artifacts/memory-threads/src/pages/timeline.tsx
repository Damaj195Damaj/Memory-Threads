import React, { useState, useEffect } from 'react';
import { useGetTimeline, useCreateTimelineEvent, useUpdateTimelineEvent, useDeleteTimelineEvent, getGetTimelineQueryKey } from '@workspace/api-client-react';
import { TimelineEvent } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { Clock, Upload, Calendar as CalendarIcon, Target, Hash, ArrowRight, Loader2, Edit2, Trash2, Plus, X, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export default function Timeline() {
  const { data: timelineEvents, isLoading } = useGetTimeline();
  const [isAddOpen, setIsAddOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Group events by month/year
  const events = timelineEvents || [];
  const groupedEvents = events.reduce((acc, event) => {
    const date = new Date(event.date);
    const key = format(date, 'MMMM yyyy');
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {} as Record<string, typeof timelineEvents>);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'upload': return <Upload className="w-4 h-4" />;
      case 'event': return <CalendarIcon className="w-4 h-4" />;
      case 'deadline': return <Target className="w-4 h-4" />;
      case 'mention': return <Hash className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: string, isCustom: boolean = false) => {
    if (isCustom) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    switch (type) {
      case 'upload': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'event': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'deadline': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'mention': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-primary/20 text-primary border-primary/30';
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full pb-20 overflow-x-hidden">
      <div className="mb-8 md:mb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Chronological Timeline</h1>
          <p className="text-sm md:text-base text-muted-foreground">A unified history of your uploads and extracted events.</p>
        </div>
        <EventDialog 
          mode="create" 
          open={isAddOpen} 
          onOpenChange={setIsAddOpen}
          trigger={
            <Button className="shrink-0 gap-2">
              <Plus className="w-4 h-4" /> Add Event
            </Button>
          }
        />
      </div>

      {!timelineEvents || timelineEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center glass-panel rounded-2xl">
          <Clock className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No timeline events yet</h2>
          <p className="text-muted-foreground mb-6">Upload documents with dates, deadlines, or events to populate your timeline.</p>
          <div className="flex gap-4">
            <Link href="/upload" className="px-6 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 transition-colors inline-block">
              Upload Files
            </Link>
            <Button onClick={() => setIsAddOpen(true)} variant="outline" className="gap-2 bg-white/5 border-white/10">
              <Plus className="w-4 h-4" /> Add Manual Event
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative border-l-2 border-white/10 ml-4 md:ml-0 md:pl-0 md:border-none space-y-8 md:space-y-12">
          {/* Central line for desktop */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-white/10 via-primary/20 to-white/10 -translate-x-1/2" />

          {Object.entries(groupedEvents).map(([month, events], monthIdx) => (
            <div key={month} className="relative z-10">
              {/* Month Header */}
              <div className="flex items-center justify-start md:justify-center mb-6 md:mb-8 -ml-[25px] md:ml-0">
                <div className="px-3 md:px-4 py-1.5 rounded-full bg-black/60 border border-white/10 text-xs md:text-sm font-semibold shadow-xl backdrop-blur-md text-primary">
                  {month}
                </div>
              </div>

              <div className="space-y-6 md:space-y-8">
                {events?.map((event, idx) => {
                  const isEven = idx % 2 === 0;
                  const iconColorClass = getEventColor(event.type, event.isCustom);

                  return (
                    <motion.div 
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      className={`flex flex-col md:flex-row relative group ${isEven ? 'md:flex-row-reverse' : ''}`}
                    >
                      {/* Node on line */}
                      <div className="absolute left-[-25px] md:left-1/2 w-6 h-6 md:w-8 md:h-8 rounded-full border-4 border-background bg-card -translate-x-1/2 flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 z-20">
                        <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${iconColorClass.split(' ')[0]} shadow-[0_0_10px_currentColor]`} />
                      </div>

                      {/* Content Card */}
                      <div className={`w-full md:w-1/2 ${isEven ? 'md:pl-8 lg:pl-12' : 'md:pr-8 lg:pr-12'} pl-6`}>
                        <div className={`glass-panel rounded-2xl p-4 md:p-6 hover:border-primary/30 transition-all hover:shadow-[0_0_30px_rgba(var(--primary)/0.15)] group-hover:-translate-y-1 relative ${event.isCustom ? 'border-amber-500/20 bg-amber-500/5' : ''}`}>
                          
                          {/* Event actions menu */}
                          <div className="absolute top-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                            <EventDialog mode="edit" event={event} trigger={
                              <button className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors" title="Edit Event">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            } />
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="p-1.5 rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors" title={event.isCustom ? "Delete Event" : "Hide Event"}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="glass-panel border-white/10">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{event.isCustom ? "Delete custom event?" : "Hide extracted event?"}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {event.isCustom 
                                      ? "This will permanently delete this timeline event. This action cannot be undone." 
                                      : "This will hide this event from your timeline. It will not delete the source memory."}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-white/5 border-white/10">Cancel</AlertDialogCancel>
                                  <DeleteEventAction eventId={event.id} isCustom={event.isCustom} />
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>

                          <div className="flex items-center flex-wrap gap-2 md:gap-3 mb-3 pr-12">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 rounded-md text-[10px] md:text-xs font-medium border ${iconColorClass}`}>
                              {getEventIcon(event.type)}
                              <span className="capitalize">{event.isCustom ? 'Custom Event' : event.type}</span>
                            </span>
                            <span className="text-xs md:text-sm text-muted-foreground font-mono">
                              {format(new Date(event.date), 'MMM d, yyyy')}
                            </span>
                            {event.isEdited && (
                              <span className="text-[10px] md:text-xs text-primary/70 italic flex items-center gap-1">
                                <Edit2 className="w-3 h-3" /> edited
                              </span>
                            )}
                          </div>
                          
                          <h3 className="text-base md:text-lg font-semibold mb-2 leading-tight">{event.title}</h3>
                          
                          {event.description && (
                            <p className="text-muted-foreground text-xs md:text-sm mb-4 leading-relaxed break-words">
                              {event.description}
                            </p>
                          )}

                          {event.memoryId && (
                            <Link 
                              href={`/memories/${event.memoryId}`}
                              className="inline-flex items-center gap-2 text-xs md:text-sm text-primary hover:text-primary-foreground transition-colors mt-2"
                            >
                              <FileText className="w-4 h-4 shrink-0" />
                              <span className="truncate max-w-[150px] md:max-w-[200px]">{event.memoryName || 'View Source Memory'}</span>
                              <ArrowRight className="w-3 h-3 ml-1 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeleteEventAction({ eventId, isCustom }: { eventId: string, isCustom?: boolean }) {
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteTimelineEvent();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteMutation.mutate(
      { id: eventId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTimelineQueryKey() });
          toast({ title: isCustom ? "Event deleted" : "Event hidden" });
        },
        onError: () => {
          toast({ title: "Action failed", variant: "destructive" });
        }
      }
    );
  };

  return (
    <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white">
      {isCustom ? "Delete Event" : "Hide Event"}
    </AlertDialogAction>
  );
}

function EventDialog({ 
  mode, 
  event, 
  trigger, 
  open, 
  onOpenChange 
}: { 
  mode: 'create' | 'edit';
  event?: TimelineEvent;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [date, setDate] = useState<Date | undefined>(event ? new Date(event.date) : new Date());
  
  const queryClient = useQueryClient();
  const createMutation = useCreateTimelineEvent();
  const updateMutation = useUpdateTimelineEvent();
  const { toast } = useToast();

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setTitle(event?.title || '');
      setDescription(event?.description || '');
      setDate(event ? new Date(event.date) : new Date());
    }
  }, [isOpen, event]);

  const handleSubmit = () => {
    if (!title || !date) {
      toast({ title: "Title and Date are required", variant: "destructive" });
      return;
    }

    if (mode === 'create') {
      createMutation.mutate(
        { data: { title, description, date: date.toISOString(), type: 'event' } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetTimelineQueryKey() });
            toast({ title: "Event created" });
            setOpen(false);
          },
          onError: () => toast({ title: "Failed to create event", variant: "destructive" })
        }
      );
    } else if (event) {
      updateMutation.mutate(
        { id: event.id, data: { title, description, date: date.toISOString() } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetTimelineQueryKey() });
            toast({ title: "Event updated" });
            setOpen(false);
          },
          onError: () => toast({ title: "Failed to update event", variant: "destructive" })
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="glass-panel border-white/10 sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Timeline Event' : 'Edit Event'}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-muted-foreground">Title</label>
            <Input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="e.g. Q3 Board Meeting" 
              className="bg-black/40 border-white/10"
            />
          </div>
          
          <div className="grid gap-2">
            <label className="text-sm font-medium text-muted-foreground">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal bg-black/40 border-white/10",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 glass-panel border-white/10" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className="bg-background/80"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="grid gap-2">
            <label className="text-sm font-medium text-muted-foreground">Description (optional)</label>
            <Textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="Add some context..."
              className="bg-black/40 border-white/10 resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} className="hover:bg-white/5">Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !title || !date}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === 'create' ? 'Save Event' : 'Update Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FileText({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}
