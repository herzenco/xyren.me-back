import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays, isAfter, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { MessageSquare, Link2, UserCheck, Search, Calendar, Flame, ThermometerSun } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StatsCard } from './StatsCard';
import { ConversationDetailModal } from './ConversationDetailModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ChatInteraction = {
  id: string;
  session_id: string;
  interaction_type: string;
  user_message: string | null;
  assistant_message: string | null;
  url_scraped: string | null;
  lead_id: string | null;
  metadata: ConversationMetadata | null;
  created_at: string;
};

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type CollectedData = {
  name?: string;
  email?: string;
  url?: string;
  phone?: string;
  websiteFeedback?: string;
};

type ConversationMetadata = {
  conversation_history?: ConversationMessage[];
  step?: string;
  collected_data?: CollectedData;
  lead_score?: number;
};

type GroupedSession = {
  session_id: string;
  started_at: string;
  last_activity: string;
  interaction_count: number;
  lead_id: string | null;
  lead_name: string | null;
  first_message: string | null;
  conversation_history: ConversationMessage[];
  collected_data: CollectedData;
  has_url_scraped: boolean;
  interactions: ChatInteraction[];
};

const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'with_lead', label: 'With Lead' },
  { value: 'no_lead', label: 'No Lead' },
  { value: 'with_url', label: 'URL Scraped' },
];

