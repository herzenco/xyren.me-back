import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Users, Clock, Monitor } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StatsCard } from './StatsCard';
import { AreaChartCard } from './AreaChartCard';
import { Skeleton } from '@/components/ui/skeleton';

export function AnalyticsTab() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['page_sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_sessions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    if (!sessions) return { total: 0, unique: 0, avgDuration: 0, desktop: 0 };
    const uniqueVisitors = new Set(sessions.map((s) => s.session_id)).size;
    const durations = sessions.filter((s) => s.duration_seconds).map((s) => s.duration_seconds!);
    const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const desktop = sessions.filter((s) => s.device_type === 'desktop').length;
    return { total: sessions.length, unique: uniqueVisitors, avgDuration, desktop };
  }, [sessions]);

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Sessions" value={stats.total} icon={Activity} />
        <StatsCard title="Unique Visitors" value={stats.unique} icon={Users} />
        <StatsCard title="Avg Duration" value={`${stats.avgDuration}s`} icon={Clock} />
        <StatsCard title="Desktop" value={stats.desktop} icon={Monitor} />
      </div>
      <div className="stats-card rounded-xl p-5">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Sessions Over Time</h3>
        <AreaChartCard data={sessions || []} title="sessions" />
      </div>
    </div>
  );
}
