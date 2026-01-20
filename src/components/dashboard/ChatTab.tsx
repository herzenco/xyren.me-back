import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays, isAfter } from 'date-fns';
import { MessageSquare, Flame, ThermometerSun, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StatsCard } from './StatsCard';
import { AreaChartCard } from './AreaChartCard';
import { Skeleton } from '@/components/ui/skeleton';

export function ChatTab() {
  const { data: interactions, isLoading } = useQuery({
    queryKey: ['chat_interactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_interactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    if (!interactions) return { total: 0, hot: 0, warm: 0, urlsScraped: 0 };
    const sessions = new Set(interactions.map((i) => i.session_id));
    return {
      total: sessions.size,
      hot: interactions.filter((i) => (i.metadata as Record<string, number> | null)?.lead_score >= 70).length,
      warm: interactions.filter((i) => {
        const score = (i.metadata as Record<string, number> | null)?.lead_score;
        return score !== undefined && score >= 40 && score < 70;
      }).length,
      urlsScraped: interactions.filter((i) => i.url_scraped).length,
    };
  }, [interactions]);

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Sessions" value={stats.total} icon={MessageSquare} />
        <StatsCard title="Hot Leads" value={stats.hot} icon={Flame} />
        <StatsCard title="Warm Leads" value={stats.warm} icon={ThermometerSun} />
        <StatsCard title="URLs Scraped" value={stats.urlsScraped} icon={Link2} />
      </div>
      <div className="stats-card rounded-xl p-5">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Chat Sessions Over Time</h3>
        <AreaChartCard data={interactions || []} title="chat" />
      </div>
    </div>
  );
}