export function ConversationsTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedSession, setSelectedSession] = useState<GroupedSession | null>(null);
  const queryClient = useQueryClient();

  const { data: interactions, isLoading } = useQuery({
    queryKey: ['chat_interactions_full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_interactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ChatInteraction[];
    },
  });

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('chat-interactions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_interactions',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat_interactions_full'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Group interactions by session
  const groupedSessions = useMemo(() => {
    if (!interactions) return [];

    const sessionMap = new Map<string, ChatInteraction[]>();
    
    for (const interaction of interactions) {
      const existing = sessionMap.get(interaction.session_id) || [];
      existing.push(interaction);
      sessionMap.set(interaction.session_id, existing);
    }

    const sessions: GroupedSession[] = [];
    
    for (const [session_id, sessionInteractions] of sessionMap) {
      // Sort by created_at ascending to get chronological order
      const sorted = [...sessionInteractions].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // Get the latest metadata which should have the full conversation history
      const latestWithMetadata = [...sessionInteractions]
        .filter(i => i.metadata)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      const metadata = latestWithMetadata?.metadata as ConversationMetadata | null;
      const conversationHistory = metadata?.conversation_history || [];
      const collectedData = metadata?.collected_data || {};

      // Find first user message
      const firstUserMessage = sorted.find(i => i.user_message)?.user_message || 
        conversationHistory.find(m => m.role === 'user')?.content || null;

      // Check if any interaction has a URL scraped
      const hasUrlScraped = sorted.some(i => i.url_scraped);

      // Get lead_id from any interaction
      const leadId = sorted.find(i => i.lead_id)?.lead_id || null;

      sessions.push({
        session_id,
        started_at: sorted[0].created_at,
        last_activity: sorted[sorted.length - 1].created_at,
        interaction_count: sorted.length,
        lead_id: leadId,
        lead_name: collectedData.name || null,
        first_message: firstUserMessage,
        conversation_history: conversationHistory,
        collected_data: collectedData,
        has_url_scraped: hasUrlScraped,
        interactions: sorted,
      });
    }

    // Sort by last activity descending
    return sessions.sort(
      (a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
    );
  }, [interactions]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return groupedSessions.filter(session => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = session.lead_name?.toLowerCase().includes(query);
        const matchesEmail = session.collected_data.email?.toLowerCase().includes(query);
        const matchesMessage = session.first_message?.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail && !matchesMessage) return false;
      }

      // Type filter
      if (filterType === 'with_lead' && !session.lead_id) return false;
      if (filterType === 'no_lead' && session.lead_id) return false;
      if (filterType === 'with_url' && !session.has_url_scraped) return false;

      // Date range filter
      if (dateRange.from) {
        const sessionDate = parseISO(session.started_at);
        if (sessionDate < dateRange.from) return false;
      }
      if (dateRange.to) {
        const sessionDate = parseISO(session.started_at);
        if (sessionDate > dateRange.to) return false;
      }

      return true;
    });
  }, [groupedSessions, searchQuery, filterType, dateRange]);

  // Stats - including chat stats
  const stats = useMemo(() => {
    if (!groupedSessions.length) return { total: 0, withLead: 0, withUrl: 0, thisWeek: 0, hot: 0, warm: 0 };

    const weekAgo = subDays(new Date(), 7);
    
    // Count hot and warm leads from interactions
    let hotCount = 0;
    let warmCount = 0;
    
    for (const session of groupedSessions) {
      for (const interaction of session.interactions) {
        const metadata = interaction.metadata as { lead_score?: number } | null;
        const score = metadata?.lead_score;
        if (score !== undefined) {
          if (score >= 70) hotCount++;
          else if (score >= 40) warmCount++;
        }
      }
    }
    
    return {
      total: groupedSessions.length,
      withLead: groupedSessions.filter(s => s.lead_id).length,
      withUrl: groupedSessions.filter(s => s.has_url_scraped).length,
      thisWeek: groupedSessions.filter(s => isAfter(parseISO(s.started_at), weekAgo)).length,
      hot: hotCount,
      warm: warmCount,
    };
  }, [groupedSessions]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatsCard title="Total Conversations" value={stats.total} icon={MessageSquare} />
        <StatsCard title="This Week" value={stats.thisWeek} icon={Calendar} />
        <StatsCard title="Linked to Lead" value={stats.withLead} icon={UserCheck} />
        <StatsCard title="URLs Scraped" value={stats.withUrl} icon={Link2} />
        <StatsCard title="Hot Leads" value={stats.hot} icon={Flame} />
        <StatsCard title="Warm Leads" value={stats.warm} icon={ThermometerSun} />
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="stats-card rounded-xl p-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}`
                    ) : (
                      format(dateRange.from, 'MMM d, yyyy')
                    )
                  ) : (
                    'Date Range'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  initialFocus
                />
                {(dateRange.from || dateRange.to) && (
                  <div className="border-t p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setDateRange({})}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <Tabs value={filterType} onValueChange={setFilterType}>
            <TabsList className="h-9 bg-muted/50">
              {filterOptions.map((filter) => (
                <TabsTrigger
                  key={filter.value}
                  value={filter.value}
                  className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </motion.div>

      {/* Conversations List */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        {filteredSessions.length === 0 ? (
          <div className="stats-card rounded-xl p-8 text-center text-muted-foreground">
            No conversations found
          </div>
        ) : (
          filteredSessions.map((session) => (
            <ConversationCard
              key={session.session_id}
              session={session}
              onClick={() => setSelectedSession(session)}
            />
          ))
        )}
      </motion.div>

      {/* Detail Modal */}
      <ConversationDetailModal
        session={selectedSession}
        open={!!selectedSession}
        onOpenChange={(open) => !open && setSelectedSession(null)}
        onLeadLinked={() => {
          queryClient.invalidateQueries({ queryKey: ['chat_interactions_full'] });
          setSelectedSession(null);
        }}
      />
    </div>
  );
}

function ConversationCard({
  session,
  onClick,
}: {
  session: GroupedSession;
  onClick: () => void;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      className="stats-card cursor-pointer rounded-xl p-4 transition-colors hover:bg-muted/30"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">
              {session.lead_name || 'Anonymous'}
            </span>
            {session.lead_id && (
              <Badge variant="secondary" className="text-xs bg-success/20 text-success">
                Linked
              </Badge>
            )}
            {session.has_url_scraped && (
              <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">
                URL
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {session.first_message || 'No message content'}
          </p>
          {session.collected_data.email && (
            <p className="text-xs text-muted-foreground mt-1">
              {session.collected_data.email}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm text-muted-foreground">
            {format(parseISO(session.last_activity), 'MMM d, h:mm a')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {session.interaction_count} message{session.interaction_count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
