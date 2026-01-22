import { useMemo } from 'react';
import { MessageSquare, UserCheck, Globe, TrendingUp } from 'lucide-react';
import { StatsCard } from '../StatsCard';

import type { Json } from '@/integrations/supabase/types';

interface ChatInteraction {
  session_id: string;
  lead_id: string | null;
  url_scraped: string | null;
  metadata: Json | null;
}

interface ChatEngagementStatsProps {
  interactions: ChatInteraction[];
}

export function ChatEngagementStats({ interactions }: ChatEngagementStatsProps) {
  const stats = useMemo(() => {
    const uniqueSessions = new Set(interactions.map(i => i.session_id)).size;
    const leadsLinked = new Set(interactions.filter(i => i.lead_id).map(i => i.lead_id)).size;
    const urlsScraped = interactions.filter(i => i.url_scraped).length;
    
    // Calculate average conversation length
    const sessionConversations = new Map<string, number>();
    interactions.forEach(interaction => {
      const meta = interaction.metadata as Record<string, unknown> | null;
      if (meta?.conversation_history && Array.isArray(meta.conversation_history)) {
        const length = meta.conversation_history.length;
        if (!sessionConversations.has(interaction.session_id) || 
            length > sessionConversations.get(interaction.session_id)!) {
          sessionConversations.set(interaction.session_id, length);
        }
      }
    });
    
    const conversationLengths = Array.from(sessionConversations.values());
    const avgLength = conversationLengths.length > 0
      ? Math.round(conversationLengths.reduce((a, b) => a + b, 0) / conversationLengths.length)
      : 0;

    // Conversion rate (sessions that became leads)
    const conversionRate = uniqueSessions > 0 
      ? Math.round((leadsLinked / uniqueSessions) * 100) 
      : 0;

    return {
      totalSessions: uniqueSessions,
      leadsLinked,
      urlsScraped,
      avgLength,
      conversionRate,
    };
  }, [interactions]);

  return (
    <div className="stats-card rounded-xl p-5">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Chat Engagement</h3>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Chat Sessions"
          value={stats.totalSessions}
          icon={MessageSquare}
        />
        <StatsCard
          title="Leads Captured"
          value={stats.leadsLinked}
          icon={UserCheck}
        />
        <StatsCard
          title="URLs Scraped"
          value={stats.urlsScraped}
          icon={Globe}
        />
        <StatsCard
          title="Conversion Rate"
          value={`${stats.conversionRate}%`}
          icon={TrendingUp}
        />
      </div>

      <div className="mt-4 p-4 rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Average Conversation Length</span>
          <span className="text-lg font-semibold">{stats.avgLength} messages</span>
        </div>
      </div>
    </div>
  );
}
